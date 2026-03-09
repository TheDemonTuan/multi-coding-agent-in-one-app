/**
 * Vietnamese IME Patch for Claude Code CLI
 * 
 * This module patches Claude Code CLI to fix Vietnamese input method (IME) issues.
 * Vietnamese IMEs (OpenKey, EVKey, UniKey, PHTV) use "backspace + replace" technique
 * to add diacritics. Claude Code processes backspace but doesn't insert the replacement
 * character, causing characters to be lost.
 * 
 * Based on: https://github.com/0x0a0d/fix-vietnamese-claude-code
 * Improved with: Multiple patterns, validation, restore, better logging
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// ============================================================================
// CONSTANTS
// ============================================================================

const DORK = '/* _0x0a0d_ime_fix_ */';
const BACKUP_EXTENSION = '.vn-backup';

// Supported Claude Code versions (tested)
const SUPPORTED_VERSIONS = [
  '2.1.70',
  '2.1.69',
  '2.1.68',
  '2.1.67',
];

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PatchResult {
  success: boolean;
  alreadyPatched?: boolean;
  message?: string;
  content?: string;
  patchedPath?: string;
  processesKilled?: number;
  version?: string;
}

export interface PatchValidation {
  isValid: boolean;
  isPatched: boolean;
  issues: string[];
  suggestions: string[];
}

export interface RestoreResult {
  success: boolean;
  message?: string;
  backupPath?: string;
}

export interface PatchStats {
  originalSize: number;
  patchedSize: number;
  sizeDiff: number;
  patchTime: number;
}

// ============================================================================
// CACHED REGEX (Performance Optimization)
// ============================================================================

const CACHED_REGEX = new Map<string, RegExp>();

function getRegex(pattern: string, flags = 'g'): RegExp {
  const key = `${pattern}|${flags}`;
  if (!CACHED_REGEX.has(key)) {
    CACHED_REGEX.set(key, new RegExp(pattern, flags));
  }
  return CACHED_REGEX.get(key)!;
}

// ============================================================================
// MULTIPLE PATTERNS (Better Detection)
// ============================================================================

const PATTERNS = {
  // Pattern 1: Standard pattern from original fix-vietnamese-claude-code
  STANDARD: 
    /(?<m0>(?<var0>[\w$]+)\.match\(\/\\x7f\/g\).*?)(?<m1>if\(!(?<var1>[\w$]+)\.equals\((?<var2>[\w$]+)\)\){if\(\k<var1>\.text!==\k<var2>\.text\)(?<func1>[\w$]+)\(\k<var2>\.text\);(?<func2>[\w$]+)\(\k<var2>\.offset\)})(?<m2>(?:[\w$]+\(\),?\s*)*;?\s*return)/g,
  
  // Pattern 2: Handle variations in equals/check methods
  EQUALS_VARIANT: 
    /(?<m0>(?<var0>[\w$]+)\.match\(\/\\x7f\/g\).*?)(?<m1>if\s*\(\s*(?<var1>[\w$]+)\.text\s*!==\s*(?<var2>[\w$]+)\.text\s*\)\s*(?<func1>[\w$]+)\(\k<var2>\.text\))/g,
  
  // Pattern 3: Fallback - simpler pattern for newer versions
  FALLBACK: 
    /match\(\/\\x7f\/g\)([\s\S]{0,300}?)text\s*!==\s*([\w$]+)\.text/g,
};

// ============================================================================
// LOGGER (Better Debugging)
// ============================================================================

class PatchLogger {
  private debugMode = process.env.VN_PATCH_DEBUG === 'true';
  
  debug(msg: string): void {
    if (this.debugMode) {
      
    }
  }
  
  info(msg: string): void {
    
  }
  
  warn(msg: string): void {
    
  }
  
  error(msg: string, err?: any): void {
    console.error('[VietnameseIME] [ERROR]', msg);
    if (err) {
      console.error('[VietnameseIME] [ERROR]', err);
    }
  }
  
  logVersionCheck(current: string | null, patched: string | null | undefined): void {
    this.debug(`Version check: current=${current || 'unknown'}, patched=${patched || 'not patched'}`);
  }
  
  logVersionMismatch(oldVersion: string | null | undefined, newVersion: string | null): void {
    this.info(`Version mismatch detected: old=${oldVersion || 'none'}, new=${newVersion || 'unknown'}`);
  }
  
  logAutoRepatchStart(): void {
    this.info('Starting auto-repatch process...');
  }
  
  logAutoRepatchResult(success: boolean, message?: string): void {
    if (success) {
      this.info('Auto-repatch completed successfully');
    } else {
      this.warn(`Auto-repatch failed: ${message || 'unknown error'}`);
    }
  }
  
  logPatchStart(filePath: string): void {
    this.info(`Starting patch for: ${filePath}`);
    this.debug(`File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB`);
  }
  
  logPatchSuccess(stats: PatchStats, version?: string): void {
    this.info(`✓ Patch applied successfully`);
    this.debug(`Size: ${stats.originalSize} → ${stats.patchedSize} bytes (${stats.sizeDiff > 0 ? '+' : ''}${stats.sizeDiff})`);
    this.debug(`Time: ${(stats.patchTime / 1000).toFixed(2)}s`);
    if (version) {
      this.debug(`Claude Code version: ${version}`);
    }
  }
  
  logPatchFailure(error: string): void {
    this.error(`✗ Patch failed: ${error}`);
  }
  
  logVersionUpdate(oldVersion: string | null | undefined, newVersion: string): void {
    this.info(`patchedVersion updated: ${oldVersion || 'none'} → ${newVersion}`);
  }
}

const logger = new PatchLogger();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick check if file is already patched
 */
function isAlreadyPatched(content: string): boolean {
  return content.includes(DORK);
}

/**
 * Early exit optimizations
 */
function quickValidation(content: string): { valid: boolean; reason?: string } {
  if (!content) return { valid: false, reason: 'Empty file' };
  if (!content.includes('match')) return { valid: false, reason: 'No match() found' };
  if (!content.includes('\\x7f')) return { valid: false, reason: 'No backspace pattern found' };
  return { valid: true };
}

/**
 * Insert code at specific position
 */
function insertCode(content: string, index: number, code: string): string {
  return content.slice(0, index) + code + content.slice(index);
}

/**
 * Extract Claude Code version from file content
 * Note: For binary files (claude.exe), version is embedded as "Version: X.X.X"
 * For JS files, version is in format "version": "X.X.X"
 */
export function extractClaudeVersion(content: string): string | null {
  // Pattern 1: Binary file format - "Version: X.X.X" where X.X.X is semantic version
  // Must match full semantic version (major.minor.patch) to avoid false positives
  let match = content.match(/Version:\s*(\d+\.\d+\.\d+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // Pattern 2: JS format - "version": "X.X.X"
  match = content.match(/["']version["']\s*:\s*["']([\d.]+)["']/);
  if (match && match[1]) {
    return match[1];
  }

  // Pattern 3: Alternative format - version = "X.X.X" or version: "X.X.X"
  match = content.match(/version\s*[:=]\s*["']?([\d.]+)["']?/i);
  if (match && match[1]) {
    return match[1];
  }

  // Pattern 4: npm package format
  match = content.match(/@anthropic-ai\/claude-code@([\d.]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Get current Claude Code version from file system
 * Returns null if Claude Code is not found or version cannot be extracted
 */
export function getCurrentClaudeVersion(): string | null {
  const claudePath = findClaudePath();
  
  if (!claudePath || !fs.existsSync(claudePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(claudePath, 'latin1');
    return extractClaudeVersion(content);
  } catch {
    return null;
  }
}

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  
  return 0;
}

/**
 * Check if current Claude Code version differs from the patched version
 * 
 * @param currentVersion - Current Claude Code version (optional, will be auto-detected if not provided)
 * @param patchedVersion - Previously patched version from store (optional, will use undefined check)
 * @returns true if versions don't match (mismatch detected), false otherwise
 * 
 * Behavior:
 * - Returns false if patchedVersion is null/undefined (never patched, no mismatch)
 * - Returns false if Claude Code is not installed (no mismatch if not installed)
 * - Returns false if currentVersion cannot be determined (conservative, assume no mismatch)
 * - Returns true if currentVersion !== patchedVersion (version changed, needs repatch)
 */
export function isVersionMismatched(
  currentVersion?: string | null,
  patchedVersion?: string | null
): boolean {
  // No mismatch if never patched (patchedVersion is null/undefined)
  if (!patchedVersion) {
    return false;
  }
  
  // Auto-detect current version if not provided
  if (currentVersion === undefined) {
    currentVersion = getCurrentClaudeVersion();
  }
  
  // No mismatch if Claude Code is not installed or version cannot be determined
  if (!currentVersion) {
    return false;
  }
  
  // Compare versions using semantic versioning
  return compareVersions(currentVersion, patchedVersion) !== 0;
}

/**
 * Check if version is compatible
 */
function isVersionCompatible(version: string | null): { compatible: boolean; message: string } {
  if (!version) {
    return { compatible: true, message: 'Version unknown, attempting patch' };
  }
  
  if (SUPPORTED_VERSIONS.includes(version)) {
    return { compatible: true, message: `Version ${version} is supported` };
  }
  
  // Check major.minor compatibility
  const [major, minor] = version.split('.').map(Number);
  const [supportedMajor, supportedMinor] = SUPPORTED_VERSIONS[0].split('.').map(Number);
  
  if (major === supportedMajor && minor >= supportedMinor - 2) {
    return { compatible: true, message: `Version ${version} likely compatible (not tested)` };
  }
  
  return { 
    compatible: false, 
    message: `Version ${version} may not be compatible. Tested versions: ${SUPPORTED_VERSIONS.join(', ')}` 
  };
}

// ============================================================================
// SHARED CORE LOGIC
// ============================================================================

/**
 * Core Vietnamese IME fix code to insert
 */
function generateVietnameseFix(var0: string, var2: string): string {
  return `
${DORK}
let _vn = ${var0}.replace(/\\x7f/g, "");
if (_vn.length > 0) {
  for (const _c of _vn) ${var2} = ${var2}.insert(_c);
}`;
}

/**
 * Apply Vietnamese fix to matched pattern
 */
function applyFixToMatch(content: string, match: RegExpExecArray): string {
  const groups = match.groups as any;
  const { m0, m1, m2, var0, var2 } = groups;
  
  if (!var0 || !var2) {
    throw new Error('Could not extract variable names from pattern');
  }
  
  const fix = generateVietnameseFix(var0, var2);
  
  // Replace the match with fixed version
  const replacement = `${DORK}
${m0}
${fix}
${m1}
${m2 || ''}`.replace(/^\s+/gm, '').trim();
  
  return content.replace(match[0], replacement);
}

// ============================================================================
// PATCH FUNCTIONS
// ============================================================================

/**
 * Patch JavaScript content (.js files)
 */
export function patchContentJs(fileContent: string): PatchResult {
  const startTime = Date.now();
  const originalSize = fileContent.length;
  

  
  // Quick checks
  if (isAlreadyPatched(fileContent)) {
    return { success: true, alreadyPatched: true };
  }
  
  const validation = quickValidation(fileContent);
  if (!validation.valid) {
    return { success: false, message: `Invalid file: ${validation.reason}` };
  }
  
  // Try multiple patterns
  let newContent = fileContent;
  let patternUsed = '';
  
  for (const [patternName, pattern] of Object.entries(PATTERNS)) {

    
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    const testContent = newContent.replace(pattern, (...args) => {
      const { m0, m1, var0, var2, m2 } = args[args.length - 1] as any;
      
      if (!var0 || !var2) return args[0]; // Skip if can't extract vars
      
      const fix = generateVietnameseFix(var0, var2);
      patternUsed = patternName;
      
      return `${DORK}
${m0}
${fix}
${m1}
${m2 || ''}`.replace(/^\s+/gm, '');
    });
    
    if (testContent.length > newContent.length) {
      newContent = testContent;

      break;
    }
  }
  
  // Check if patch was applied
  if (newContent.length === fileContent.length) {
    return { success: false, message: 'Patch failed: no match found. Claude Code may have updated.' };
  }
  
  // Validate patch
  if (!isAlreadyPatched(newContent)) {
    return { success: false, message: 'Patch validation failed: marker not found' };
  }
  
  const patchTime = Date.now() - startTime;

  
  return {
    success: true,
    alreadyPatched: false,
    content: newContent,
  };
}

/**
 * Patch binary content (.exe files)
 */
export function patchContentBinary(binaryContent: string): PatchResult {
  const startTime = Date.now();
  const originalSize = binaryContent.length;
  

  
  // Quick checks
  if (isAlreadyPatched(binaryContent)) {
    return { success: true, alreadyPatched: true };
  }
  
  const validation = quickValidation(binaryContent);
  if (!validation.valid) {
    return { success: false, message: `Invalid binary: ${validation.reason}` };
  }
  
  // Find matches first
  const matches: Array<{ 
    diff: number; 
    index: number; 
    original: string;
    patched: string;
    found?: boolean; 
  }> = [];
  
  let patchedContent = binaryContent;
  
  // Try patterns
  for (const [patternName, pattern] of Object.entries(PATTERNS)) {
    pattern.lastIndex = 0;
    
    patchedContent = patchedContent.replace(pattern, (...args) => {
      const groups = args[args.length - 1] as any;
      const offset = args[args.length - 3] as number;
      const { m0, m1, var0, var2, m2 } = groups;
      
      if (!var0 || !var2) return args[0];
      
      const patchedSegment = `${DORK}
${m0}
${generateVietnameseFix(var0, var2)}
${m1}
${m2 || ''}`.replace(/^\s+/gm, '');
      
      matches.push({
        diff: patchedSegment.length - args[0].length,
        index: offset,
        original: args[0],
        patched: patchedSegment,
      });
      
      return patchedSegment;
    });
    
    if (matches.length > 0) {

      break;
    }
  }
  
  if (matches.length === 0) {
    return { success: false, message: 'Patch failed: no match found' };
  }
  
  // Handle binary pragma adjustment
  const pragma = `// @bun `;
  const pragmaLength = pragma.length;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    
    for (let j = match.index - 1; j >= (i === 0 ? 0 : matches[i - 1].index); j--) {
      if (patchedContent[j] === '\x00') {
        if (patchedContent.slice(j + 1, j + 1 + pragmaLength).toString() === pragma) {
          let found = false;
          
          for (let k = j + 1 + pragmaLength; k < match.index; k++) {
            if (patchedContent[k] === '\n' && 
                patchedContent[k + 1] === '/' && 
                patchedContent[k + 2] === '/') {
              
              const diff = match.diff;
              const sliceStart = k + 3;
              patchedContent = patchedContent.slice(0, sliceStart) + 
                             patchedContent.slice(sliceStart + diff);
              found = true;
              break;
            }
          }
          
          if (found) {
            matches[i].found = true;
            break;
          }
        }
      }
    }
    
    if (!matches[i].found) {

    }
  }
  
  // Check if all matches were adjusted
  if (matches.every(m => !m.found)) {
    return { success: false, message: 'Patch failed: pragma adjustment failed' };
  }
  
  const patchTime = Date.now() - startTime;

  
  return {
    success: true,
    alreadyPatched: false,
    content: patchedContent,
  };
}

// ============================================================================
// RESTORE & UNPATCH FUNCTIONS
// ============================================================================

/**
 * Restore file from backup
 */
export function restoreFromBackup(): RestoreResult {
  const targetPath = findClaudePath();
  
  if (!targetPath) {
    return { success: false, message: 'Claude Code not found' };
  }
  
  const backupPath = targetPath + BACKUP_EXTENSION;
  
  if (!fs.existsSync(backupPath)) {
    return { 
      success: false, 
      message: 'No backup found. File may not have been patched or backup was deleted.' 
    };
  }
  
  try {
    // Validate backup
    const backupContent = fs.readFileSync(backupPath, 'latin1');
    if (backupContent.length === 0) {
      return { success: false, message: 'Backup file is corrupted (empty)' };
    }
    
    // Restore
    fs.copyFileSync(backupPath, targetPath);

    
    return {
      success: true,
      message: 'Successfully restored original file',
      backupPath,
    };
  } catch (err: any) {
    logger.error('Failed to restore', err);
    return { success: false, message: `Restore failed: ${err.message}` };
  }
}

/**
 * Force unpatch (remove patch markers and code)
 */
export function forceUnpatch(): PatchResult {
  const targetPath = findClaudePath();
  
  if (!targetPath || !fs.existsSync(targetPath)) {
    return { success: false, message: 'Claude Code not found' };
  }
  
  try {
    const content = fs.readFileSync(targetPath, 'latin1');
    
    if (!isAlreadyPatched(content)) {
      return { success: true, message: 'File was not patched' };
    }
    
    // Create backup before unpatching (safety)
    const backupPath = targetPath + BACKUP_EXTENSION;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(targetPath, backupPath);

    }
    
    // Remove DORK markers
    let unpatchedContent = content.replace(new RegExp(DORK, 'g'), '');
    
    // Remove Vietnamese fix code blocks
    const fixPattern = /let _vn = [\w$]+\.replace\(\/\\x7f\/g, ""\);[\s\S]{0,300}?for \(const _c of _vn\) [\w$]+ = [\w$]+\.insert\(_c\);/g;
    unpatchedContent = unpatchedContent.replace(fixPattern, '');
    
    // Validate unpatch
    if (isAlreadyPatched(unpatchedContent)) {
      return { success: false, message: 'Failed to remove all patch markers' };
    }
    
    fs.writeFileSync(targetPath, unpatchedContent, 'latin1');

    
    return {
      success: true,
      message: 'Successfully unpatched (backup created)',
      content: unpatchedContent,
    };
  } catch (err: any) {
    logger.error('Force unpatch failed', err);
    return { success: false, message: err.message };
  }
}

// ============================================================================
// MAIN PATCH FUNCTION
// ============================================================================

/**
 * Apply Vietnamese IME patch
 */
export async function applyVietnameseImePatch(): Promise<PatchResult> {
  const targetPath = findClaudePath();
  
  if (!targetPath || !fs.existsSync(targetPath)) {
    return {
      success: false,
      message: 'Could not find Claude Code. Please install it first.',
    };
  }
  
  logger.logPatchStart(targetPath);
  
  const startTime = Date.now();
  const originalSize = fs.statSync(targetPath).size;
  
  // Kill processes for binary files
  const isBinary = targetPath.endsWith('.exe') || targetPath.endsWith('.cmd');
  let processesKilled = 0;
  
  if (isBinary) {

    const killResult = killClaudeProcesses();
    
    if (!killResult.success) {
      return {
        success: false,
        message: `${killResult.message} Please close Claude Code manually and try again.`,
        processesKilled: 0,
      };
    }
    
    processesKilled = killResult.count;
    
    if (processesKilled > 0) {

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  try {
    // Read file
    const fileContent = fs.readFileSync(targetPath, 'latin1');
    
    // Check version compatibility
    const version = extractClaudeVersion(fileContent);
    const compat = isVersionCompatible(version);
    
    if (!compat.compatible) {

    } else {

    }
    
    // Apply patch
    const isJs = targetPath.endsWith('.js');
    const result = isJs
      ? patchContentJs(fileContent)
      : patchContentBinary(fileContent);
    
    if (result.alreadyPatched) {

      return { 
        ...result, 
        patchedPath: targetPath,
        processesKilled,
        version: version || undefined,
      };
    }
    
    if (!result.success || !result.content) {
      logger.logPatchFailure(result.message || 'Unknown error');
      return { 
        ...result, 
        processesKilled,
        version: version || undefined,
      };
    }
    
    // Create backup
    const backupPath = targetPath + BACKUP_EXTENSION;
    fs.copyFileSync(targetPath, backupPath);

    
    // Write patched file
    fs.writeFileSync(targetPath, result.content, 'latin1');
    
    const patchTime = Date.now() - startTime;
    const patchedSize = fs.statSync(targetPath).size;
    
    logger.logPatchSuccess({
      originalSize,
      patchedSize,
      sizeDiff: patchedSize - originalSize,
      patchTime,
    });
    
    return {
      ...result,
      patchedPath: targetPath,
      processesKilled,
      version: version || undefined,
    };
  } catch (err: any) {
    logger.error('Patch failed', err);
    
    if (err.code === 'EBUSY') {
      return {
        success: false,
        message: 'File is locked. Please close Claude Code and try again.',
        processesKilled,
      };
    }
    
    return { 
      success: false, 
      message: err.message,
      processesKilled,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if already patched
 */
export function isVietnameseImePatched(): boolean {
  const targetPath = findClaudePath();
  
  if (!targetPath || !fs.existsSync(targetPath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(targetPath, 'latin1');
    return isAlreadyPatched(content);
  } catch {
    return false;
  }
}

/**
 * Validate patch
 */
export function validatePatch(): PatchValidation {
  const targetPath = findClaudePath();
  
  if (!targetPath || !fs.existsSync(targetPath)) {
    return {
      isValid: false,
      isPatched: false,
      issues: ['Claude Code not found'],
      suggestions: ['Install Claude Code first'],
    };
  }
  
  try {
    const content = fs.readFileSync(targetPath, 'latin1');
    const isPatched = isAlreadyPatched(content);
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    if (!isPatched) {
      issues.push('File is not patched');
      suggestions.push('Run applyVietnameseImePatch() to fix Vietnamese IME');
    }
    
    // Check backup
    const backupPath = targetPath + BACKUP_EXTENSION;
    if (!fs.existsSync(backupPath)) {
      issues.push('No backup available');
      suggestions.push('Consider creating a backup before patching');
    }
    
    return {
      isValid: issues.length === 0,
      isPatched,
      issues,
      suggestions,
    };
  } catch (err: any) {
    return {
      isValid: false,
      isPatched: false,
      issues: [`Validation failed: ${err.message}`],
      suggestions: ['Ensure Claude Code is installed correctly'],
    };
  }
}

/**
 * Check patch status
 * Note: For electron-store access, use the IPC handler instead which returns patchedVersion from store
 */
export function checkPatchStatus(): {
  isPatched: boolean;
  claudePath: string | null;
  hasBackup: boolean;
  installedVia: 'bun' | 'npm' | 'pnpm' | 'binary' | 'unknown';
  version?: string | null;
} {
  const claudePath = findClaudePath();
  
  if (!claudePath) {
    return { 
      isPatched: false, 
      claudePath: null, 
      hasBackup: false, 
      installedVia: 'unknown' 
    };
  }
  
  const isPatched = isVietnameseImePatched();
  const hasBackup = fs.existsSync(claudePath + BACKUP_EXTENSION);
  
  let installedVia: 'bun' | 'npm' | 'pnpm' | 'binary' | 'unknown' = 'unknown';
  
  if (claudePath.includes('.bun')) installedVia = 'bun';
  else if (claudePath.includes('npm')) installedVia = 'npm';
  else if (claudePath.includes('pnpm')) installedVia = 'pnpm';
  else if (claudePath.endsWith('.exe') || claudePath.endsWith('.cmd')) installedVia = 'binary';
  
  // Extract version
  let version: string | null = null;
  try {
    const content = fs.readFileSync(claudePath, 'latin1');
    version = extractClaudeVersion(content);
  } catch {}
  
  return { 
    isPatched, 
    claudePath, 
    hasBackup, 
    installedVia,
    version,
  };
}

/**
 * Kill all Claude processes (Windows only)
 */
export function killClaudeProcesses(): { success: boolean; count: number; message?: string } {
  const isWin = os.platform() === 'win32';
  
  if (!isWin) {
    return { success: true, count: 0 };
  }
  
  try {
    const result = execSync('taskkill /F /IM claude.exe 2>nul', { 
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    });
    
    const lines = result.split('\n');
    let count = 0;
    
    for (const line of lines) {
      if (line.includes('Successfully terminated')) {
        count++;
      }
    }
    
    if (result.includes('No running instance') || result.includes('not running')) {
      return { success: true, count: 0, message: 'No Claude processes running' };
    }
    
    return { 
      success: true, 
      count: count > 0 ? count : 1, 
      message: `Closed ${count > 0 ? count : 1} Claude process(es)` 
    };
  } catch (err: any) {
    const output = err.stdout?.toString() || '';
    
    if (output.includes('No running instance') || 
        output.includes('not running') || 
        err.status === 128) {
      return { success: true, count: 0, message: 'No Claude processes running' };
    }
    
    return { 
      success: false, 
      count: 0, 
      message: 'Failed to close Claude processes. Close them manually.' 
    };
  }
}

/**
 * Find Claude Code CLI path
 */
export function findClaudePath(): string | null {
  const isWin = os.platform() === 'win32';
  
  const run = (cmd: string): string => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .split(/\r?\n/)[0]
        .trim();
    } catch {
      return '';
    }
  };
  
  const exists = (p: string): boolean => {
    try {
      return p ? fs.existsSync(p) : false;
    } catch {
      return false;
    }
  };
  

  
  // 1) which / where / bun which
  for (const cmd of [
    isWin ? 'where claude' : 'which claude',
    'bun which claude',
  ]) {
    const p = run(cmd);
    if (exists(p)) {

      if (!isWin) {
        try {
          return execSync(`realpath "${p}"`).toString().trim();
        } catch {}
      }
      return p;
    }
  }
  
  // 2) Bun global paths
  const bunInstall =
    process.env.BUN_INSTALL ||
    (isWin
      ? path.join(process.env.USERPROFILE || '', '.bun')
      : path.join(process.env.HOME || '', '.bun'));
  
  const bunPaths = [
    path.join(bunInstall, 'bin', isWin ? 'claude.exe' : 'claude'),
    path.join(bunInstall, 'bin', isWin ? 'claude.cmd' : 'claude'),
    path.join(
      bunInstall,
      'install',
      'global',
      'node_modules',
      '@anthropic-ai',
      'claude-code',
      'cli.js'
    ),
  ];
  
  for (const p of bunPaths) {
    if (exists(p)) {

      return p;
    }
  }
  
  // 3) npm global
  try {
    const npmRoot = execSync('npm root -g').toString().trim();
    const cliPath = path.join(
      npmRoot,
      '@anthropic-ai',
      'claude-code',
      'cli.js'
    );
    if (exists(cliPath)) {

      return cliPath;
    }
  } catch (e) {}
  
  // 4) Windows fallbacks
  if (isWin) {
    const paths = [
      path.join(
        process.env.APPDATA || '',
        'npm',
        'node_modules',
        '@anthropic-ai',
        'claude-code',
        'cli.js'
      ),
      path.join(
        process.env.LOCALAPPDATA || '',
        'npm',
        'node_modules',
        '@anthropic-ai',
        'claude-code',
        'cli.js'
      ),
    ];
  
    if (process.env.NVM_HOME) {
      try {
        for (const d of fs.readdirSync(process.env.NVM_HOME)) {
          paths.push(
            path.join(
              process.env.NVM_HOME,
              d,
              'node_modules',
              '@anthropic-ai',
              'claude-code',
              'cli.js'
            )
          );
        }
      } catch (e) {}
    }
  
    for (const p of paths) {
      if (exists(p)) {

        return p;
      }
    }
  }
  

  return null;
}

package services

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"tdt-space/internal/platform"
)

// ============================================================================
// VietnameseIMEService — ports src/utils/vietnameseImePatch.ts to Go
// ============================================================================

const (
	imeDork            = "/* _0x0a0d_ime_fix_ */"
	imeBackupExtension = ".vn-backup"
)

var (
	reVersionBinary    = regexp.MustCompile(`(?i)Version:\s*(\d+\.\d+\.\d+)`)
	reVersionJS        = regexp.MustCompile(`["']version["']\s*:\s*["']([\d.]+)["']`)
	reVersionAlt       = regexp.MustCompile(`(?i)version\s*[:=]\s*["']?([\d.]+)["']?`)
	reVersionAnthropic = regexp.MustCompile(`(?i)@anthropic-ai/claude-code@([\d.]+)`)
	// reIMEPattern matches the entire Claude Code IME pattern with named capture groups:
	// m0: match part including var0.match(/\x7f/g)
	// m1: the entire conditional block if(!var1.equals(var2)){...}
	// m2: trailing function calls and return statement
	// var0, var1, var2: variable names used in the pattern
	reIMEPattern = regexp.MustCompile(`(?s)(?P<m0>(?P<var0>[\w$]+)\.match\(/\\x7f/g\).*?)(?P<m1>if\(!(?P<var1>[\w$]+)\.equals\((?P<var2>[\w$]+)\)\)\{if\((?P<var1b>[\w$]+)\.text!==(?P<var2b>[\w$]+)\.text\)(?P<func1>[\w$]+)\((?P<var2c>[\w$]+)\.text\);(?P<func2>[\w$]+)\((?P<var2d>[\w$]+)\.offset\)\})(?P<m2>(?:[\w$]+\(\),?\s*)*;?\s*return)`)
)

// VietnameseIMEService manages Vietnamese IME patching for Claude Code.
type VietnameseIMEService struct {
	store *StoreService
}

// NewVietnameseIMEService creates a new VietnameseIMEService.
func NewVietnameseIMEService() *VietnameseIMEService {
	return &VietnameseIMEService{}
}

// Init wires the store dependency.
func (v *VietnameseIMEService) Init(store *StoreService) {
	v.store = store
}

// FindClaudePath locates the Claude Code CLI binary.
func (v *VietnameseIMEService) FindClaudePath() string {
	isWin := runtime.GOOS == "windows"

	run := func(name string, args ...string) string {
		cmd := exec.Command(name, args...)
		if isWin {
			cmd.SysProcAttr = platform.HiddenWindowAttr()
		}
		out, err := cmd.Output()
		if err != nil {
			return ""
		}
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" {
				return line
			}
		}
		return ""
	}

	fileExistsFn := func(p string) bool {
		if p == "" {
			return false
		}
		p = filepath.Clean(p)
		info, err := os.Stat(p)
		if err != nil {
			return false
		}
		return !info.IsDir()
	}

	// Priority 1: System PATH (where/which command)
	if isWin {
		// Windows: where claude - try all matches
		cmd := exec.Command("where", "claude")
		cmd.SysProcAttr = platform.HiddenWindowAttr()
		if out, err := cmd.Output(); err == nil {
			lines := strings.Split(strings.TrimSpace(string(out)), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" && fileExistsFn(line) {
					fmt.Printf("[VietnameseIME] Found Claude via 'where': %s\n", line)
					return line
				}
			}
		}
		// Windows: PowerShell Get-Command (more reliable for finding actual binary)
		psCmd := `Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source`
		if p := run("powershell", "-NoProfile", "-Command", psCmd); p != "" {
			p = strings.TrimSpace(p)
			if fileExistsFn(p) {
				fmt.Printf("[VietnameseIME] Found Claude via PowerShell: %s\n", p)
				return p
			}
		}
	} else {
		// Unix/macOS: which claude
		if p := run("which", "claude"); p != "" {
			if fileExistsFn(p) {
				if resolved, err := filepath.EvalSymlinks(p); err == nil {
					fmt.Printf("[VietnameseIME] Found Claude via 'which' (resolved): %s\n", resolved)
					return resolved
				}
				fmt.Printf("[VietnameseIME] Found Claude via 'which': %s\n", p)
				return p
			}
		}
	}

	// Priority 2: bun which claude (works cross-platform, most reliable for bun installs)
	if p := run("bun", "which", "claude"); p != "" {
		p = strings.TrimSpace(p)
		if fileExistsFn(p) {
			fmt.Printf("[VietnameseIME] Found Claude via 'bun which': %s\n", p)
			// On Windows, try to resolve if it's a symlink/junction
			if isWin {
				if resolved, err := filepath.EvalSymlinks(p); err == nil {
					fmt.Printf("[VietnameseIME] Resolved symlink: %s\n", resolved)
					return resolved
				}
			}
			return p
		}
	}

	// Priority 3: Check Bun install paths manually
	bunInstall := os.Getenv("BUN_INSTALL")
	if bunInstall == "" {
		bunInstall = filepath.Join(platform.GetUserHome(), ".bun")
	}

	claudeExe := "claude"
	if isWin {
		claudeExe = "claude.exe"
	}

	// Common Bun paths for Claude Code - check both binary and cli.js
	bunPaths := []string{
		// Direct binary in bun bin (most common for bunx)
		filepath.Join(bunInstall, "bin", claudeExe),
		filepath.Join(bunInstall, "bin", "claude.cmd"),
		// cli.js (for direct script execution)
		filepath.Join(bunInstall, "install", "global", "node_modules", "@anthropic-ai", "claude-code", "cli.js"),
		// Alternative bun global path
		filepath.Join(bunInstall, "node_modules", "@anthropic-ai", "claude-code", "cli.js"),
		// Bun 1.2+ global path
		filepath.Join(bunInstall, "global", "node_modules", "@anthropic-ai", "claude-code", "cli.js"),
	}

	for _, p := range bunPaths {
		if fileExistsFn(p) {
			fmt.Printf("[VietnameseIME] Found Claude at Bun path: %s\n", p)
			return p
		}
	}

	// Priority 4: npm global install
	if npmRoot := run("npm", "root", "-g"); npmRoot != "" {
		cliPath := filepath.Join(npmRoot, "@anthropic-ai", "claude-code", "cli.js")
		if fileExistsFn(cliPath) {
			fmt.Printf("[VietnameseIME] Found Claude via npm global: %s\n", cliPath)
			return cliPath
		}
	}

	// Priority 5: Windows-specific paths (APPDATA, LOCALAPPDATA, NVM)
	if isWin {
		var wsPaths []string

		// APPDATA and LOCALAPPDATA npm/pnpm/yarn paths
		appdata := os.Getenv("APPDATA")
		localappdata := os.Getenv("LOCALAPPDATA")
		for _, base := range []string{appdata, localappdata} {
			if base != "" {
				// npm global
				wsPaths = append(wsPaths, filepath.Join(base, "npm", "node_modules", "@anthropic-ai", "claude-code", "cli.js"))
				// pnpm global
				wsPaths = append(wsPaths, filepath.Join(base, "pnpm-global", "node_modules", "@anthropic-ai", "claude-code", "cli.js"))
				// yarn global
				wsPaths = append(wsPaths, filepath.Join(base, "Yarn", "Data", "global", "node_modules", "@anthropic-ai", "claude-code", "cli.js"))
			}
		}

		// NVM paths (Node Version Manager)
		if nvmHome := os.Getenv("NVM_HOME"); nvmHome != "" {
			if entries, err := os.ReadDir(nvmHome); err == nil {
				for _, e := range entries {
					if e.IsDir() {
						wsPaths = append(wsPaths,
							filepath.Join(nvmHome, e.Name(), "node_modules", "@anthropic-ai", "claude-code", "cli.js"),
						)
					}
				}
			}
		}

		// Bun shim paths (alternative locations)
		bunShimPaths := []string{
			filepath.Join(localappdata, "Microsoft", "WinGet", "Packages", "Oven.Oven", "LocalState", "bin", "claude.exe"),
			filepath.Join(os.Getenv("USERPROFILE"), "scoop", "shims", "claude.exe"),
		}
		wsPaths = append(wsPaths, bunShimPaths...)

		for _, p := range wsPaths {
			if fileExistsFn(p) {
				fmt.Printf("[VietnameseIME] Found Claude at Windows path: %s\n", p)
				return p
			}
		}
	}

	// Priority 6: Official CLAUDE Code installer paths (WinGet/PowerShell)
	if isWin {
		// Official WinGet/PowerShell installer paths (PRIMARY - with space in "Claude Code")
		officialPaths := []string{
			// WinGet/PowerShell installer paths (RECOMMENDED - check first)
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Claude Code", "claude.exe"),
			filepath.Join(os.Getenv("PROGRAMFILES"), "Claude Code", "claude.exe"),
			filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local", "Programs", "Claude Code", "claude.exe"),
			// Legacy paths (keep for backward compatibility with older installs)
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Claude", "claude.exe"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Claude", "claude.exe"),
			filepath.Join(os.Getenv("PROGRAMFILES"), "Claude", "claude.exe"),
			filepath.Join(os.Getenv("PROGRAMFILES(X86)"), "Claude", "claude.exe"),
			filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local", "Programs", "Claude", "claude.exe"),
		}
		for _, p := range officialPaths {
			if fileExistsFn(p) {
				fmt.Printf("[VietnameseIME] Found Claude at official path: %s\n", p)
				return p
			}
		}
	}

	// Not found - provide helpful message with current installation methods
	fmt.Printf("[VietnameseIME] Claude Code not found in PATH or common locations.\n")
	fmt.Printf("[VietnameseIME] Please install Claude Code using one of these methods:\n")
	fmt.Printf("[VietnameseIME]   (RECOMMENDED) PowerShell: irm https://claude.ai/install.ps1 | iex\n")
	fmt.Printf("[VietnameseIME]   (RECOMMENDED) WinGet:     winget install Anthropic.ClaudeCode\n")
	fmt.Printf("[VietnameseIME]   (ALTERNATIVE) bun:        bun install -g @anthropic-ai/claude-code\n")

	return ""
}

func ExtractClaudeVersion(content string) string {
	if m := reVersionBinary.FindStringSubmatch(content); len(m) > 1 {
		return m[1]
	}
	if m := reVersionJS.FindStringSubmatch(content); len(m) > 1 {
		return m[1]
	}
	if m := reVersionAlt.FindStringSubmatch(content); len(m) > 1 {
		return m[1]
	}
	if m := reVersionAnthropic.FindStringSubmatch(content); len(m) > 1 {
		return m[1]
	}
	return ""
}

func (v *VietnameseIMEService) GetCurrentClaudeVersion() string {
	claudePath := v.FindClaudePath()
	if claudePath == "" {
		return ""
	}
	content, err := readFileLatin1(claudePath)
	if err != nil {
		return ""
	}
	return ExtractClaudeVersion(content)
}

func (v *VietnameseIMEService) GetPatchStatus() PatchStatus {
	claudePath := v.FindClaudePath()
	if claudePath == "" {
		return PatchStatus{
			IsPatched:           false,
			ClaudePath:          "",
			HasBackup:           false,
			InstalledVia:        "unknown",
			ClaudeCodeInstalled: false,
		}
	}

	isPatched := false
	version := ""
	if content, err := readFileLatin1(claudePath); err == nil {
		isPatched = strings.Contains(content, imeDork)
		version = ExtractClaudeVersion(content)
	}

	hasBackup := imeFileExists(claudePath + imeBackupExtension)

	installedVia := "unknown"
	switch {
	case strings.Contains(claudePath, ".bun"):
		installedVia = "bun"
	case strings.Contains(claudePath, "npm"):
		installedVia = "npm"
	case strings.Contains(claudePath, "pnpm"):
		installedVia = "pnpm"
	case strings.HasSuffix(claudePath, ".exe"), strings.HasSuffix(claudePath, ".cmd"):
		installedVia = "binary"
	}

	return PatchStatus{
		IsPatched:           isPatched,
		ClaudePath:          claudePath,
		HasBackup:           hasBackup,
		InstalledVia:        installedVia,
		Version:             version,
		ClaudeCodeInstalled: true,
	}
}

func (v *VietnameseIMEService) IsVietnameseImePatched() bool {
	return v.GetPatchStatus().IsPatched
}

type patchContent struct {
	success        bool
	alreadyPatched bool
	content        string
	message        string
}

func (v *VietnameseIMEService) ApplyVietnameseImePatch() PatchResult {
	claudePath := v.FindClaudePath()
	if claudePath == "" {
		return PatchResult{Success: false, Message: "Could not find Claude Code. Please install it first."}
	}

	isBinary := strings.HasSuffix(claudePath, ".exe") || strings.HasSuffix(claudePath, ".cmd")
	processesKilled := 0

	if isBinary {
		killResult := v.KillClaudeProcesses()
		if !killResult.Success {
			return PatchResult{
				Success:         false,
				Message:         killResult.Message + " Please close Claude Code manually and try again.",
				ProcessesKilled: 0,
			}
		}
		processesKilled = killResult.Count
	}

	fileContent, err := readFileLatin1(claudePath)
	if err != nil {
		if os.IsPermission(err) {
			return PatchResult{Success: false, Message: "Permission denied. Run as administrator/sudo.", ProcessesKilled: processesKilled}
		}
		return PatchResult{Success: false, Message: fmt.Sprintf("Failed to read file: %v", err), ProcessesKilled: processesKilled}
	}

	version := ExtractClaudeVersion(fileContent)

	isJS := strings.HasSuffix(claudePath, ".js")
	var result patchContent
	if isJS {
		result = doPatchContentJs(fileContent)
	} else {
		result = doPatchContentBinary(fileContent)
	}

	if result.alreadyPatched {
		return PatchResult{
			Success:         true,
			AlreadyPatched:  true,
			PatchedPath:     claudePath,
			ProcessesKilled: processesKilled,
			Version:         version,
		}
	}

	if !result.success || result.content == "" {
		return PatchResult{
			Success:         false,
			Message:         result.message,
			ProcessesKilled: processesKilled,
			Version:         version,
		}
	}

	backupPath := claudePath + imeBackupExtension
	if err := imeCopyFile(claudePath, backupPath); err != nil {
		return PatchResult{
			Success:         false,
			Message:         fmt.Sprintf("Failed to create backup: %v", err),
			ProcessesKilled: processesKilled,
		}
	}

	if err := writeFileLatin1(claudePath, result.content); err != nil {
		msg := fmt.Sprintf("Failed to write patched file: %v", err)
		if strings.Contains(err.Error(), "used by another process") || strings.Contains(err.Error(), "busy") {
			msg = "File is locked. Please close Claude Code and try again."
		}
		return PatchResult{
			Success:         false,
			Message:         msg,
			ProcessesKilled: processesKilled,
		}
	}

	return PatchResult{
		Success:         true,
		AlreadyPatched:  false,
		PatchedPath:     claudePath,
		ProcessesKilled: processesKilled,
		Version:         version,
		Message:         "Patch applied successfully",
	}
}

func doPatchContentJs(content string) patchContent {
	if strings.Contains(content, imeDork) {
		return patchContent{success: true, alreadyPatched: true}
	}
	if !strings.Contains(content, "match") {
		return patchContent{success: false, message: "Invalid file: No match() found"}
	}
	if !strings.Contains(content, `\x7f`) {
		return patchContent{success: false, message: "Invalid file: No backspace pattern found"}
	}
	newContent := applyIMEPatterns(content)
	if newContent == content {
		return patchContent{success: false, message: "Patch failed: no match found. Claude Code may have updated."}
	}
	if !strings.Contains(newContent, imeDork) {
		return patchContent{success: false, message: "Patch validation failed: marker not found"}
	}
	return patchContent{success: true, alreadyPatched: false, content: newContent}
}

func doPatchContentBinary(content string) patchContent {
	if strings.Contains(content, imeDork) {
		return patchContent{success: true, alreadyPatched: true}
	}
	if !strings.Contains(content, "match") || !strings.Contains(content, `\x7f`) {
		return patchContent{success: false, message: "Invalid binary: No backspace pattern found"}
	}
	newContent := applyIMEPatterns(content)
	if newContent == content {
		return patchContent{success: false, message: "Patch failed: no match found"}
	}
	newContent = adjustBunPragma(content, newContent)
	return patchContent{success: true, alreadyPatched: false, content: newContent}
}

func applyIMEPatterns(content string) string {
	matches := reIMEPattern.FindStringSubmatch(content)
	if matches == nil {
		return content
	}

	// Extract named groups from the regex match
	groupNames := reIMEPattern.SubexpNames()
	groups := make(map[string]string)
	for i, name := range groupNames {
		if name != "" && i < len(matches) {
			groups[name] = matches[i]
		}
	}

	m0 := groups["m0"]
	m1 := groups["m1"]
	m2 := groups["m2"]
	var0 := groups["var0"]
	var2 := groups["var2"]

	if m0 == "" || m1 == "" || m2 == "" || var0 == "" || var2 == "" {
		return content
	}

	// Generate the fix with the new wrapping structure
	fix := generateVietnameseFix(var0, var2, m1)

	// Replace the pattern: m0 + original_conditional + m2
	// becomes: m0 + fix + m2 (where fix wraps the conditional)
	originalPattern := m0 + m1 + m2
	newPattern := m0 + fix + m2

	return strings.Replace(content, originalPattern, newPattern, 1)
}

func generateVietnameseFix(var0, var2, m1 string) string {
	return fmt.Sprintf(
		"%s\nlet _vn = %s.replace(/\\x7f/g, \"\");\nif (_vn.length > 0) {\n  for (const _c of _vn) %s = %s.insert(_c);\n  %s\n}",
		imeDork, var0, var2, var2, m1,
	)
}

func adjustBunPragma(original, patched string) string {
	dorkIdx := strings.Index(patched, imeDork)
	if dorkIdx < 0 {
		return patched
	}

	// Calculate the offset difference
	diff := len(patched) - len(original)
	if diff == 0 {
		return patched
	}

	// Find the Bun pragma header in the patched content
	pragmaPrefix := "// @bun "
	pragmaIdx := strings.Index(patched[:dorkIdx], pragmaPrefix)
	if pragmaIdx < 0 {
		return patched
	}

	// Find the end of the pragma line (next newline after pragma start)
	pragmaStart := pragmaIdx + len(pragmaPrefix)
	newlineIdx := strings.Index(patched[pragmaStart:], "\n")
	if newlineIdx < 0 {
		return patched
	}

	// The pragma value ends at the newline
	pragmaValueEnd := pragmaStart + newlineIdx

	// If our diff would cause the pragma to point past our dork marker,
	// we need to adjust the pragma value
	if pragmaValueEnd > dorkIdx {
		// Adjust the pragma value by truncating the excess
		adjustedPragmaEnd := pragmaStart + (pragmaValueEnd - pragmaStart - diff)
		if adjustedPragmaEnd > pragmaStart {
			return patched[:pragmaValueEnd] + patched[pragmaValueEnd+diff:]
		}
	}

	return patched
}

func (v *VietnameseIMEService) RestoreFromBackup() RestoreResult {
	claudePath := v.FindClaudePath()
	if claudePath == "" {
		return RestoreResult{Success: false, Message: "Claude Code not found"}
	}
	backupPath := claudePath + imeBackupExtension
	if !imeFileExists(backupPath) {
		return RestoreResult{
			Success: false,
			Message: "No backup found. File may not have been patched or backup was deleted.",
		}
	}
	content, err := readFileLatin1(backupPath)
	if err != nil || len(content) == 0 {
		return RestoreResult{Success: false, Message: "Backup file is corrupted (empty)"}
	}
	if err := imeCopyFile(backupPath, claudePath); err != nil {
		return RestoreResult{Success: false, Message: fmt.Sprintf("Restore failed: %v", err)}
	}
	return RestoreResult{
		Success:    true,
		Message:    "Successfully restored original file",
		BackupPath: backupPath,
	}
}

func (v *VietnameseIMEService) ValidatePatch() PatchValidation {
	claudePath := v.FindClaudePath()
	if claudePath == "" {
		return PatchValidation{
			IsValid:     false,
			IsPatched:   false,
			Issues:      []string{"Claude Code not found"},
			Suggestions: []string{"Install Claude Code first"},
		}
	}
	content, err := readFileLatin1(claudePath)
	if err != nil {
		return PatchValidation{
			IsValid:     false,
			IsPatched:   false,
			Issues:      []string{fmt.Sprintf("Validation failed: %v", err)},
			Suggestions: []string{"Ensure Claude Code is installed correctly"},
		}
	}
	isPatched := strings.Contains(content, imeDork)
	var issues, suggestions []string
	if !isPatched {
		issues = append(issues, "File is not patched")
		suggestions = append(suggestions, "Run ApplyVietnameseImePatch() to fix Vietnamese IME")
	}
	if !imeFileExists(claudePath + imeBackupExtension) {
		issues = append(issues, "No backup available")
		suggestions = append(suggestions, "Consider creating a backup before patching")
	}
	return PatchValidation{
		IsValid:     len(issues) == 0,
		IsPatched:   isPatched,
		Issues:      issues,
		Suggestions: suggestions,
	}
}

// KillClaudeProcessesResult is the result of killing Claude processes.
type KillClaudeProcessesResult struct {
	Success bool
	Count   int
	Message string
}

func (v *VietnameseIMEService) KillClaudeProcesses() KillClaudeProcessesResult {
	if runtime.GOOS != "windows" {
		return KillClaudeProcessesResult{Success: true, Count: 0}
	}
	cmd := exec.Command("taskkill", "/F", "/IM", "claude.exe")
	cmd.SysProcAttr = platform.HiddenWindowAttr()
	out, err := cmd.Output()
	output := string(out)
	if err != nil {
		if strings.Contains(output, "No running instance") ||
			strings.Contains(output, "not running") ||
			strings.Contains(err.Error(), "128") {
			return KillClaudeProcessesResult{Success: true, Count: 0, Message: "No Claude processes running"}
		}
		return KillClaudeProcessesResult{
			Success: false, Count: 0,
			Message: "Failed to close Claude processes. Close them manually.",
		}
	}
	count := strings.Count(output, "Successfully terminated")
	if count == 0 {
		count = 1
	}
	return KillClaudeProcessesResult{
		Success: true, Count: count,
		Message: fmt.Sprintf("Closed %d Claude process(es)", count),
	}
}

const imeSettingsKey = "vietnamese-ime-settings"

func (v *VietnameseIMEService) GetIMESettings() IMESettings {
	if v.store == nil {
		return IMESettings{Enabled: false, AutoPatch: false}
	}
	raw, err := v.store.GetRaw(imeSettingsKey)
	if err != nil {
		return IMESettings{Enabled: false, AutoPatch: false}
	}
	var settings IMESettings
	if json.Unmarshal([]byte(raw), &settings) != nil {
		return IMESettings{Enabled: false, AutoPatch: false}
	}
	return settings
}

func (v *VietnameseIMEService) SaveIMESettings(settings IMESettings) Result {
	if v.store == nil {
		return Result{Success: false, Error: "store not initialized"}
	}
	return v.store.SetValue(imeSettingsKey, settings)
}

// ============================================================================
// File I/O helpers
// ============================================================================

func readFileLatin1(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	runes := make([]rune, len(data))
	for i, b := range data {
		runes[i] = rune(b)
	}
	return string(runes), nil
}

func writeFileLatin1(path, content string) error {
	runes := []rune(content)
	data := make([]byte, len(runes))
	for i, r := range runes {
		data[i] = byte(r & 0xFF)
	}
	return os.WriteFile(path, data, 0644)
}

func imeCopyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

func imeFileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

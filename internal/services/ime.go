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
	reVar0Pattern      = regexp.MustCompile(`([\w$]+)\.match\(/\\x7f/g\)`)
	reVar2Pattern      = regexp.MustCompile(`([\w$]+)\.text\s*!==\s*([\w$]+)\.text`)
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
		out, err := exec.Command(name, args...).Output()
		if err != nil {
			return ""
		}
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		if len(lines) > 0 {
			return strings.TrimSpace(lines[0])
		}
		return ""
	}

	fileExistsFn := func(p string) bool {
		if p == "" {
			return false
		}
		_, err := os.Stat(p)
		return err == nil
	}

	if isWin {
		if p := run("where", "claude"); fileExistsFn(p) {
			return p
		}
	} else {
		if p := run("which", "claude"); fileExistsFn(p) {
			if resolved, err := filepath.EvalSymlinks(p); err == nil {
				return resolved
			}
			return p
		}
	}

	if p := run("bun", "which", "claude"); fileExistsFn(p) {
		return p
	}

	bunInstall := os.Getenv("BUN_INSTALL")
	if bunInstall == "" {
		bunInstall = filepath.Join(platform.GetUserHome(), ".bun")
	}

	claudeExe := "claude"
	if isWin {
		claudeExe = "claude.exe"
	}
	bunPaths := []string{
		filepath.Join(bunInstall, "bin", claudeExe),
		filepath.Join(bunInstall, "bin", "claude.cmd"),
		filepath.Join(bunInstall, "install", "global", "node_modules", "@anthropic-ai", "claude-code", "cli.js"),
	}
	for _, p := range bunPaths {
		if fileExistsFn(p) {
			return p
		}
	}

	if npmRoot := run("npm", "root", "-g"); npmRoot != "" {
		cliPath := filepath.Join(npmRoot, "@anthropic-ai", "claude-code", "cli.js")
		if fileExistsFn(cliPath) {
			return cliPath
		}
	}

	if isWin {
		var wsPaths []string
		appdata := os.Getenv("APPDATA")
		localappdata := os.Getenv("LOCALAPPDATA")
		for _, base := range []string{appdata, localappdata} {
			if base != "" {
				wsPaths = append(wsPaths, filepath.Join(base, "npm", "node_modules", "@anthropic-ai", "claude-code", "cli.js"))
			}
		}
		if nvmHome := os.Getenv("NVM_HOME"); nvmHome != "" {
			entries, err := os.ReadDir(nvmHome)
			if err == nil {
				for _, e := range entries {
					wsPaths = append(wsPaths, filepath.Join(nvmHome, e.Name(), "node_modules", "@anthropic-ai", "claude-code", "cli.js"))
				}
			}
		}
		for _, p := range wsPaths {
			if fileExistsFn(p) {
				return p
			}
		}
	}

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
		return PatchStatus{IsPatched: false, ClaudePath: "", HasBackup: false, InstalledVia: "unknown"}
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
		IsPatched:    isPatched,
		ClaudePath:   claudePath,
		HasBackup:    hasBackup,
		InstalledVia: installedVia,
		Version:      version,
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
	backspaceIdx := findBackspacePattern(content)
	if backspaceIdx < 0 {
		return content
	}
	var0, var2 := extractVarNames(content, backspaceIdx)
	if var0 == "" || var2 == "" {
		return content
	}
	fix := generateVietnameseFix(var0, var2)
	var0MatchStart := findVarMatchStart(content, var0, backspaceIdx)
	if var0MatchStart < 0 {
		var0MatchStart = backspaceIdx
	}
	return content[:var0MatchStart] + fix + "\n" + content[var0MatchStart:]
}

func generateVietnameseFix(var0, var2 string) string {
	return fmt.Sprintf(
		"%s\nlet _vn = %s.replace(/\\x7f/g, \"\");\nif (_vn.length > 0) {\n  for (const _c of _vn) %s = %s.insert(_c);\n}",
		imeDork, var0, var2, var2,
	)
}

func findBackspacePattern(content string) int {
	for _, p := range []string{`match(/\x7f/g)`, `match(/\\x7f/g)`} {
		if idx := strings.Index(content, p); idx >= 0 {
			return idx
		}
	}
	return -1
}

func extractVarNames(content string, backspaceIdx int) (string, string) {
	start := backspaceIdx - 200
	if start < 0 {
		start = 0
	}
	end := backspaceIdx + 500
	if end > len(content) {
		end = len(content)
	}
	window := content[start:end]
	m0 := reVar0Pattern.FindStringSubmatch(window)
	if len(m0) < 2 {
		return "", ""
	}
	var0 := m0[1]
	m2 := reVar2Pattern.FindStringSubmatch(window)
	if len(m2) < 3 {
		return var0, ""
	}
	return var0, m2[2]
}

func findVarMatchStart(content, var0 string, near int) int {
	target := var0 + ".match("
	start := near - 500
	if start < 0 {
		start = 0
	}
	sub := content[start:near]
	idx := strings.LastIndex(sub, target)
	if idx < 0 {
		return -1
	}
	lineStart := strings.LastIndex(sub[:idx], "\n")
	if lineStart < 0 {
		return start + idx
	}
	return start + lineStart + 1
}

func adjustBunPragma(original, patched string) string {
	pragma := "// @bun "
	dorkIdx := strings.Index(patched, imeDork)
	if dorkIdx < 0 {
		return patched
	}
	diff := len(patched) - len(original)
	if diff == 0 {
		return patched
	}
	for i := dorkIdx - 1; i >= 0; i-- {
		if patched[i] == '\x00' && i+len(pragma) < len(patched) {
			if patched[i+1:i+1+len(pragma)] == pragma {
				for k := i + 1 + len(pragma); k < dorkIdx; k++ {
					if patched[k] == '\n' && k+1 < len(patched) && patched[k+1] == '/' && k+2 < len(patched) && patched[k+2] == '/' {
						sliceStart := k + 3
						if sliceStart+diff <= len(patched) {
							patched = patched[:sliceStart] + patched[sliceStart+diff:]
						}
						return patched
					}
				}
				break
			}
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
	out, err := exec.Command("taskkill", "/F", "/IM", "claude.exe").Output()
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

const imeSettingsKey = "ime:settings"

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

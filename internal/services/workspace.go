package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tidwall/buntdb"
)

// ============================================================================
// WorkspaceService — replaces workspace.handlers.ts
// ============================================================================

const workspacePrefix = "workspace:"

// WorkspaceService manages workspace CRUD operations using BuntDB.
type WorkspaceService struct {
	store       *StoreService
	terminalSvc *TerminalService
}

// NewWorkspaceService creates a new WorkspaceService.
func NewWorkspaceService() *WorkspaceService {
	return &WorkspaceService{}
}

// Init wires store and terminal service dependencies.
func (w *WorkspaceService) Init(store *StoreService, terminal *TerminalService) {
	w.store = store
	w.terminalSvc = terminal
}

// GetWorkspaces returns all workspaces sorted by createdAt.
func (w *WorkspaceService) GetWorkspaces() []Workspace {
	results := []Workspace{}

	w.store.db.View(func(tx *buntdb.Tx) error {
		return tx.AscendKeys(workspacePrefix+"*", func(key, val string) bool {
			var ws Workspace
			if json.Unmarshal([]byte(val), &ws) == nil {
				results = append(results, ws)
			}
			return true
		})
	})

	sortWorkspaces(results)
	return results
}

// CreateWorkspace creates a new workspace.
func (w *WorkspaceService) CreateWorkspace(config Workspace) (Workspace, error) {
	if config.ID == "" {
		config.ID = uuid.New().String()
	}
	now := time.Now().UnixMilli()
	config.CreatedAt = now
	config.UpdatedAt = now

	if config.Name == "" {
		config.Name = fmt.Sprintf("Workspace %d", now)
	}

	key := workspacePrefix + config.ID
	res := w.store.SetValue(key, config)
	if !res.Success {
		return Workspace{}, fmt.Errorf("%s", res.Error)
	}
	return config, nil
}

// UpdateWorkspace updates an existing workspace.
func (w *WorkspaceService) UpdateWorkspace(workspace Workspace) (Workspace, error) {
	workspace.UpdatedAt = time.Now().UnixMilli()
	key := workspacePrefix + workspace.ID
	res := w.store.SetValue(key, workspace)
	if !res.Success {
		return Workspace{}, fmt.Errorf("%s", res.Error)
	}
	return workspace, nil
}

// DeleteWorkspace removes a workspace and kills its associated terminals.
func (w *WorkspaceService) DeleteWorkspace(id string) Result {
	if id == "" {
		return Result{Success: false, Error: "workspace ID is required"}
	}

	if w.terminalSvc != nil {
		w.terminalSvc.CleanupWorkspaceTerminals(id)
	}

	key := workspacePrefix + id
	return w.store.DeleteValue(key)
}

// GetWorkspace returns a single workspace by ID.
func (w *WorkspaceService) GetWorkspace(id string) (Workspace, error) {
	key := workspacePrefix + id
	raw, err := w.store.GetRaw(key)
	if err != nil {
		return Workspace{}, fmt.Errorf("workspace not found: %s", id)
	}
	var ws Workspace
	if err := json.Unmarshal([]byte(raw), &ws); err != nil {
		return Workspace{}, err
	}
	return ws, nil
}

// PatchWorkspace applies a partial update to a workspace.
func (w *WorkspaceService) PatchWorkspace(id string, patch map[string]interface{}) (Workspace, error) {
	ws, err := w.GetWorkspace(id)
	if err != nil {
		return Workspace{}, err
	}

	current, _ := json.Marshal(ws)
	var currentMap map[string]interface{}
	json.Unmarshal(current, &currentMap)

	for k, v := range patch {
		currentMap[k] = v
	}
	currentMap["updatedAt"] = time.Now().UnixMilli()

	merged, _ := json.Marshal(currentMap)
	var updated Workspace
	if err := json.Unmarshal(merged, &updated); err != nil {
		return Workspace{}, err
	}

	return w.UpdateWorkspace(updated)
}

// sortWorkspaces sorts workspaces by createdAt ascending.
func sortWorkspaces(ws []Workspace) {
	for i := 1; i < len(ws); i++ {
		for j := i; j > 0 && ws[j].CreatedAt < ws[j-1].CreatedAt; j-- {
			ws[j], ws[j-1] = ws[j-1], ws[j]
		}
	}
}

// ============================================================================
// TemplateService — replaces template.handlers.ts
// ============================================================================

const templatePrefix = "template:"

// TemplateService manages layout template CRUD operations.
type TemplateService struct {
	store *StoreService
}

// NewTemplateService creates a new TemplateService.
func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

// Init wires the store dependency.
func (t *TemplateService) Init(store *StoreService) {
	t.store = store
}

// GetTemplates returns all saved templates sorted by createdAt.
func (t *TemplateService) GetTemplates() []Template {
	results := []Template{}

	t.store.db.View(func(tx *buntdb.Tx) error {
		return tx.AscendKeys(templatePrefix+"*", func(key, val string) bool {
			var tmpl Template
			if json.Unmarshal([]byte(val), &tmpl) == nil {
				results = append(results, tmpl)
			}
			return true
		})
	})

	for i := 1; i < len(results); i++ {
		for j := i; j > 0 && results[j].CreatedAt < results[j-1].CreatedAt; j-- {
			results[j], results[j-1] = results[j-1], results[j]
		}
	}
	return results
}

// SaveTemplate saves (create or update) a template.
func (t *TemplateService) SaveTemplate(tmpl Template) (Template, error) {
	if tmpl.ID == "" {
		tmpl.ID = uuid.New().String()
	}
	if tmpl.CreatedAt == 0 {
		tmpl.CreatedAt = time.Now().UnixMilli()
	}

	key := templatePrefix + tmpl.ID
	res := t.store.SetValue(key, tmpl)
	if !res.Success {
		return Template{}, fmt.Errorf("%s", res.Error)
	}
	return tmpl, nil
}

// DeleteTemplate removes a template by ID.
func (t *TemplateService) DeleteTemplate(id string) Result {
	if id == "" {
		return Result{Success: false, Error: "template ID is required"}
	}
	key := templatePrefix + id
	return t.store.DeleteValue(key)
}

// ============================================================================
// TerminalHistoryService — replaces terminal-history.handlers.ts
// ============================================================================

const historyPrefix = "history:"

// TerminalHistoryService manages command history per terminal.
type TerminalHistoryService struct {
	store *StoreService
}

// NewTerminalHistoryService creates a new TerminalHistoryService.
func NewTerminalHistoryService() *TerminalHistoryService {
	return &TerminalHistoryService{}
}

// Init wires the store dependency.
func (h *TerminalHistoryService) Init(store *StoreService) {
	h.store = store
}

// GetTerminalHistory returns command history for a terminal.
func (h *TerminalHistoryService) GetTerminalHistory(terminalID string) []HistoryEntry {
	key := historyPrefix + terminalID
	raw, err := h.store.GetRaw(key)
	if err != nil {
		return []HistoryEntry{}
	}
	var entries []HistoryEntry
	if json.Unmarshal([]byte(raw), &entries) != nil {
		return []HistoryEntry{}
	}
	return entries
}

// SaveTerminalHistory saves command history for a terminal.
func (h *TerminalHistoryService) SaveTerminalHistory(terminalID string, history []HistoryEntry) Result {
	if terminalID == "" {
		return Result{Success: false, Error: "terminal ID is required"}
	}
	key := historyPrefix + terminalID
	return h.store.SetValue(key, history)
}

// AddHistoryEntry appends a single entry to terminal history (deduplicated, max 500).
func (h *TerminalHistoryService) AddHistoryEntry(terminalID string, command string) Result {
	existing := h.GetTerminalHistory(terminalID)

	filtered := existing[:0]
	for _, e := range existing {
		if !strings.EqualFold(e.Command, command) {
			filtered = append(filtered, e)
		}
	}

	entry := HistoryEntry{
		Command:   command,
		Timestamp: time.Now().UnixMilli(),
	}
	filtered = append(filtered, entry)

	if len(filtered) > 500 {
		filtered = filtered[len(filtered)-500:]
	}

	return h.SaveTerminalHistory(terminalID, filtered)
}

// ClearTerminalHistory clears all history for a terminal.
func (h *TerminalHistoryService) ClearTerminalHistory(terminalID string) Result {
	key := historyPrefix + terminalID
	return h.store.DeleteValue(key)
}

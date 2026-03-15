<script lang="ts">
  import { workspaceStore } from '../../stores';
  import { untrack } from 'svelte';
  import type { Template, WorkspaceCreationConfig } from '../../types/workspace';
  import type { AgentType, AgentConfig } from '../../types/agent';
  import { backendAPI } from '../../services/wails-bridge';
  import IconPicker from '../ui/IconPicker.svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    editingWorkspace?: any;
  }

  let { isOpen, onClose, editingWorkspace = null }: Props = $props();

  const emojis = ['📁', '📂', '💼', '🗂️', '📊', '📈', '💻', '⚡', '🔥', '🚀', '🎯', '⭐', '🔷', '🔶', '💎', '🎨'];

  // Agent configurations with proper AgentType values
  const AGENT_CONFIGS: { type: AgentType; name: string; icon: string }[] = [
    { type: 'claude-code', name: 'Claude Code', icon: '🟣' },
    { type: 'opencode', name: 'OpenCode', icon: '🔵' },
    { type: 'droid', name: 'Droid', icon: '🟢' },
    { type: 'codex', name: 'Codex', icon: '🟡' },
    { type: 'cursor', name: 'Cursor', icon: '🔷' },
    { type: 'gemini-cli', name: 'Gemini CLI', icon: '💎' },
    { type: 'aider', name: 'Aider', icon: '🟠' },
    { type: 'goose', name: 'Goose', icon: '🪿' },
    { type: 'oh-my-pi', name: 'Oh My Pi', icon: '🥧' },
    { type: 'warp', name: 'Warp', icon: '⚡' },
    { type: 'amp', name: 'Amp', icon: '🔌' },
    { type: 'kiro', name: 'Kiro', icon: '🎯' },
  ];

  const builtinTemplates = [
    { id: 'single', name: 'Single', columns: 1, rows: 1, icon: '①' },
    { id: 'dual', name: 'Dual', columns: 2, rows: 1, icon: '②' },
    { id: 'quad', name: 'Quad', columns: 2, rows: 2, icon: '④' },
    { id: 'six', name: 'Six', columns: 3, rows: 2, icon: '⑥' },
    { id: 'eight', name: 'Eight', columns: 4, rows: 2, icon: '⑧' },
  ];

  // Step state
  let currentStep = $state(1);
  const totalSteps = 3;
  const stepLabels = ['Basic Info', 'Layout', 'Agents'];

  let selectedTemplate = $state<typeof builtinTemplates[0] | null>(null);
  let workspaceName = $state('My Workspace');
  let selectedIcon = $state(emojis[0]);
  let workingDir = $state('');
  let columns = $state(2);
  let rows = $state(2);

  // Agent assignments for each slot (index -> AgentType | null)
  let slotAssignments = $state<(AgentType | null)[]>([]);

  // Hover state for interactive preview
  let hoveredSlot = $state<number | null>(null);

  // Step validation
  function canProceedToStep(step: number): boolean {
    if (step === 2) {
      return workspaceName.trim().length > 0;
    }
    return true;
  }

  function nextStep() {
    if (currentStep < totalSteps && canProceedToStep(currentStep + 1)) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  function goToStep(step: number) {
    // Only allow going to completed steps or current step + 1 if valid
    if (step <= currentStep || (step === currentStep + 1 && canProceedToStep(step))) {
      currentStep = step;
    }
  }

  $effect(() => {
    if (editingWorkspace) {
      workspaceName = editingWorkspace.name;
      selectedIcon = editingWorkspace.icon || emojis[0];
      columns = editingWorkspace.columns;
      rows = editingWorkspace.rows;
      selectedTemplate = null;
    }
  });

  $effect(() => {
    // Reset slot assignments when layout changes
    const totalSlots = columns * rows;
    // Use untrack to prevent infinite loop - we're writing to slotAssignments
    const currentAssignments = untrack(() => slotAssignments);
    const newAssignments = Array(totalSlots).fill(null);
    for (let i = 0; i < Math.min(currentAssignments.length, totalSlots); i++) {
      newAssignments[i] = currentAssignments[i];
    }
    slotAssignments = newAssignments;
  });

  function selectTemplate(template: typeof builtinTemplates[0]) {
    selectedTemplate = template;
    columns = template.columns;
    rows = template.rows;
  }

  function handleDragStart(e: DragEvent, agentType: AgentType) {
    e.dataTransfer?.setData('application/json', JSON.stringify({ type: agentType }));
    e.dataTransfer!.effectAllowed = 'copy';
  }

  function handleDropOnSlot(e: DragEvent, slotIndex: number) {
    e.preventDefault();
    const data = e.dataTransfer?.getData('application/json');
    if (data) {
      const { type } = JSON.parse(data);
      slotAssignments[slotIndex] = type as AgentType;
      slotAssignments = [...slotAssignments];
    }
  }

  // Click slot to cycle through agents: empty -> first agent -> second agent -> ... -> empty
  function handleSlotClick(slotIndex: number) {
    const currentAgent = slotAssignments[slotIndex];
    if (currentAgent === null) {
      // Assign first agent
      slotAssignments[slotIndex] = AGENT_CONFIGS[0].type;
    } else {
      // Find next agent or clear
      const currentIndex = AGENT_CONFIGS.findIndex(a => a.type === currentAgent);
      if (currentIndex === -1 || currentIndex === AGENT_CONFIGS.length - 1) {
        // Clear slot if at end
        slotAssignments[slotIndex] = null;
      } else {
        // Assign next agent
        slotAssignments[slotIndex] = AGENT_CONFIGS[currentIndex + 1].type;
      }
    }
    slotAssignments = [...slotAssignments];
  }

  function handleAutoDistribute() {
    // Distribute agents evenly across slots
    const totalSlots = columns * rows;
    const agentTypes = AGENT_CONFIGS.map(a => a.type);

    slotAssignments = slotAssignments.map((_, i) => {
      return agentTypes[i % agentTypes.length];
    });
  }

  function clearAllAgents() {
    slotAssignments = Array(columns * rows).fill(null);
  }

  async function browseDirectory() {
    try {
      const result = await (backendAPI as any).showOpenDialog?.({
        title: 'Select Working Directory',
        properties: ['openDirectory'],
        defaultPath: workingDir || undefined,
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        workingDir = result.filePaths[0];
      }
    } catch (err) {
      console.error('Failed to browse directory:', err);
      // Fallback: use native file input
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const path = (files[0] as any).path || files[0].webkitRelativePath;
          if (path) {
            workingDir = path.split('/').slice(0, -1).join('/');
          }
        }
      };
      input.click();
    }
  }

  async function handleDirectoryKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && workingDir.trim()) {
      e.preventDefault();
      try {
        const resolved = await backendAPI.resolvePath(workingDir);
        if (resolved) {
          workingDir = resolved;
        } else {
          // Path doesn't exist - could show error here
          console.warn('Path does not exist:', workingDir);
        }
      } catch (err) {
        console.error('Failed to resolve path:', err);
      }
    }
  }

  async function handleCreateWorkspace() {
    // Build agent assignments for slots that have agents
    const agentAssignments: Record<string, AgentConfig> = {};
    slotAssignments.forEach((agentType, index) => {
      if (agentType) {
        agentAssignments[`term-${index}`] = {
          type: agentType,
          enabled: true,
        };
      }
    });

    const config: WorkspaceCreationConfig = {
      name: workspaceName,
      columns,
      rows,
      cwd: workingDir || './',
      icon: selectedIcon,
      agentAssignments,
    };

    try {
      if (editingWorkspace) {
        await workspaceStore.updateWorkspace(editingWorkspace.id, {
          name: workspaceName,
          icon: selectedIcon,
          columns,
          rows,
        });
      } else {
        await workspaceStore.addWorkspace(config);
      }
      onClose();
      resetForm();
    } catch (err) {
      console.error('Failed to create/update workspace:', err);
      alert('Failed to create workspace: ' + (err as Error).message);
    }
  }

  function resetForm() {
    currentStep = 1;
    selectedTemplate = null;
    workspaceName = 'My Workspace';
    selectedIcon = emojis[0];
    workingDir = '';
    columns = 2;
    rows = 2;
    slotAssignments = [];
    hoveredSlot = null;
  }

  function handleClose() {
    onClose();
    resetForm();
  }

  function getAgentCount(type: AgentType): number {
    return slotAssignments.filter(a => a === type).length;
  }

  function incrementAgent(type: AgentType) {
    // Find first empty slot
    const emptyIndex = slotAssignments.findIndex(a => a === null);
    if (emptyIndex !== -1) {
      slotAssignments[emptyIndex] = type;
      slotAssignments = [...slotAssignments];
    }
  }

  function decrementAgent(type: AgentType) {
    // Find last slot with this agent
    const lastIndex = slotAssignments.lastIndexOf(type);
    if (lastIndex !== -1) {
      slotAssignments[lastIndex] = null;
      slotAssignments = [...slotAssignments];
    }
  }

  function getAgentIcon(type: AgentType | null): string {
    if (!type) return '';
    return AGENT_CONFIGS.find(a => a.type === type)?.icon || '';
  }

  function getAgentName(type: AgentType | null): string {
    if (!type) return '';
    return AGENT_CONFIGS.find(a => a.type === type)?.name || '';
  }

  // Calculate preview grid dimensions
  const previewCols = $derived(Math.min(columns, 4));
  const previewRows = $derived(Math.ceil(slotAssignments.length / previewCols));

  // Dynamic slot sizing based on slot count - no scroll
  const slotMinHeight = $derived.by(() => {
    const count = slotAssignments.length;
    if (count <= 4) return '70px';
    if (count <= 6) return '55px';
    if (count <= 9) return '45px';
    if (count <= 12) return '38px';
    return '32px';
  });

  const slotGap = $derived.by(() => {
    const count = slotAssignments.length;
    if (count <= 4) return '10px';
    if (count <= 6) return '8px';
    if (count <= 9) return '6px';
    return '4px';
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleClose} role="dialog" aria-modal="true" tabindex="-1">
    <div class="creation-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <!-- Header -->
      <div class="modal-header">
        <h3>{editingWorkspace ? 'Edit Workspace' : 'Create New Workspace'}</h3>
        <button class="close-btn" onclick={handleClose} aria-label="Close">×</button>
      </div>

      <!-- Step Indicator -->
      <div class="step-indicator">
        {#each Array(totalSteps) as _, i}
          {@const stepNum = i + 1}
          {@const isActive = currentStep === stepNum}
          {@const isCompleted = currentStep > stepNum}
          <div class="step-item">
            <button
              class="step-dot"
              class:active={isActive}
              class:completed={isCompleted}
              class:pending={!isActive && !isCompleted}
              onclick={() => goToStep(stepNum)}
              disabled={stepNum > currentStep && !canProceedToStep(stepNum)}
              aria-label={`Step ${stepNum}: ${stepLabels[i]}`}
            >
              {#if isCompleted}
                ✓
              {:else}
                {stepNum}
              {/if}
            </button>
            <span class="step-label" class:active={isActive} class:completed={isCompleted}>{stepLabels[i]}</span>
          </div>
          {#if stepNum < totalSteps}
            <span class="step-connector" class:completed={isCompleted}></span>
          {/if}
        {/each}
      </div>

      <!-- Step Content -->
      <div class="step-content">
        <!-- Step 1: Basic Information -->
        {#if currentStep === 1}
          <div class="step-panel">
            <h4 class="step-title">Basic Information</h4>
            <div class="step-form">
              <div class="field-group">
                <label for="ws-name">Workspace Name *</label>
                <input
                  type="text"
                  id="ws-name"
                  bind:value={workspaceName}
                  placeholder="Enter workspace name"
                  class="text-input"
                  class:error={workspaceName.trim().length === 0}
                />
                {#if workspaceName.trim().length === 0}
                  <span class="field-error">Workspace name is required</span>
                {/if}
              </div>

              <div class="field-row">
                <div class="field-group icon-group">
                  <label for="ws-icon">Icon</label>
                  <div class="icon-selector">
                    <IconPicker
                      value={selectedIcon}
                      options={emojis}
                      onSelect={(emoji) => selectedIcon = emoji}
                    />
                  </div>
                </div>
              </div>

              <div class="field-group">
                <label for="ws-dir">Working Directory</label>
                <div class="dir-input-row">
                  <input
                    type="text"
                    id="ws-dir"
                    bind:value={workingDir}
                    placeholder="./"
                    class="text-input"
                    onkeydown={handleDirectoryKeyDown}
                  />
                  <button class="btn-browse" onclick={browseDirectory}>Browse</button>
                </div>
                <span class="field-hint">Type path and press Enter to resolve (supports cd, ~, relative paths)</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Step 2: Template & Layout -->
        {#if currentStep === 2}
          <div class="step-panel step-layout">
            <!-- Top row: Templates + Custom Controls -->
            <div class="layout-top">
              <div class="templates-section">
                <h4 class="step-title">Choose Template</h4>
                <div class="template-list-horizontal">
                  {#each builtinTemplates as template}
                    <button
                      class="template-card compact"
                      class:selected={selectedTemplate?.id === template.id}
                      onclick={() => selectTemplate(template)}
                    >
                      <span class="template-icon">{template.icon}</span>
                      <span class="template-name">{template.name}</span>
                      <span class="template-layout">{template.columns}×{template.rows}</span>
                    </button>
                  {/each}
                </div>
              </div>
              <div class="custom-layout-inline">
                <h5 class="subsection-title">Custom</h5>
                <div class="custom-controls-inline">
                  <div class="control-group">
                    <label for="cols-value">Cols</label>
                    <div class="stepper small">
                      <button onclick={() => columns = Math.max(1, columns - 1)} disabled={columns <= 1}>−</button>
                      <span id="cols-value">{columns}</span>
                      <button onclick={() => columns = Math.min(8, columns + 1)} disabled={columns >= 8}>+</button>
                    </div>
                  </div>
                  <div class="control-group">
                    <label for="rows-value">Rows</label>
                    <div class="stepper small">
                      <button onclick={() => rows = Math.max(1, rows - 1)} disabled={rows <= 1}>−</button>
                      <span id="rows-value">{rows}</span>
                      <button onclick={() => rows = Math.min(8, rows + 1)} disabled={rows >= 8}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Large preview filling remaining space -->
            <div class="layout-preview-full">
              <div class="preview-container expand">
                <div class="slots-preview" style="--cols: {previewCols}; --rows: {previewRows}; gap: {slotGap};">
                  {#each slotAssignments as agent, i}
                    <div
                      class="slot"
                      class:assigned={agent !== null}
                      style="min-height: {slotMinHeight};"
                    >
                      {#if agent}
                        {@const agentInfo = AGENT_CONFIGS.find(a => a.type === agent)}
                        <span class="slot-agent">{agentInfo?.icon}</span>
                      {:else}
                        <span class="slot-placeholder">+</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
              <div class="dimensions-display">
                <span>{columns} columns × {rows} rows</span>
                <span class="slot-count">{slotAssignments.length} slots</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Step 3: Agent Assignment -->
        {#if currentStep === 3}
          <div class="step-panel step-agents">
            <div class="agents-left">
              <h4 class="step-title">Agent Palette</h4>
              <div class="agent-list-grid">
                {#each AGENT_CONFIGS as { type, name, icon }}
                  {@const count = getAgentCount(type)}
                  <div
                    class="agent-item-grid"
                    draggable={true}
                    ondragstart={(e) => handleDragStart(e, type)}
                    role="listitem"
                  >
                    <span class="agent-icon-small">{icon}</span>
                    <span class="agent-name-short">{name}</span>
                    <div class="agent-counter">
                      <button
                        class="counter-btn"
                        onclick={() => decrementAgent(type)}
                        disabled={count <= 0}
                      >−</button>
                      <span class="counter-value">{count}</span>
                      <button
                        class="counter-btn"
                        onclick={() => incrementAgent(type)}
                        disabled={count >= columns * rows}
                      >+</button>
                    </div>
                  </div>
                {/each}
              </div>
              <div class="agent-actions-row">
                <button class="btn-action btn-auto" onclick={handleAutoDistribute}>Auto</button>
                <button class="btn-action btn-clear" onclick={clearAllAgents}>Clear</button>
              </div>
            </div>
            <div class="agents-right">
              <h4 class="step-title">Assign Agents to Slots</h4>
              <p class="step-hint">Click slot to cycle, or drag from palette</p>
              <div class="preview-container expand">
                <div class="slots-preview" style="--cols: {previewCols}; --rows: {previewRows}; gap: {slotGap};">
                  {#each slotAssignments as agent, i}
                    <div
                      class="slot"
                      class:assigned={agent !== null}
                      class:hovered={hoveredSlot === i}
                      style="min-height: {slotMinHeight};"
                      onclick={() => handleSlotClick(i)}
                      onmouseenter={() => hoveredSlot = i}
                      onmouseleave={() => hoveredSlot = null}
                      ondragover={(e) => e.preventDefault()}
                      ondrop={(e) => handleDropOnSlot(e, i)}
                      role="button"
                      tabindex="0"
                      onkeydown={(e) => e.key === 'Enter' && handleSlotClick(i)}
                      title={agent ? `Click to cycle, currently: ${getAgentName(agent)}` : 'Click to assign agent'}
                    >
                      {#if agent}
                        {@const agentInfo = AGENT_CONFIGS.find(a => a.type === agent)}
                        <span class="slot-agent">{agentInfo?.icon}</span>
                      {:else}
                        <span class="slot-placeholder">+</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        {#if currentStep === 1}
          <button class="btn-cancel" onclick={handleClose}>Cancel</button>
        {:else}
          <button class="btn-back" onclick={prevStep}>← Back</button>
        {/if}

        {#if currentStep < totalSteps}
          <button
            class="btn-next"
            onclick={nextStep}
            disabled={!canProceedToStep(currentStep + 1)}
          >
            Next →
          </button>
        {:else}
          <button
            class="btn-create"
            onclick={handleCreateWorkspace}
            disabled={!workspaceName.trim()}
          >
            {editingWorkspace ? 'Save Changes' : 'Create Workspace'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ===== Modal Overlay & Container ===== */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 12px;
  }

  .creation-modal {
    background: rgba(30, 30, 46, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    width: 95%;
    max-width: 900px;
    height: 95vh;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(137, 180, 250, 0.15);
    overflow: hidden;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset,
      0 0 40px rgba(137, 180, 250, 0.05);
  }

  /* ===== Header ===== */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(69, 71, 90, 0.4);
    background: rgba(24, 24, 37, 0.98);
    flex-shrink: 0;
  }

  .modal-header h3 {
    margin: 0;
    color: #cdd6f4;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .close-btn {
    background: rgba(69, 71, 90, 0.3);
    border: none;
    color: rgba(166, 173, 200, 0.8);
    font-size: 22px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    transition: all 0.2s ease;
    line-height: 1;
  }

  .close-btn:hover {
    color: #cdd6f4;
    background: rgba(243, 139, 168, 0.2);
    border: 1px solid rgba(243, 139, 168, 0.3);
  }

  /* ===== Step Indicator ===== */
  .step-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(69, 71, 90, 0.4);
    background: rgba(24, 24, 37, 0.6);
    flex-shrink: 0;
  }

  .step-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .step-dot.active {
    background: linear-gradient(135deg, #89b4fa, #7287fd);
    color: #1e1e2e;
    border-color: #89b4fa;
    box-shadow: 0 0 15px rgba(137, 180, 250, 0.4);
  }

  .step-dot.completed {
    background: rgba(137, 180, 250, 0.2);
    color: #89b4fa;
    border-color: rgba(137, 180, 250, 0.5);
  }

  .step-dot.completed:hover {
    background: rgba(137, 180, 250, 0.3);
  }

  .step-dot.pending {
    background: rgba(69, 71, 90, 0.3);
    color: rgba(166, 173, 200, 0.5);
    border-color: rgba(69, 71, 90, 0.5);
    cursor: not-allowed;
  }

  .step-dot:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .step-connector {
    width: 40px;
    height: 2px;
    background: rgba(69, 71, 90, 0.5);
    transition: all 0.2s ease;
  }

  .step-connector.completed {
    background: rgba(137, 180, 250, 0.5);
  }

  /* Step Labels */
  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .step-label {
    font-size: 11px;
    font-weight: 500;
    color: rgba(166, 173, 200, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    transition: all 0.2s ease;
  }

  .step-label.active {
    color: #89b4fa;
    font-weight: 600;
  }

  .step-label.completed {
    color: rgba(137, 180, 250, 0.8);
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .step-panel {
    padding: 16px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }

  .step-title {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: #cdd6f4;
    letter-spacing: 0.02em;
  }

  .step-hint {
    margin: -16px 0 16px;
    font-size: 13px;
    color: rgba(166, 173, 200, 0.7);
  }

  /* ===== Step 1: Basic Information ===== */
  .step-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 500px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-group label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(137, 180, 250, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
  }

  .icon-group {
    width: 80px;
  }

  .text-input {
    padding: 12px 16px;
    background: rgba(49, 50, 68, 0.6);
    border: 1px solid rgba(69, 71, 90, 0.5);
    border-radius: 10px;
    color: #cdd6f4;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: rgba(137, 180, 250, 0.6);
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.15);
  }

  .text-input.error {
    border-color: rgba(243, 139, 168, 0.6);
  }

  .field-error {
    font-size: 12px;
    color: #f38ba8;
  }

  .field-hint {
    font-size: 11px;
    color: var(--color-text-subtext0);
    margin-top: var(--space-1);
    display: block;
  }


  .dir-input-row {
    display: flex;
    gap: 10px;
  }

  .dir-input-row .text-input {
    flex: 1;
  }

  .btn-browse {
    padding: 12px 20px;
    background: rgba(69, 71, 90, 0.6);
    border: 1px solid rgba(137, 180, 250, 0.3);
    border-radius: 10px;
    color: #cdd6f4;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .btn-browse:hover {
    background: rgba(137, 180, 250, 0.2);
    border-color: rgba(137, 180, 250, 0.5);
  }

  /* ===== Step 2 & 3: Layout and Agents ===== */
  .step-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    height: 100%;
  }

  .step-agents {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 16px;
    padding: 16px;
    height: 100%;
  }

  .layout-top {
    display: flex;
    gap: 16px;
    flex-shrink: 0;
    align-items: flex-start;
  }

  .templates-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .template-list-horizontal {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .template-card.compact {
    flex-direction: column;
    padding: 10px 14px;
    min-width: 70px;
    gap: 4px;
    align-items: center;
  }

  .template-card.compact .template-icon {
    font-size: 18px;
  }

  .template-card.compact .template-name {
    font-size: 11px;
    font-weight: 500;
  }

  .template-card.compact .template-layout {
    font-size: 10px;
  }

  .custom-layout-inline {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: rgba(49, 50, 68, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(69, 71, 90, 0.3);
  }

  .custom-layout-inline .subsection-title {
    margin: 0;
    font-size: 11px;
  }

  .custom-controls-inline {
    display: flex;
    gap: 16px;
  }

  .stepper.small button {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .stepper.small span {
    font-size: 13px;
    min-width: 20px;
  }

  .layout-preview-full {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .agents-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  .agents-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .template-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(49, 50, 68, 0.5);
    border: 1px solid rgba(69, 71, 90, 0.5);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .template-card:hover {
    background: rgba(69, 71, 90, 0.6);
    border-color: rgba(137, 180, 250, 0.3);
    transform: translateY(-1px);
  }

  .template-card.selected {
    border-color: rgba(137, 180, 250, 0.8);
    background: rgba(137, 180, 250, 0.15);
    box-shadow: 0 0 15px rgba(137, 180, 250, 0.2);
  }

  .template-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .template-name {
    color: #cdd6f4;
    font-size: 13px;
    font-weight: 500;
  }

  .template-layout {
    color: rgba(108, 112, 134, 0.8);
    font-size: 11px;
  }

  .subsection-title {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(137, 180, 250, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .control-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .control-group label {
    font-size: 12px;
    color: rgba(166, 173, 200, 0.8);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stepper button {
    width: 28px;
    height: 28px;
    background: rgba(69, 71, 90, 0.6);
    border: 1px solid rgba(108, 112, 134, 0.3);
    border-radius: 6px;
    color: #cdd6f4;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.15s ease;
  }

  .stepper button:hover:not(:disabled) {
    background: rgba(137, 180, 250, 0.2);
    border-color: rgba(137, 180, 250, 0.5);
  }

  .stepper button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .stepper span {
    min-width: 24px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: #cdd6f4;
    font-family: var(--font-mono, monospace);
  }

  /* ===== Preview Grid ===== */
  .preview-container {
    flex: 1;
    width: 100%;
    padding: 24px;
    background: rgba(17, 17, 27, 0.8);
    border-radius: 14px;
    border: 1px solid rgba(137, 180, 250, 0.12);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 30px rgba(137, 180, 250, 0.03) inset;
    min-height: 0;
  }
  .preview-container.expand {
    flex: 1;
    min-height: 0;
    max-height: none;
  }

  .slots-preview {
    display: grid;
    grid-template-columns: repeat(var(--cols, 2), 1fr);
    grid-template-rows: repeat(var(--rows, 2), 1fr);
    gap: 6px;
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: var(--cols, 2) / var(--rows, 2);
  }

  .slot {
    background: rgba(49, 50, 68, 0.6);
    border: 2px dashed rgba(69, 71, 90, 0.6);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 0;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    position: relative;
  }

  .slot:hover,
  .slot.hovered {
    border-color: rgba(137, 180, 250, 0.5);
    background: rgba(69, 71, 90, 0.7);
    transform: scale(1.02);
  }

  .slot.assigned {
    border-style: solid;
    border-color: rgba(137, 180, 250, 0.8);
    background: rgba(137, 180, 250, 0.12);
    box-shadow: 0 0 15px rgba(137, 180, 250, 0.15);
  }

  .slot-agent {
    font-size: clamp(20px, 4vw, 32px);
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }

  .slot-placeholder {
    font-size: clamp(18px, 3vw, 26px);
    color: rgba(108, 112, 134, 0.6);
    font-weight: 300;
  }

  .dimensions-display {
    display: flex;
    gap: 16px;
    justify-content: center;
    font-size: 13px;
    color: rgba(108, 112, 134, 0.7);
    flex-shrink: 0;
  }

  .slot-count {
    color: rgba(137, 180, 250, 0.9);
    font-weight: 600;
    font-family: var(--font-mono, monospace);
  }
  /* Agent Grid Layout for Step 3 */
  .agent-list-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    overflow-y: auto;
    flex: 1;
    padding-right: 4px;
  }

  .agent-item-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    background: rgba(49, 50, 68, 0.4);
    border-radius: 10px;
    cursor: grab;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .agent-item-grid:hover {
    background: rgba(69, 71, 90, 0.6);
    border-color: rgba(137, 180, 250, 0.3);
    transform: scale(1.02);
  }

  .agent-item-grid .agent-name-short {
    font-size: 11px;
    text-align: center;
  }

  .agent-icon-small {
    font-size: 16px;
    width: 24px;
    text-align: center;
  }

  .agent-name-short {
    flex: 1;
    font-size: 13px;
    color: #cdd6f4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-counter {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(17, 17, 27, 0.8);
    padding: 3px;
    border-radius: 6px;
  }

  .counter-btn {
    width: 26px;
    height: 26px;
    background: rgba(69, 71, 90, 0.6);
    border: 1px solid rgba(108, 112, 134, 0.3);
    border-radius: 5px;
    color: #cdd6f4;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .counter-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #89b4fa, #7287fd);
    border-color: rgba(137, 180, 250, 0.8);
    color: #1e1e2e;
    box-shadow: 0 2px 8px rgba(137, 180, 250, 0.3);
  }

  .counter-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .counter-value {
    min-width: 24px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: #cdd6f4;
    font-family: var(--font-mono, monospace);
  }

  .agent-actions-row {
    display: flex;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid rgba(69, 71, 90, 0.4);
  }

  .btn-action {
    flex: 1;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid rgba(69, 71, 90, 0.5);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-auto {
    background: linear-gradient(135deg, rgba(137, 180, 250, 0.9), rgba(114, 135, 253, 0.9));
    color: #1e1e2e;
    border-color: transparent;
  }

  .btn-auto:hover {
    background: linear-gradient(135deg, #89b4fa, #7287fd);
    box-shadow: 0 4px 12px rgba(137, 180, 250, 0.3);
    transform: translateY(-1px);
  }

  .btn-clear {
    background: rgba(49, 50, 68, 0.6);
    color: #cdd6f4;
  }

  .btn-clear:hover {
    background: rgba(243, 139, 168, 0.3);
    border-color: rgba(243, 139, 168, 0.5);
    color: #f38ba8;
  }

  /* ===== Footer ===== */
  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(69, 71, 90, 0.4);
    background: rgba(24, 24, 37, 0.95);
    flex-shrink: 0;
  }

  .btn-cancel,
  .btn-back,
  .btn-next,
  .btn-create {
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel {
    background: rgba(49, 50, 68, 0.7);
    border: 1px solid rgba(69, 71, 90, 0.5);
    color: #cdd6f4;
  }

  .btn-cancel:hover {
    background: rgba(69, 71, 90, 0.8);
    border-color: rgba(137, 180, 250, 0.3);
    transform: translateY(-1px);
  }

  .btn-back {
    background: rgba(49, 50, 68, 0.7);
    border: 1px solid rgba(69, 71, 90, 0.5);
    color: #cdd6f4;
  }

  .btn-back:hover {
    background: rgba(69, 71, 90, 0.8);
    border-color: rgba(137, 180, 250, 0.3);
    transform: translateY(-1px);
  }

  .btn-next {
    margin-left: auto;
    background: linear-gradient(135deg, #89b4fa 0%, #7287fd 100%);
    border: none;
    color: #1e1e2e;
    box-shadow: 0 4px 15px rgba(137, 180, 250, 0.3);
  }

  .btn-next:hover:not(:disabled) {
    background: linear-gradient(135deg, #9ec5fe 0%, #8a9afd 100%);
    box-shadow: 0 6px 20px rgba(137, 180, 250, 0.4);
    transform: translateY(-2px);
  }

  .btn-next:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-create {
    margin-left: auto;
    background: linear-gradient(135deg, #a6e3a1 0%, #7ee0ad 100%);
    border: none;
    color: #1e1e2e;
    box-shadow: 0 4px 15px rgba(166, 227, 161, 0.3);
  }

  .btn-create:hover:not(:disabled) {
    background: linear-gradient(135deg, #b6f3b1 0%, #8ef0bd 100%);
    box-shadow: 0 6px 20px rgba(166, 227, 161, 0.4);
    transform: translateY(-2px);
  }

  .btn-create:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Custom Scrollbar ===== */
  .agents-left::-webkit-scrollbar,
  .step-content::-webkit-scrollbar {
    width: 6px;
  }

  .agents-left::-webkit-scrollbar-track,
  .step-content::-webkit-scrollbar-track {
    background: rgba(24, 24, 37, 0.4);
    border-radius: 3px;
  }

  .agents-left::-webkit-scrollbar-thumb,
  .step-content::-webkit-scrollbar-thumb {
    background: rgba(69, 71, 90, 0.6);
    border-radius: 3px;
  }

  .agents-left::-webkit-scrollbar-thumb:hover,
  .step-content::-webkit-scrollbar-thumb:hover {
    background: rgba(137, 180, 250, 0.5);
  }

  /* ===== Responsive ===== */
  @media (max-width: 768px) {
    .creation-modal {
      width: 100%;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      margin: 0;
    }

    .step-layout,
    .step-agents {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .agents-left {
      max-height: 200px;
    }
    .template-card {
      flex: 1;
      min-width: 120px;
    }
  }
</style>

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useTemplateStore } from '../../stores/templateStore';
import { AgentConfig, AgentType, AgentAllocation, Template, WorkspaceLayout } from '../../types/workspace';
import { agentTypeInfo, agentAllocationKeys } from '../../types/workspace.agents';
import { TemplateCard } from './TemplateCard';
import { AgentItem } from './AgentItem';
import { backendAPI } from '../../services/wails-bridge';
import type { DirectoryEntry } from '../../types/backend';
import './WorkspaceCreationModal.css';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface WorkspaceCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingWorkspace?: WorkspaceLayout | null;
}

type Step = 'template' | 'info' | 'directory' | 'agents';

const steps: Step[] = ['template', 'info', 'directory', 'agents'];

interface StepInfo {
  id: Step;
  title: string;
  subtitle: string;
  icon: string;
}

const stepInfo: StepInfo[] = [
  { id: 'template', title: 'Template', subtitle: 'Choose layout', icon: '📐' },
  { id: 'info', title: 'Basic Info', subtitle: 'Name & icon', icon: '📝' },
  { id: 'directory', title: 'Directory', subtitle: 'Working folder', icon: '📁' },
  { id: 'agents', title: 'AI Agents', subtitle: 'Configure agents', icon: '🤖' },
];

const emojis = ['💼', '🚀', '💻', '🔧', '⚡', '🎯', '📦', '🛠️', '📊', '🎨', '🌟', '🎮', '📱', '🖥️', '☁️'];

const extractAgentAllocation = (terminals: WorkspaceLayout['terminals']): AgentAllocation => {
  const allocation: AgentAllocation = {
    claudeCode: 0, opencode: 0, droid: 0, geminiCli: 0, cursor: 0, codex: 0,
    ohMyPi: 0, aider: 0, goose: 0, warp: 0, amp: 0, kiro: 0,
  };

  terminals.forEach(term => {
    if (term.agent && term.agent.type !== 'none') {
      const key = agentAllocationKeys[term.agent.type];
      if (key) allocation[key]++;
    }
  });

  return allocation;
};

const generateAgentAssignments = (allocation: AgentAllocation, total: number): Record<string, AgentConfig> => {
  const assignments: Record<string, AgentConfig> = {};
  let terminalIndex = 0;

  const agentAllocations = [
    { type: 'claude-code' as const, count: allocation.claudeCode },
    { type: 'opencode' as const, count: allocation.opencode },
    { type: 'droid' as const, count: allocation.droid },
    { type: 'gemini-cli' as const, count: allocation.geminiCli },
    { type: 'cursor' as const, count: allocation.cursor },
    { type: 'codex' as const, count: allocation.codex },
    { type: 'oh-my-pi' as const, count: allocation.ohMyPi },
    { type: 'aider' as const, count: allocation.aider },
    { type: 'goose' as const, count: allocation.goose },
    { type: 'warp' as const, count: allocation.warp },
    { type: 'amp' as const, count: allocation.amp },
    { type: 'kiro' as const, count: allocation.kiro },
  ];

  for (const agent of agentAllocations) {
    for (let i = 0; i < agent.count && terminalIndex < total; i++) {
      assignments[`terminal-${terminalIndex++}`] = { type: agent.type, enabled: true };
    }
  }

  while (terminalIndex < total) {
    assignments[`terminal-${terminalIndex++}`] = { type: 'none', enabled: false };
  }

  return assignments;
};

export const WorkspaceCreationModal: React.FC<WorkspaceCreationModalProps> = ({
  isOpen,
  onClose,
  editingWorkspace,
}) => {
  const { addWorkspace, setCurrentWorkspace, updateWorkspace } = useWorkspaceStore();
  const { loadTemplates, getTemplate } = useTemplateStore();

  const isEditMode = !!editingWorkspace;
  const [currentStep, setCurrentStep] = useState<Step>('template');

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [selectedIcon, setSelectedIcon] = useState(emojis[0]);
  const [workingDir, setWorkingDir] = useState('./');
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [agentAllocation, setAgentAllocation] = useState<AgentAllocation>({
    claudeCode: 0, opencode: 0, droid: 0, geminiCli: 0, cursor: 0, codex: 0,
    ohMyPi: 0, aider: 0, goose: 0, warp: 0, amp: 0, kiro: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [draggedAgent, setDraggedAgent] = useState<AgentType | null>(null);

  const stepRef = useRef<HTMLDivElement>(null);
  const spawnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear spawn timeout on unmount
  useEffect(() => {
    return () => {
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
      }
    };
  }, []);

  // Early return if not open - prevents rendering when closed
  if (!isOpen) return null;

  const totalTerminals = selectedTemplate ? selectedTemplate.columns * selectedTemplate.rows : 0;
  const allocatedCount = Object.values(agentAllocation).reduce((sum, val) => sum + val, 0);
  const noneCount = totalTerminals - allocatedCount;

  const agentAssignments = generateAgentAssignments(agentAllocation, totalTerminals);

  useEffect(() => {
    // Only load templates when modal is actually opened
    if (isOpen) {
      loadTemplates();
      // Only reset form for create mode, not edit mode
      if (!isEditMode && !editingWorkspace) {
        resetForm();
      }
    }
  }, [isOpen, isEditMode, editingWorkspace]);

  useEffect(() => {
    if (isEditMode && editingWorkspace && isOpen) {
      setWorkspaceName(editingWorkspace.name);
      setSelectedIcon(editingWorkspace.icon || emojis[0]);
      setWorkingDir(editingWorkspace.terminals[0]?.cwd || './');
      const allocation = extractAgentAllocation(editingWorkspace.terminals);
      setAgentAllocation(allocation);

      const template = getTemplateByLayout(editingWorkspace.columns, editingWorkspace.rows);
      if (template) {
        setSelectedTemplate(template);
      }
      setCurrentStep('agents');
    }
  }, [editingWorkspace, isEditMode, isOpen]);

  const getTemplateByLayout = (columns: number, rows: number): Template | null => {
    const templates = ['single', 'dual', 'quad', 'six', 'eight', 'ten', 'twelve', 'fourteen', 'sixteen']
      .map(id => getTemplate(id))
      .filter(Boolean) as Template[];
    return templates.find(t => t.columns === columns && t.rows === rows) || null;
  };

  const handleNext = useCallback(() => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);

  const handleStepClick = (step: Step) => {
    const currentIndex = steps.indexOf(currentStep);
    const targetIndex = steps.indexOf(step);
    if (targetIndex <= currentIndex) {
      setCurrentStep(step);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const result = await backendAPI.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Working Directory',
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];

        // Validate the path exists by trying to list it
        const validation = await backendAPI.listDirectory(selectedPath);
        if (validation.error) {
          console.warn('[WorkspaceCreationModal] Selected path may not be accessible:', validation.error);
          // Still set the path - user can verify it works when creating workspace
        }

        setWorkingDir(selectedPath);
        setCommandInput(''); // Clear command input since we have a valid path
        setShowSuggestions(false);
        setSuggestions([]);
      }
    } catch {
      const folder = prompt('Enter working directory path:', workingDir);
      if (folder) setWorkingDir(folder);
    }
  };

  const handleAgentChange = (agentType: AgentType, delta: number) => {
    if (delta === 0) return;
    
    const key = agentAllocationKeys[agentType];
    if (!key || key === 'droid' && agentType !== 'droid') return;

    setAgentAllocation(prev => {
      const currentValue = prev[key];
      const maxAvailable = totalTerminals - (allocatedCount - currentValue);
      const newValue = Math.max(0, Math.min(maxAvailable, currentValue + delta));
      return { ...prev, [key]: newValue };
    });
  };

  const handleAgentDirectChange = (agentType: AgentType, value: number) => {
    const key = agentAllocationKeys[agentType];
    if (!key) return;

    setAgentAllocation(prev => {
      const currentValue = prev[key];
      const otherAgentsCount = allocatedCount - currentValue;
      const maxAvailable = totalTerminals - otherAgentsCount;
      const newValue = Math.max(0, Math.min(maxAvailable, value));
      return { ...prev, [key]: newValue };
    });
  };

  const handleAutoDistribute = () => {
    if (totalTerminals === 0) return;
    const numAgents = agentTypeInfo.length;
    const base = Math.floor(totalTerminals / numAgents);
    const remainder = totalTerminals % numAgents;

    const allocation: AgentAllocation = {
      claudeCode: base, opencode: base, droid: base, geminiCli: base, cursor: base, codex: base,
      ohMyPi: base, aider: base, goose: base, warp: base, amp: base, kiro: base,
    };

    const keys = Object.keys(allocation) as (keyof AgentAllocation)[];
    for (let i = 0; i < remainder; i++) {
      allocation[keys[i]]++;
    }
    setAgentAllocation(allocation);
  };

  const handleReset = () => {
    setAgentAllocation({
      claudeCode: 0, opencode: 0, droid: 0, geminiCli: 0, cursor: 0, codex: 0,
      ohMyPi: 0, aider: 0, goose: 0, warp: 0, amp: 0, kiro: 0,
    });
  };

  const handleCommandInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && commandInput.trim()) {
      const command = commandInput.trim();
      
      // Add to history
      setCommandHistory(prev => [...prev.slice(-9), command]);
      setHistoryIndex(-1);
      setShowSuggestions(false);
      
      // Parse command
      if (command.startsWith('cd ')) {
        const path = command.slice(3).trim();
        // Handle special paths
        if (path === '~') {
          setWorkingDir('~');
        } else if (path === '.' || path === './') {
          setWorkingDir('./');
        } else if (path === '..') {
          // Go up one directory
          setWorkingDir(prev => {
            const parts = prev.split(/[\\/]/).filter(Boolean);
            parts.pop();
            return parts.length === 0 ? './' : parts.join('/') + '/';
          });
        } else {
          // Set to specified path
          setWorkingDir(path);
        }
      } else if (command === 'ls' || command === 'dir') {
        // Just visual feedback - in real app would show directory contents
      } else if (command === 'pwd') {
        // Just visual feedback
      }
      
      setCommandInput('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        // Select current suggestion
        const selectedPath = suggestions[selectedSuggestionIndex];
        const lastSpaceIndex = commandInput.lastIndexOf(' ');
        const basePath = lastSpaceIndex >= 0 ? commandInput.slice(0, lastSpaceIndex + 1) : '';
        setCommandInput(basePath + selectedPath);
        setShowSuggestions(false);
        setSuggestions([]);
      }
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
      // Don't close suggestions if they're showing - user was navigating suggestions
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setCommandInput('');
      }
      // Don't close suggestions if they're showing
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handle command input changes and show suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (commandInput.startsWith('cd ') && commandInput.length > 3) {
        const partialPath = commandInput.slice(3).trim();
        const paths = await getDirectoryPaths(partialPath);

        if (paths.length > 0) {
          setSuggestions(paths);
          setShowSuggestions(true);
          setSelectedSuggestionIndex(0);
        } else {
          setShowSuggestions(false);
          setSuggestions([]);
        }
      } else {
        setShowSuggestions(false);
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [commandInput]);

  const handleCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommandInput(e.target.value);
  };

  // Get actual directory paths for auto-completion
  const getDirectoryPaths = async (partial: string): Promise<string[]> => {
    try {
      // Determine the directory to list based on the partial path
      let targetPath: string;
      let filterName: string;

      // Handle special paths
      if (partial === '~' || partial.startsWith('~/')) {
        targetPath = partial;
        filterName = partial.substring(2); // Remove ~/ for filtering
      } else if (partial === '.' || partial === './') {
        targetPath = '.';
        filterName = '';
      } else if (partial.startsWith('./')) {
        targetPath = '.';
        filterName = partial.substring(2); // Remove ./ for filtering
      } else if (partial === '..' || partial === '../') {
        targetPath = '..';
        filterName = '.';
      } else if (partial.startsWith('../')) {
        targetPath = '..';
        filterName = partial.substring(3); // Remove ../ for filtering
      } else if (!partial.includes('/') && !partial.includes('\\')) {
        // Just a name without path separators - search in current working directory
        targetPath = workingDir || '.';
        filterName = partial;
      } else {
        // Path with separators - extract directory and filename
        const lastSepIndex = Math.max(partial.lastIndexOf('/'), partial.lastIndexOf('\\'));
        if (lastSepIndex >= 0) {
          targetPath = partial.substring(0, lastSepIndex) || '.';
          filterName = partial.substring(lastSepIndex + 1);
        } else {
          targetPath = '.';
          filterName = partial;
        }
      }

      // Get directory listing from backend
      const result = await backendAPI.listDirectory(targetPath);

      if (result.error) {
        console.warn('[WorkspaceCreationModal] Failed to list directory:', result.error);
        return [];
      }

      // Filter to show only directories
      let directories = result.entries
        .filter((entry: DirectoryEntry) => entry.isDirectory)
        .map((entry: DirectoryEntry) => entry.name);

      // Filter by the name being typed (if any)
      if (filterName) {
        directories = directories.filter((name: string) =>
          name.toLowerCase().includes(filterName.toLowerCase())
        );
      }

      // Add prefix back if path has separators
      const lastSlashIndex = Math.max(partial.lastIndexOf('/'), partial.lastIndexOf('\\'));
      const prefix = lastSlashIndex >= 0 ? partial.substring(0, lastSlashIndex + 1) : '';

      return directories
        .map((name: string) => prefix + name)
        .slice(0, 8);
    } catch (err) {
      console.warn('[WorkspaceCreationModal] Error listing directory:', err);
      return [];
    }
  };

  const handleDragStart = (e: React.DragEvent, agentType: AgentType) => {
    e.dataTransfer.setData('agentType', agentType);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedAgent(agentType);
  };

  const handleDragEnd = () => {
    setDraggedAgent(null);
  };

  const handleDropOnSlot = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    const agentType = e.dataTransfer.getData('agentType') as AgentType;
    if (!agentType) return;

    const key = agentAllocationKeys[agentType];
    if (!key) return;

    setAgentAllocation(prev => {
      if (prev[key] >= totalTerminals) return prev;
      return { ...prev, [key]: prev[key] + 1 };
    });
  };

  const handleCreateWorkspace = async () => {
    if (!selectedTemplate) {
      alert('Please select a template');
      return;
    }

    const finalAgentAssignments: Record<string, AgentConfig> = {};
    Object.entries(agentAssignments).forEach(([key, config], index) => {
      finalAgentAssignments[`term-${index}`] = config;
    });

    if (isEditMode && editingWorkspace) {
      const getShell = () => editingWorkspace.terminals[0]?.shell || 'powershell.exe';
      const newTerminals = [];
      const totalNewTerminals = selectedTemplate.columns * selectedTemplate.rows;
      let terminalIndex = 0;

      const allocateAgent = (type: AgentType, count: number) => {
        for (let i = 0; i < count && terminalIndex < totalNewTerminals; i++) {
          newTerminals.push({
            id: generateId(),
            title: `Terminal ${terminalIndex + 1}`,
            cwd: workingDir,
            shell: getShell(),
            status: 'stopped' as const,
            agent: { type, enabled: true },
          });
          terminalIndex++;
        }
      };

      allocateAgent('claude-code', agentAllocation.claudeCode);
      allocateAgent('opencode', agentAllocation.opencode);
      allocateAgent('droid', agentAllocation.droid);
      allocateAgent('gemini-cli', agentAllocation.geminiCli);
      allocateAgent('cursor', agentAllocation.cursor);
      allocateAgent('codex', agentAllocation.codex);
      allocateAgent('oh-my-pi', agentAllocation.ohMyPi);
      allocateAgent('aider', agentAllocation.aider);
      allocateAgent('goose', agentAllocation.goose);
      allocateAgent('warp', agentAllocation.warp);
      allocateAgent('amp', agentAllocation.amp);
      allocateAgent('kiro', agentAllocation.kiro);

      while (terminalIndex < totalNewTerminals) {
        newTerminals.push({
          id: generateId(),
          title: `Terminal ${terminalIndex + 1}`,
          cwd: workingDir,
          shell: getShell(),
          status: 'stopped' as const,
          agent: { type: 'none' as const, enabled: false },
        });
        terminalIndex++;
      }

      await updateWorkspace(editingWorkspace.id, {
        name: workspaceName,
        icon: selectedIcon,
        columns: selectedTemplate.columns,
        rows: selectedTemplate.rows,
        terminals: newTerminals,
      });
    } else {
      // Create mode: add new workspace and auto-spawn terminals
      const workspace = await addWorkspace({
        name: workspaceName,
        columns: selectedTemplate.columns,
        rows: selectedTemplate.rows,
        cwd: workingDir,
        icon: selectedIcon,
        agentAssignments: finalAgentAssignments,
        templateId: selectedTemplate.id,
      });

      // Check if workspace was created successfully
      if (!workspace) {
        alert('⚠️ Lỗi khi tạo workspace: Không thể tạo workspace mới. Vui lòng thử lại.');
        return;
      }

      setCurrentWorkspace(workspace);

      // Auto-spawn all terminals with staggered delays to reduce memory spike
      // Spawn terminals one by one with 150ms delay between each to prevent memory alloc burst
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
      spawnTimeoutRef.current = setTimeout(async () => {
        try {
          const spawnTerminalsSequentially = async () => {
            const spawnResults = [];
            for (let i = 0; i < workspace.terminals.length; i++) {
              const terminal = workspace.terminals[i];
              const agentKey = `term-${i}`;
              const agentConfig = finalAgentAssignments[agentKey];

              let result;
              if (agentConfig && agentConfig.enabled && agentConfig.type !== 'none') {
                result = await backendAPI.spawnTerminalWithAgent(
                  terminal.id,
                  workingDir,
                  agentConfig,
                  workspace.id,
                  0,
                  0
                );
              } else {
                result = await backendAPI.spawnTerminal(
                  terminal.id,
                  workingDir,
                  workspace.id,
                  0,
                  0
                );
              }

              if (!result.success) {
                spawnResults.push({ terminal: terminal.id, success: false, error: result.error });
              }

              // Stagger terminal spawn by 150ms to reduce memory spike
              // This prevents all terminals from allocating memory simultaneously
              if (i < workspace.terminals.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 150));
              }
            }

            // Show error if any terminals failed
            const failedTerminals = spawnResults.filter(r => !r.success);
            if (failedTerminals.length > 0) {
              console.error('[WorkspaceCreationModal] Failed to spawn terminals:', failedTerminals);
              const errorMsg = failedTerminals[0].error || 'Không thể khởi tạo terminal';
              alert(`⚠️ Lỗi khi tạo workspace:\n\n${errorMsg}\n\nVui lòng kiểm tra thư mục làm việc và thử lại.`);
            }
          };

          await spawnTerminalsSequentially();
        } catch (err: any) {
          console.error('[WorkspaceCreationModal] Failed to spawn terminals:', err);
          alert(`⚠️ Lỗi khi tạo workspace:\n\n${err.message || 'Lỗi không xác định'}\n\nVui lòng thử lại.`);
        }
      }, 100);
    }

    onClose();
    resetForm();
  };

  const resetForm = () => {
    setWorkspaceName('My Workspace');
    setSelectedIcon(emojis[0]);
    setSelectedTemplate(null);
    setWorkingDir('./');
    setAgentAllocation({
      claudeCode: 0, opencode: 0, droid: 0, geminiCli: 0, cursor: 0, codex: 0,
      ohMyPi: 0, aider: 0, goose: 0, warp: 0, amp: 0, kiro: 0,
    });
    setCurrentStep('template');
    setSearchQuery('');
    setIconSearchQuery('');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'template': return selectedTemplate !== null;
      case 'info': return workspaceName.trim().length > 0;
      case 'directory': return workingDir.trim().length > 0;
      case 'agents': return true;
      default: return false;
    }
  };

  const filteredEmojis = emojis.filter(emoji => 
    iconSearchQuery === '' || emoji.includes(iconSearchQuery)
  );

  const isLastStep = currentStep === 'agents';
  const isFirstStep = currentStep === 'template';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header with Progress */}
        <div className="modal-header">
          <button className="modal-close-btn" onClick={onClose}>✕</button>
          <div className="progress-stepper">
            {stepInfo.map((step, index) => {
              const stepIndex = steps.indexOf(step.id);
              const currentIndex = steps.indexOf(currentStep);
              const isCompleted = stepIndex < currentIndex;
              const isActive = stepIndex === currentIndex;
              
              return (
                <React.Fragment key={step.id}>
                  <button
                    className={`step-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                    onClick={() => handleStepClick(step.id)}
                    disabled={stepIndex > currentIndex}
                  >
                    <div className="step-icon">
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    <div className="step-info">
                      <span className="step-title">{step.title}</span>
                      <span className="step-subtitle">{step.subtitle}</span>
                    </div>
                  </button>
                  {index < stepInfo.length - 1 && <div className="step-connector" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="modal-content">
          <div ref={stepRef} className="step-content">
            {/* Step 1: Template Selection */}
            {currentStep === 'template' && (
              <div className="template-selection-step">
                <div className="template-grid">
                  <TemplateList
                    templates={useTemplateStore.getState().getBuiltInTemplates()}
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={setSelectedTemplate}
                  />
                  <TemplateList
                    templates={useTemplateStore.getState().getCustomTemplates()}
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={setSelectedTemplate}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Basic Info */}
            {currentStep === 'info' && (
              <div className="basic-info-step">
                <div className="form-group">
                  <label className="form-label">Workspace Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    placeholder="Enter workspace name"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Icon</label>
                  <input
                    type="text"
                    className="form-input search-input"
                    value={iconSearchQuery}
                    onChange={e => setIconSearchQuery(e.target.value)}
                    placeholder="Search icons..."
                  />
                  <div className="emoji-grid">
                    {filteredEmojis.map(emoji => (
                      <button
                        key={emoji}
                        className={`emoji-btn ${selectedIcon === emoji ? 'selected' : ''}`}
                        onClick={() => setSelectedIcon(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="workspace-preview">
                  <span className="preview-label">Preview:</span>
                  <div className="preview-tab">
                    <span className="preview-icon">{selectedIcon}</span>
                    <span className="preview-name">{workspaceName || 'Workspace Name'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Directory */}
            {currentStep === 'directory' && (
              <div className="directory-step">
                <div className="quick-access">
                  <button className="quick-btn" onClick={() => setWorkingDir('./')}>
                    📁 Current
                  </button>
                  <button className="quick-btn" onClick={handleBrowseFolder}>
                    💻 Browse
                  </button>
                  <button className="quick-btn" onClick={() => setWorkingDir('~')}>
                    🏠 Home
                  </button>
                </div>
                
                {/* Terminal-style Command Input */}
                <div className="terminal-command-section">
                  <label className="form-label">🖥️ Quick Navigate (type commands)</label>
                  <div className="terminal-command-wrapper" ref={suggestionsRef}>
                    <div className="terminal-command-input">
                      <span className="terminal-prompt">user@tdt:~$</span>
                      <input
                        ref={commandInputRef}
                        type="text"
                        className="terminal-input"
                        value={commandInput}
                        onChange={handleCommandChange}
                        onKeyDown={handleCommandInput}
                        placeholder="cd path/to/folder (try: cd .., cd ~, cd ./)"
                        autoFocus
                      />
                    </div>
                    
                    {/* Auto-complete Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {suggestions.map((path, index) => (
                          <button
                            key={path}
                            className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                            onClick={() => {
                              const lastSpaceIndex = commandInput.lastIndexOf(' ');
                              const basePath = lastSpaceIndex >= 0 ? commandInput.slice(0, lastSpaceIndex + 1) : '';
                              setCommandInput(basePath + path);
                              setShowSuggestions(false);
                              setSuggestions([]);
                            }}
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          >
                            <span className="suggestion-icon">📁</span>
                            <span className="suggestion-path">{path}</span>
                            {index === selectedSuggestionIndex && (
                              <span className="suggestion-hint">Tab</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="command-hints">
                    <span className="hint">cd .. (up)</span>
                    <span className="hint">cd ~ (home)</span>
                    <span className="hint">Tab (complete)</span>
                    <span className="hint">↑↓ (history)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Working Directory</label>
                  <div className="directory-input">
                    <input
                      type="text"
                      className="form-input"
                      value={workingDir}
                      onChange={e => setWorkingDir(e.target.value)}
                      placeholder="e.g., C:\Projects\my-app"
                    />
                    <button className="browse-btn" onClick={handleBrowseFolder}>
                      📂 Browse
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Agents */}
            {currentStep === 'agents' && (
              <div className="agents-step">
                <div className="allocation-summary">
                  <div className="summary-item">
                    <span className="summary-label">Total</span>
                    <span className="summary-value">{totalTerminals}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Allocated</span>
                    <span className={`summary-value ${allocatedCount > totalTerminals ? 'error' : 'success'}`}>
                      {allocatedCount}/{totalTerminals}
                    </span>
                  </div>
                  {noneCount > 0 && (
                    <div className="summary-item">
                      <span className="summary-label">None</span>
                      <span className="summary-value muted">{noneCount}</span>
                    </div>
                  )}
                </div>

                <div className="agents-layout">
                  <div className="agents-sidebar">
                    <h4 className="sidebar-title">AI Agents</h4>
                    <p className="sidebar-subtitle">Drag, click count, or use + buttons</p>
                    {agentTypeInfo.map(agent => {
                      const key = agentAllocationKeys[agent.type];
                      const count = key ? agentAllocation[key] : 0;
                      const maxForAgent = totalTerminals - (allocatedCount - count);
                      return (
                        <AgentItem
                          key={agent.type}
                          type={agent.type}
                          label={agent.label}
                          icon={agent.icon}
                          count={count}
                          maxValue={maxForAgent}
                          onIncrement={() => handleAgentChange(agent.type, 1)}
                          onDecrement={() => handleAgentChange(agent.type, -1)}
                          onChange={(value) => handleAgentDirectChange(agent.type, value)}
                          onDragStart={(e) => handleDragStart(e, agent.type)}
                          onDragEnd={handleDragEnd}
                        />
                      );
                    })}
                    <div className="agent-actions">
                      <button className="action-btn" onClick={handleReset}>
                        🔄 Reset
                      </button>
                      <button className="action-btn primary" onClick={handleAutoDistribute}>
                        ⚡ Auto
                      </button>
                    </div>
                  </div>

                  <div className="agents-main">
                    <div className="terminal-grid-preview">
                      {selectedTemplate && (
                        <div 
                          className="terminal-grid"
                          style={{
                            gridTemplateColumns: `repeat(${selectedTemplate.columns}, 1fr)`,
                            gridTemplateRows: `repeat(${selectedTemplate.rows}, 1fr)`,
                          }}
                        >
                          {Array.from({ length: totalTerminals }).map((_, i) => {
                            const key = `terminal-${i}`;
                            const agent = agentAssignments[key];
                            const agentInfo = agentTypeInfo.find(a => a.type === agent?.type);
                            return (
                              <div
                                key={i}
                                className="terminal-slot"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleDropOnSlot(e, i)}
                              >
                                {agentInfo ? (
                                  <div className="terminal-agent">
                                    <img src={agentInfo.icon} alt={agentInfo.label} className="agent-icon-img" draggable={false} />
                                    <span className="agent-short">{agentInfo.label}</span>
                                  </div>
                                ) : (
                                  <span className="slot-empty">Empty</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button 
            className="footer-btn secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          {!isFirstStep && (
            <button 
              className="footer-btn"
              onClick={handleBack}
            >
              ← Back
            </button>
          )}
          <div className="footer-spacer" />
          {isLastStep ? (
            <button 
              className="footer-btn primary"
              onClick={handleCreateWorkspace}
              disabled={!canProceed()}
            >
              {isEditMode ? '💾 Save Changes' : '🚀 Create Workspace'}
            </button>
          ) : (
            <button 
              className="footer-btn primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TemplateList = memo(({ templates, selectedTemplate, onSelectTemplate }: {
  templates: Template[];
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
}) => {
  return (
    <>
      {templates.map(template => (
        <TemplateCard
          key={template.id}
          template={template}
          isSelected={selectedTemplate?.id === template.id}
          onSelect={onSelectTemplate}
        />
      ))}
    </>
  );
});
TemplateList.displayName = 'TemplateList';

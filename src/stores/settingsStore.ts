import { create } from 'zustand';

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
  showCommandBlocks: boolean;
  theme: 'dark' | 'light' | 'system';
}

export interface VietnameseImeSettings {
  enabled: boolean;
  autoPatch: boolean;
  lastPatchStatus?: 'success' | 'failed' | 'pending';
  lastPatchPath?: string;
  patchedVersion?: string;
}

const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
  cursorBlink: true,
  scrollback: 1000, // Optimal limit to prevent memory bloat (VAL-PERF-002)
  showCommandBlocks: true,
  theme: 'dark',
};

const DEFAULT_VN_IME_SETTINGS: VietnameseImeSettings = {
  enabled: false,
  autoPatch: true,
};

const SETTINGS_STORAGE_KEY = 'terminal-settings';
const VN_IME_SETTINGS_KEY = 'vietnamese-ime-settings';

interface SettingsState {
  settings: TerminalSettings;
  vietnameseIme: VietnameseImeSettings;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSettings: (updates: Partial<TerminalSettings>) => void;
  resetSettings: () => void;
  
  // Vietnamese IME actions
  loadVietnameseImeSettings: () => Promise<void>;
  saveVietnameseImeSettings: () => Promise<void>;
  updateVietnameseImeSettings: (updates: Partial<VietnameseImeSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  vietnameseIme: DEFAULT_VN_IME_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    set({ isLoading: true });

    try {
      const stored = await (window as any).electronAPI.getStoreValue(SETTINGS_STORAGE_KEY);

      if (stored) {
        set({ settings: { ...DEFAULT_SETTINGS, ...stored } });
      }
    } catch (err) {
      console.error('[SettingsStore] Failed to load settings:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveSettings: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    const { settings } = get();

    try {
      await (window as any).electronAPI.setStoreValue(SETTINGS_STORAGE_KEY, settings);
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err);
    }
  },

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
  },

  resetSettings: () => {
    set({ settings: DEFAULT_SETTINGS });
  },

  // Vietnamese IME settings actions
  loadVietnameseImeSettings: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    try {
      const stored = await (window as any).electronAPI.getStoreValue(VN_IME_SETTINGS_KEY);

      if (stored) {
        set({ vietnameseIme: { ...DEFAULT_VN_IME_SETTINGS, ...stored } });
      }
    } catch (err) {
      console.error('[SettingsStore] Failed to load VN IME settings:', err);
    }
  },

  saveVietnameseImeSettings: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    const { vietnameseIme } = get();

    try {
      await (window as any).electronAPI.setStoreValue(VN_IME_SETTINGS_KEY, vietnameseIme);
    } catch (err) {
      console.error('[SettingsStore] Failed to save VN IME settings:', err);
    }
  },

  updateVietnameseImeSettings: (updates) => {
    set((state) => ({
      vietnameseIme: { ...state.vietnameseIme, ...updates },
    }));
  },
}));

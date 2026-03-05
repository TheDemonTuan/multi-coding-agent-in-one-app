import { create } from 'zustand';

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
  showCommandBlocks: boolean;
  theme: 'dark' | 'light' | 'system';
}

const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
  cursorBlink: true,
  scrollback: 10000,
  showCommandBlocks: true,
  theme: 'dark',
};

const SETTINGS_STORAGE_KEY = 'terminal-settings';

interface SettingsState {
  settings: TerminalSettings;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSettings: (updates: Partial<TerminalSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      console.log('[SettingsStore] electronAPI not available, using defaults');
      return;
    }

    set({ isLoading: true });

    try {
      const stored = await (window as any).electronAPI.getStoreValue(SETTINGS_STORAGE_KEY);

      if (stored) {
        set({ settings: { ...DEFAULT_SETTINGS, ...stored } });
        console.log('[SettingsStore] Loaded settings');
      } else {
        console.log('[SettingsStore] No stored settings, using defaults');
      }
    } catch (err) {
      console.error('[SettingsStore] Failed to load settings:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveSettings: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      console.log('[SettingsStore] electronAPI not available, cannot save');
      return;
    }

    const { settings } = get();

    try {
      await (window as any).electronAPI.setStoreValue(SETTINGS_STORAGE_KEY, settings);
      console.log('[SettingsStore] Settings saved');
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
}));

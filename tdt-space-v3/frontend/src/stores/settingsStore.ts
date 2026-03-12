import { create } from 'zustand';
import { backendAPI } from '../services/wails-bridge';

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
  scrollback: 300, // Updated for Option C: Balanced performance optimization
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

  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSettings: (updates: Partial<TerminalSettings>) => void;
  resetSettings: () => void;

  loadVietnameseImeSettings: () => Promise<void>;
  saveVietnameseImeSettings: () => Promise<void>;
  updateVietnameseImeSettings: (updates: Partial<VietnameseImeSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  vietnameseIme: DEFAULT_VN_IME_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const stored = await backendAPI.getStoreValue(SETTINGS_STORAGE_KEY);
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
    const { settings } = get();
    try {
      await backendAPI.setStoreValue(SETTINGS_STORAGE_KEY, settings);
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

  loadVietnameseImeSettings: async () => {
    try {
      const stored = await backendAPI.getStoreValue(VN_IME_SETTINGS_KEY);
      if (stored) {
        set({ vietnameseIme: { ...DEFAULT_VN_IME_SETTINGS, ...stored } });
      }
    } catch (err) {
      console.error('[SettingsStore] Failed to load VN IME settings:', err);
    }
  },

  saveVietnameseImeSettings: async () => {
    const { vietnameseIme } = get();
    try {
      await backendAPI.setStoreValue(VN_IME_SETTINGS_KEY, vietnameseIme);
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

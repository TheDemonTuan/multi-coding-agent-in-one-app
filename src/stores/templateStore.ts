import { create } from 'zustand';
import { Template, AgentAllocation } from '../types/workspace';

// Pre-built templates
// Layout calculation: find the best rows x cols that can fit n terminals
// Prefer square-like layouts (cols >= rows, cols - rows <= 1)
const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'single',
    name: 'Single',
    description: '1 terminal',
    layout: 'single',
    columns: 1,
    rows: 1,
    icon: '①',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'dual',
    name: 'Dual',
    description: '2 terminals side-by-side',
    layout: 'dual',
    columns: 2,
    rows: 1,
    icon: '②',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'quad',
    name: 'Quad',
    description: '4 terminals (2x2)',
    layout: 'quad',
    columns: 2,
    rows: 2,
    icon: '④',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'six',
    name: 'Six',
    description: '6 terminals (3x2)',
    layout: 'six',
    columns: 3,
    rows: 2,
    icon: '⑥',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'eight',
    name: 'Eight',
    description: '8 terminals (4x2)',
    layout: 'eight',
    columns: 4,
    rows: 2,
    icon: '⑧',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'ten',
    name: 'Ten',
    description: '10 terminals (5x2)',
    layout: 'ten',
    columns: 5,
    rows: 2,
    icon: '⑩',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'twelve',
    name: 'Twelve',
    description: '12 terminals (4x3)',
    layout: 'twelve',
    columns: 4,
    rows: 3,
    icon: '⑫',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'fourteen',
    name: 'Fourteen',
    description: '14 terminals (7x2)',
    layout: 'fourteen',
    columns: 7,
    rows: 2,
    icon: '⑭',
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'sixteen',
    name: 'Sixteen',
    description: '16 terminals (4x4)',
    layout: 'sixteen',
    columns: 4,
    rows: 4,
    icon: '⑯',
    isBuiltIn: true,
    createdAt: 0,
  },
];

interface TemplateState {
  templates: Template[];
  isLoading: boolean;

  // Actions
  loadTemplates: () => Promise<void>;
  saveCustomTemplate: (template: Template) => Promise<void>;
  deleteCustomTemplate: (id: string) => Promise<void>;
  updateCustomTemplate: (template: Template) => Promise<void>;
  getTemplate: (id: string) => Template | undefined;
  getBuiltInTemplates: () => Template[];
  getCustomTemplates: () => Template[];
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  isLoading: false,

  loadTemplates: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      set({ templates: BUILTIN_TEMPLATES });
      return;
    }

    set({ isLoading: true });

    try {
      const storedTemplates = await (window as any).electronAPI.getTemplates();

      if (storedTemplates && Array.isArray(storedTemplates)) {
        const customTemplates = storedTemplates.filter((t: Template) => !t.isBuiltIn);
        set({ templates: [...BUILTIN_TEMPLATES, ...customTemplates] });
      } else {
        set({ templates: BUILTIN_TEMPLATES });
      }
    } catch (err) {
      console.error('[TemplateStore] Failed to load templates:', err);
      set({ templates: BUILTIN_TEMPLATES });
    } finally {
      set({ isLoading: false });
    }
  },

  saveCustomTemplate: async (template: Template) => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    const { templates } = get();
    const customTemplates = templates.filter(t => !t.isBuiltIn);

    try {
      await (window as any).electronAPI.saveTemplate(template);
      set({ templates: [...BUILTIN_TEMPLATES, ...customTemplates, template] });
    } catch (err) {
      console.error('[TemplateStore] Failed to save template:', err);
      throw err;
    }
  },

  deleteCustomTemplate: async (id: string) => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    try {
      await (window as any).electronAPI.deleteTemplate(id);
      const { templates } = get();
      const updatedCustom = templates.filter(t => t.isBuiltIn || t.id !== id);
      set({ templates: updatedCustom });
    } catch (err) {
      console.error('[TemplateStore] Failed to delete template:', err);
      throw err;
    }
  },

  updateCustomTemplate: async (template: Template) => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    try {
      await (window as any).electronAPI.saveTemplate(template);
      const { templates } = get();
      const customTemplates = templates.filter(t => !t.isBuiltIn);
      const updatedCustom = customTemplates.map(t => t.id === template.id ? template : t);
      set({ templates: [...BUILTIN_TEMPLATES, ...updatedCustom] });
    } catch (err) {
      console.error('[TemplateStore] Failed to update template:', err);
      throw err;
    }
  },

  getTemplate: (id: string) => {
    return get().templates.find(t => t.id === id);
  },

  getBuiltInTemplates: () => {
    return get().templates.filter(t => t.isBuiltIn);
  },

  getCustomTemplates: () => {
    return get().templates.filter(t => !t.isBuiltIn);
  },
}));

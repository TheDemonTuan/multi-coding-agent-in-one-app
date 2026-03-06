/**
 * Template IPC Handlers
 * Handles template CRUD operations
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS, STORAGE_KEYS } from '../../config/constants';
import { logger } from '../../lib/logger';

const log = logger.child('[IPC:Template]');

export function initializeTemplateHandlers(store: Store) {
  // Get templates
  ipcMain.handle(IPC_CHANNELS.GET_TEMPLATES, () => {
    try {
      const templates = store.get(STORAGE_KEYS.TEMPLATES, []) as any[];
      log.debug('Getting templates', { count: templates.length });
      return templates;
    } catch (err: any) {
      log.error('Failed to get templates', { error: err.message });
      return [];
    }
  });

  // Save template
  ipcMain.handle(IPC_CHANNELS.SAVE_TEMPLATE, (event, template) => {
    try {
      const templates = store.get(STORAGE_KEYS.TEMPLATES, []) as any[];
      const existingIndex = templates.findIndex((t: any) => t.id === template.id);

      if (existingIndex >= 0) {
        templates[existingIndex] = template;
        log.info('Updated template', { id: template.id });
      } else {
        templates.push(template);
        log.info('Created new template', { id: template.id });
      }

      store.set(STORAGE_KEYS.TEMPLATES, templates);
      return { success: true };
    } catch (err: any) {
      log.error('Failed to save template', { error: err.message });
      return { success: false, error: err.message };
    }
  });

  // Delete template
  ipcMain.handle(IPC_CHANNELS.DELETE_TEMPLATE, (event, { id }) => {
    try {
      const templates = store.get(STORAGE_KEYS.TEMPLATES, []) as any[];
      const filtered = templates.filter((t: any) => t.id !== id);
      store.set(STORAGE_KEYS.TEMPLATES, filtered);
      log.info('Deleted template', { id });
      return { success: true };
    } catch (err: any) {
      log.error('Failed to delete template', { error: err.message });
      return { success: false, error: err.message };
    }
  });
}

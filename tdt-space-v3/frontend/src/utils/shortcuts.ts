/**
 * Keyboard shortcut definitions and utilities
 */

export interface Shortcut {
  key: string;
  description: string;
  action: string;
}

/**
 * Application keyboard shortcuts
 */
export const SHORTCUTS: Shortcut[] = [
  {
    key: 'Ctrl+Shift+N',
    description: 'Create new workspace',
    action: 'open-new-workspace-modal',
  },
  {
    key: 'Ctrl+Tab',
    description: 'Switch to next workspace',
    action: 'cycle-workspace-next',
  },
  {
    key: 'Ctrl+Shift+Tab',
    description: 'Switch to previous workspace',
    action: 'cycle-workspace-prev',
  },
  {
    key: 'Ctrl+PageUp',
    description: 'Switch to previous workspace',
    action: 'switch-workspace-prev',
  },
  {
    key: 'Ctrl+PageDown',
    description: 'Switch to next workspace',
    action: 'switch-workspace-next',
  },
  {
    key: 'Ctrl+T',
    description: 'Focus next terminal',
    action: 'focus-terminal-next',
  },
  {
    key: 'Ctrl+Shift+T',
    description: 'Focus previous terminal',
    action: 'focus-terminal-prev',
  },
  {
    key: 'Ctrl+,',
    description: 'Open settings',
    action: 'open-settings',
  },
  {
    key: 'Alt+1-9',
    description: 'Switch to workspace by index',
    action: 'switch-workspace-by-index',
  },
  {
    key: 'Ctrl+1-9',
    description: 'Focus terminal by index',
    action: 'focus-terminal-by-index',
  },
];

/**
 * Parse shortcut string into parts
 */
export function parseShortcut(shortcut: string): string[] {
  return shortcut.split('+').map(part => part.trim());
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: string): string {
  const parts = parseShortcut(shortcut);
  return parts.map(part => {
    // Replace common modifier names
    const replacements: Record<string, string> = {
      'Ctrl': '⌃',
      'Shift': '⇧',
      'Alt': '⌥',
      'Meta': '⌘',
    };
    return replacements[part] || part;
  }).join(' ');
}

/**
 * Check if keyboard event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string
): boolean {
  const parts = parseShortcut(shortcut.toLowerCase());
  
  const needsCtrl = parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');
  const needsMeta = parts.includes('meta');
  
  // Check modifiers
  if (needsCtrl !== event.ctrlKey) return false;
  if (needsShift !== event.shiftKey) return false;
  if (needsAlt !== event.altKey) return false;
  if (needsMeta !== event.metaKey) return false;
  
  // Check key
  const keyPart = parts.find(p => !['ctrl', 'shift', 'alt', 'meta'].includes(p));
  if (!keyPart) return false;
  
  return event.key.toLowerCase() === keyPart.toLowerCase() ||
         event.code.toLowerCase() === `key${keyPart.toLowerCase()}`;
}

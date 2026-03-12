/**
 * Default layout templates
 */

export interface TemplateConfig {
  columns: number;
  rows: number;
  name: string;
  icon?: string;
}

/**
 * Built-in layout templates
 */
export const DEFAULT_TEMPLATES: TemplateConfig[] = [
  { columns: 1, rows: 1, name: 'Single', icon: '⬜' },
  { columns: 2, rows: 1, name: '2 Columns', icon: '⬜⬜' },
  { columns: 1, rows: 2, name: '2 Rows', icon: '⬜\n⬜' },
  { columns: 2, rows: 2, name: '2×2 Grid', icon: '⬜⬜\n⬜⬜' },
  { columns: 3, rows: 2, name: '3×2 Grid', icon: '⬜⬜⬜\n⬜⬜⬜' },
  { columns: 4, rows: 4, name: '4×4 Grid', icon: '⬜⬜⬜⬜\n...' },
] as const;

/**
 * Get template by columns and rows
 */
export function getTemplate(columns: number, rows: number): TemplateConfig | undefined {
  return DEFAULT_TEMPLATES.find(t => t.columns === columns && t.rows === rows);
}

/**
 * Calculate total terminals for a layout
 */
export function calculateTotalTerminals(columns: number, rows: number): number {
  return columns * rows;
}

/**
 * Validate layout dimensions
 */
export function isValidLayout(columns: number, rows: number): boolean {
  return (
    columns >= 1 &&
    rows >= 1 &&
    columns <= 4 &&
    rows <= 4 &&
    columns * rows <= 16
  );
}

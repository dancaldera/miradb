/**
 * Smart column selection for compact list views
 */

import type { ColumnInfo } from '../types/state.js';

export type ColumnVisibilityMode = 'smart' | 'all' | 'minimal';

/**
 * Priority column names that should be shown first
 */
const PRIORITY_COLUMN_NAMES = [
  'id',
  'name',
  'title',
  'username',
  'email',
  'status',
  'type',
  'role',
  'created_at',
  'updated_at'
];

/**
 * Determine optimal display width for a column based on its type and name
 */
export function getColumnDisplayWidth(column: ColumnInfo): number {
  const name = column.name.toLowerCase();
  const type = column.dataType.toLowerCase();

  // IDs and small integers
  if (column.isPrimaryKey || name.endsWith('_id') || name === 'id') {
    return 8;
  }

  // Booleans
  if (type.includes('bool') || type.includes('bit')) {
    return 6;
  }

  // Dates
  if (type.includes('date') || type.includes('time')) {
    return 12;
  }

  // Email addresses
  if (name.includes('email')) {
    return 20;
  }

  // Status, role, type - short enums
  if (name.includes('status') || name.includes('role') || name.includes('type')) {
    return 12;
  }

  // Default text width
  return 15;
}

/**
 * Calculate priority score for a column (higher = more important)
 */
function getColumnPriority(column: ColumnInfo): number {
  const name = column.name.toLowerCase();
  let score = 0;

  // Primary keys always shown (highest priority)
  if (column.isPrimaryKey) {
    return 1000;
  }

  // Check if column name is in priority list
  const priorityIndex = PRIORITY_COLUMN_NAMES.findIndex(p => name === p || name.endsWith(`_${p}`));
  if (priorityIndex !== -1) {
    score += (PRIORITY_COLUMN_NAMES.length - priorityIndex) * 10;
  }

  // Prefer shorter text columns (likely to be readable)
  const type = column.dataType.toLowerCase();
  if (type.includes('varchar') || type.includes('text') || type.includes('char')) {
    score += 5;
  }

  // Prefer NOT NULL columns (more likely to have useful data)
  if (!column.nullable) {
    score += 3;
  }

  // Prefer date columns
  if (type.includes('date') || type.includes('time')) {
    score += 4;
  }

  return score;
}

/**
 * Select columns to display based on visibility mode
 */
export function selectVisibleColumns(
  columns: ColumnInfo[],
  mode: ColumnVisibilityMode,
  maxColumns = 5
): ColumnInfo[] {
  if (columns.length === 0) {
    return [];
  }

  switch (mode) {
    case 'all':
      return columns;

    case 'minimal': {
      // PK + first 2 text columns
      const result: ColumnInfo[] = [];

      // Add primary key
      const pk = columns.find(c => c.isPrimaryKey);
      if (pk) {
        result.push(pk);
      }

      // Add first 2 text columns
      const textColumns = columns.filter(c => {
        const type = c.dataType.toLowerCase();
        return !c.isPrimaryKey && (type.includes('varchar') || type.includes('text') || type.includes('char'));
      });

      result.push(...textColumns.slice(0, 2));
      return result.slice(0, maxColumns);
    }

    case 'smart':
    default: {
      // Smart selection based on priority
      const sorted = [...columns].sort((a, b) => getColumnPriority(b) - getColumnPriority(a));

      // Always include PK if exists
      const result: ColumnInfo[] = [];
      const pk = sorted.find(c => c.isPrimaryKey);
      if (pk) {
        result.push(pk);
      }

      // Add other high-priority columns
      const remaining = sorted.filter(c => !c.isPrimaryKey);
      const toAdd = maxColumns - result.length;
      result.push(...remaining.slice(0, toAdd));

      // Restore original order
      return result.sort((a, b) => {
        const aIndex = columns.findIndex(c => c.name === a.name);
        const bIndex = columns.findIndex(c => c.name === b.name);
        return aIndex - bIndex;
      });
    }
  }
}

/**
 * Get display label for visibility mode
 */
export function getVisibilityModeLabel(mode: ColumnVisibilityMode): string {
  switch (mode) {
    case 'all':
      return 'All Columns';
    case 'minimal':
      return 'Minimal View';
    case 'smart':
    default:
      return 'Smart View';
  }
}

/**
 * Get next visibility mode in cycle
 */
export function getNextVisibilityMode(current: ColumnVisibilityMode): ColumnVisibilityMode {
  switch (current) {
    case 'smart':
      return 'all';
    case 'all':
      return 'minimal';
    case 'minimal':
      return 'smart';
    default:
      return 'smart';
  }
}

/**
 * Color mapping utilities for database data types and values
 */

export type DataColor = 'yellow' | 'cyan' | 'green' | 'red' | 'magenta' | 'gray' | undefined;

/**
 * Determines the appropriate color for a value based on its column data type
 */
export function getColorForDataType(dataType: string, value: unknown): DataColor {
  // Handle NULL values first
  if (value === null || value === undefined) {
    return 'gray';
  }

  const normalizedType = dataType.toLowerCase();

  // Numeric types - yellow
  if (/int|float|double|decimal|numeric|real|number/.test(normalizedType)) {
    return 'yellow';
  }

  // Date/Time types - cyan
  if (/date|time|timestamp/.test(normalizedType)) {
    return 'cyan';
  }

  // Boolean types - green for true, red for false
  if (/bool/.test(normalizedType)) {
    // Handle different boolean representations
    if (value === true || value === 1 || value === '1' || value === 't' || value === 'true') {
      return 'green';
    }
    if (value === false || value === 0 || value === '0' || value === 'f' || value === 'false') {
      return 'red';
    }
  }

  // JSON types - magenta
  if (/json/.test(normalizedType)) {
    return 'magenta';
  }

  // Binary types - gray
  if (/blob|binary|bytea/.test(normalizedType)) {
    return 'gray';
  }

  // Text types and everything else - default color (undefined)
  return undefined;
}

/**
 * Format a value for display with appropriate truncation
 */
export function formatValueWithTruncation(value: unknown, maxLength = 40): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
  }

  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

/**
 * Get color specifically for column headers
 */
export function getHeaderColor(): DataColor {
  return 'cyan';
}

/**
 * Detect if a column type is likely a primary key based on naming
 */
export function isProbablyPrimaryKey(columnName: string): boolean {
  const name = columnName.toLowerCase();
  return name === 'id' || name.endsWith('_id') || name === 'pk';
}

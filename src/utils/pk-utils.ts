import type { ColumnInfo } from "../types/state.js";

/**
 * Get all primary key columns from a list of columns
 */
export function getPrimaryKeyColumns(columns: ColumnInfo[]): ColumnInfo[] {
	return columns.filter((column) => column.isPrimaryKey);
}

/**
 * Get all non-primary key columns from a list of columns
 */
export function getNonPrimaryKeyColumns(columns: ColumnInfo[]): ColumnInfo[] {
	return columns.filter((column) => !column.isPrimaryKey);
}

/**
 * Check if the table has any primary key columns
 */
export function hasPrimaryKeyColumns(columns: ColumnInfo[]): boolean {
	return columns.some((column) => column.isPrimaryKey);
}

/**
 * Get the name of the first primary key column, or null if no PK exists
 */
export function getPrimaryKeyColumnName(columns: ColumnInfo[]): string | null {
	const pkColumn = columns.find((column) => column.isPrimaryKey);
	return pkColumn?.name ?? null;
}

/**
 * Get the primary key columns that should be fixed in view
 * - If 1-2 PK columns: return all PK columns
 * - If >2 PK columns: return only the first PK column
 * - If no PK columns: return empty array
 */
export function getFixedPKColumns(columns: ColumnInfo[]): ColumnInfo[] {
	const pkColumns = getPrimaryKeyColumns(columns);
	if (pkColumns.length === 0) {
		return [];
	}
	if (pkColumns.length <= 2) {
		return pkColumns;
	}
	// If more than 2 PK columns, only fix the first one for space efficiency
	return [pkColumns[0]];
}

/**
 * Get the navigable columns (non-PK columns) for the regular navigation area
 */
export function getNavigableColumns(columns: ColumnInfo[]): ColumnInfo[] {
	const fixedPKColumns = getFixedPKColumns(columns);
	const fixedPKNames = new Set(fixedPKColumns.map((col) => col.name));
	return columns.filter((column) => !fixedPKNames.has(column.name));
}

/**
 * Calculate how many regular columns can be shown alongside fixed PK columns
 */
export function getMaxNavigableColumns(
	totalVisibleColumns: number,
	pkColumns: ColumnInfo[],
): number {
	const fixedPKCount = pkColumns.length;
	const remainingSpace = totalVisibleColumns - fixedPKCount;
	return Math.max(1, remainingSpace); // Ensure at least 1 navigable column
}

/**
 * Get a display label for primary key columns
 */
export function getPKDisplayLabel(pkColumns: ColumnInfo[]): string {
	if (pkColumns.length === 0) {
		return "";
	}
	if (pkColumns.length === 1) {
		return `PK: ${pkColumns[0].name}`;
	}
	return `PKs: ${pkColumns.map((col) => col.name).join(", ")}`;
}

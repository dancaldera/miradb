/**
 * Smart column selection for compact list views
 */

import type { ColumnInfo } from "../types/state.js";

export type ColumnVisibilityMode = "smart" | "all" | "minimal";

/**
 * Priority column names that should be shown first
 */
const PRIORITY_COLUMN_NAMES = [
	"id",
	"name",
	"title",
	"username",
	"email",
	"status",
	"type",
	"role",
	"created_at",
	"updated_at",
];

/**
 * Determine optimal display width for a column based on its type and name
 */
export function getColumnDisplayWidth(column: ColumnInfo): number {
	const name = column.name.toLowerCase();
	const type = column.dataType.toLowerCase();

	// Calculate minimum width based on column name length (including PK indicator)
	const headerLength = column.name.length + (column.isPrimaryKey ? 2 : 0); // +2 for 🔑 emoji
	const minHeaderWidth = Math.max(headerLength + 2, 6); // +2 padding, minimum 6

	// Get base width from data type
	let baseWidth: number;

	// IDs and small integers
	if (column.isPrimaryKey || name.endsWith("_id") || name === "id") {
		baseWidth = 6;
	}
	// Booleans - very compact
	else if (type.includes("bool") || type.includes("bit")) {
		baseWidth = 5;
	}
	// Dates - compact format
	else if (type.includes("date") || type.includes("time")) {
		baseWidth = 10;
	}
	// Email addresses - more compact
	else if (name.includes("email")) {
		baseWidth = 15;
	}
	// Status, role, type - short enums - compact
	else if (
		name.includes("status") ||
		name.includes("role") ||
		name.includes("type")
	) {
		baseWidth = 8;
	}
	// Short text columns
	else if (name.includes("name") || name.includes("title")) {
		baseWidth = 12;
	}
	// Default text width
	else {
		baseWidth = 10;
	}

	// Use the larger of header width or base width, but cap at maximum
	const finalWidth = Math.max(minHeaderWidth, baseWidth);
	return Math.min(finalWidth, 20); // Reduced maximum width for better table fitting
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
	const priorityIndex = PRIORITY_COLUMN_NAMES.findIndex(
		(p) => name === p || name.endsWith(`_${p}`),
	);
	if (priorityIndex !== -1) {
		score += (PRIORITY_COLUMN_NAMES.length - priorityIndex) * 10;
	}

	// Prefer shorter text columns (likely to be readable)
	const type = column.dataType.toLowerCase();
	if (
		type.includes("varchar") ||
		type.includes("text") ||
		type.includes("char")
	) {
		score += 5;
	}

	// Prefer NOT NULL columns (more likely to have useful data)
	if (!column.nullable) {
		score += 3;
	}

	// Prefer date columns
	if (type.includes("date") || type.includes("time")) {
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
	maxColumns = 5,
): ColumnInfo[] {
	if (columns.length === 0) {
		return [];
	}

	switch (mode) {
		case "all":
			return columns;

		case "minimal": {
			// PK + first 2 text columns
			const result: ColumnInfo[] = [];

			// Add primary key
			const pk = columns.find((c) => c.isPrimaryKey);
			if (pk) {
				result.push(pk);
			}

			// Add first 2 text columns
			const textColumns = columns.filter((c) => {
				const type = c.dataType.toLowerCase();
				return (
					!c.isPrimaryKey &&
					(type.includes("varchar") ||
						type.includes("text") ||
						type.includes("char"))
				);
			});

			result.push(...textColumns.slice(0, 2));
			return result.slice(0, maxColumns);
		}

		case "smart":
		default: {
			// Smart selection based on priority
			const sorted = [...columns].sort(
				(a, b) => getColumnPriority(b) - getColumnPriority(a),
			);

			// Always include PK if exists
			const result: ColumnInfo[] = [];
			const pk = sorted.find((c) => c.isPrimaryKey);
			if (pk) {
				result.push(pk);
			}

			// Add other high-priority columns
			const remaining = sorted.filter((c) => !c.isPrimaryKey);
			const toAdd = maxColumns - result.length;
			result.push(...remaining.slice(0, toAdd));

			// Restore original order
			return result.sort((a, b) => {
				const aIndex = columns.findIndex((c) => c.name === a.name);
				const bIndex = columns.findIndex((c) => c.name === b.name);
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
		case "all":
			return "All Columns";
		case "minimal":
			return "Minimal View";
		case "smart":
		default:
			return "Smart View";
	}
}

/**
 * Get next visibility mode in cycle
 */
export function getNextVisibilityMode(
	current: ColumnVisibilityMode,
): ColumnVisibilityMode {
	switch (current) {
		case "smart":
			return "all";
		case "all":
			return "minimal";
		case "minimal":
			return "smart";
		default:
			return "smart";
	}
}

/**
 * Calculate total table width from visible columns
 */
export interface TableWidthOptions {
	includeBorders?: boolean;
	includeIndicator?: boolean;
	minimum?: number;
}

const DEFAULT_TABLE_MIN_WIDTH = 40;
const INDICATOR_WIDTH = 2; // Accounts for selection arrow + space

export function calculateTableWidth(
	columns: ColumnInfo[],
	options?: TableWidthOptions,
): number {
	const includeBorders = options?.includeBorders ?? true;
	const includeIndicator = options?.includeIndicator ?? true;
	const minimum = options?.minimum ?? DEFAULT_TABLE_MIN_WIDTH;

	// Sum all column widths plus separators (1 char per separator)
	const totalWidth = columns.reduce(
		(sum, column) => sum + getColumnDisplayWidth(column),
		0,
	);
	const separatorWidth = Math.max(0, columns.length - 1); // One separator between each column
	const indicatorWidth =
		includeIndicator && columns.length > 0 ? INDICATOR_WIDTH : 0;
	const borderWidth = includeBorders ? 2 : 0;

	const calculatedWidth =
		totalWidth + separatorWidth + indicatorWidth + borderWidth;

	if (columns.length === 0) {
		return Math.max(indicatorWidth + borderWidth, minimum);
	}

	return Math.max(calculatedWidth, minimum);
}

/**
 * Generate appropriate border line for table width
 */
export function generateBorderLine(
	columns: ColumnInfo[],
	minLength = 30,
	maxLength?: number,
): string {
	const tableWidth = calculateTableWidth(columns, {
		includeIndicator: true,
		minimum: 0,
	});
	const cappedMax =
		maxLength !== undefined ? Math.max(maxLength, minLength) : tableWidth;
	const finalLength = Math.max(Math.min(tableWidth, cappedMax), minLength);
	return "─".repeat(finalLength);
}

/**
 * Format column list for display below table
 */
export function formatColumnList(columns: ColumnInfo[]): string {
	if (columns.length === 0) return "";

	return columns
		.map((column) => {
			let name = column.name;

			// Add PK indicator
			if (column.isPrimaryKey) {
				name = `${name} (PK)`;
			}

			// Add data type info (shortened)
			let typeInfo = "";
			const type = column.dataType.toLowerCase();

			if (type.includes("varchar") || type.includes("char")) {
				typeInfo = "text";
			} else if (type.includes("int")) {
				typeInfo = "int";
			} else if (type.includes("bool")) {
				typeInfo = "bool";
			} else if (type.includes("date") || type.includes("time")) {
				typeInfo = type.includes("timestamp") ? "timestamp" : "date";
			} else if (type.includes("json")) {
				typeInfo = "json";
			} else if (type.includes("text")) {
				typeInfo = "text";
			} else {
				// Take first 4 chars of type if it's longer
				typeInfo = type.substring(0, 4);
			}

			// Add nullable indicator
			if (column.nullable) {
				typeInfo += " (null)";
			}

			return `${name}: ${typeInfo}`;
		})
		.join(" • ");
}

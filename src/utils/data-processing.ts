import type { ColumnInfo, DataRow, SortConfig } from "../types/state.js";

export function isNumeric(value: unknown): boolean {
	if (typeof value === "number") return true;
	if (typeof value !== "string") return false;
	return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

export function isDateLike(value: unknown): boolean {
	if (value instanceof Date) return true;
	if (typeof value !== "string") return false;

	const datePatterns = [
		/^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601
		/^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
	];

	return datePatterns.some((pattern) => pattern.test(value));
}

export function parseValue(value: unknown): number | Date | string {
	if (value === null || value === undefined) return "";

	if (typeof value === "number") return value;
	if (typeof value === "boolean") return value ? "true" : "false";
	if (value instanceof Date) return value;

	const strValue = String(value);

	// Try to parse as number
	if (isNumeric(strValue)) {
		const num = parseFloat(strValue);
		if (!isNaN(num)) return num;
	}

	// Try to parse as date
	if (isDateLike(strValue)) {
		const date = new Date(strValue);
		if (!isNaN(date.getTime())) return date;
	}

	return strValue;
}

export function compareValues(
	a: unknown,
	b: unknown,
	direction: "asc" | "desc",
): number {
	const parsedA = parseValue(a);
	const parsedB = parseValue(b);

	let comparison = 0;

	if (typeof parsedA === "number" && typeof parsedB === "number") {
		comparison = parsedA - parsedB;
	} else if (parsedA instanceof Date && parsedB instanceof Date) {
		comparison = parsedA.getTime() - parsedB.getTime();
	} else if (parsedA instanceof Date) {
		comparison = -1; // Dates come after strings
	} else if (parsedB instanceof Date) {
		comparison = 1;
	} else {
		const strA = String(parsedA).toLowerCase();
		const strB = String(parsedB).toLowerCase();
		comparison = strA.localeCompare(strB);
	}

	return direction === "asc" ? comparison : -comparison;
}

export function sortRows(rows: DataRow[], sortConfig: SortConfig): DataRow[] {
	if (!sortConfig.column || sortConfig.direction === "off") {
		return rows;
	}

	return [...rows].sort((a, b) => {
		return compareValues(
			a[sortConfig.column!],
			b[sortConfig.column!],
			sortConfig.direction,
		);
	});
}

export function filterRows(
	rows: DataRow[],
	filterValue: string,
	columns: ColumnInfo[],
): DataRow[] {
	if (!filterValue.trim()) {
		return rows;
	}

	const lowerFilter = filterValue.toLowerCase();

	return rows.filter((row) => {
		return columns.some((column) => {
			const value = row[column.name];
			if (value === null || value === undefined) return false;
			return String(value).toLowerCase().includes(lowerFilter);
		});
	});
}

export function processRows(
	rows: DataRow[],
	sortConfig: SortConfig,
	filterValue: string,
	columns: ColumnInfo[],
): DataRow[] {
	let processedRows = rows;

	// Apply filtering first
	processedRows = filterRows(processedRows, filterValue, columns);

	// Then apply sorting
	processedRows = sortRows(processedRows, sortConfig);

	return processedRows;
}

export function formatValueForDisplay(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function truncateString(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return str.substring(0, maxLength - 3) + "...";
}

export function calculateColumnWidth(
	columnName: string,
	values: unknown[],
	maxWidth: number = 50,
): number {
	const headerWidth = columnName.length;
	const maxValueWidth = Math.max(
		...values.map((v) => formatValueForDisplay(v).length),
	);
	return Math.min(Math.max(headerWidth, maxValueWidth) + 2, maxWidth);
}

import { describe, expect, it } from "bun:test";
import type { ColumnInfo, DataRow, SortConfig } from "../../src/types/state.js";
import {
	calculateColumnWidth,
	compareValues,
	filterRows,
	formatValueForDisplay,
	isDateLike,
	isNumeric,
	parseValue,
	processRows,
	sortRows,
	truncateString,
} from "../../src/utils/data-processing.js";

describe("isNumeric", () => {
	it("returns true for numbers", () => {
		expect(isNumeric(42)).toBe(true);
		expect(isNumeric(3.14)).toBe(true);
		expect(isNumeric(-10)).toBe(true);
		expect(isNumeric(0)).toBe(true);
	});

	it("returns true for numeric strings", () => {
		expect(isNumeric("42")).toBe(true);
		expect(isNumeric("3.14")).toBe(true);
		expect(isNumeric("-10")).toBe(true);
		expect(isNumeric("0")).toBe(true);
		expect(isNumeric("1e5")).toBe(true);
		expect(isNumeric("-2.5e-3")).toBe(true);
	});

	it("returns false for non-numeric strings", () => {
		expect(isNumeric("abc")).toBe(false);
		expect(isNumeric("42a")).toBe(false);
		expect(isNumeric("")).toBe(false);
		expect(isNumeric("   ")).toBe(false);
		expect(isNumeric("NaN")).toBe(false);
		expect(isNumeric("Infinity")).toBe(false);
	});

	it("returns false for other types", () => {
		expect(isNumeric(true)).toBe(false);
		expect(isNumeric(null)).toBe(false);
		expect(isNumeric(undefined)).toBe(false);
		expect(isNumeric({})).toBe(false);
		expect(isNumeric([])).toBe(false);
		expect(isNumeric(new Date())).toBe(false);
	});
});

describe("isDateLike", () => {
	it("returns true for Date objects", () => {
		expect(isDateLike(new Date())).toBe(true);
		expect(isDateLike(new Date("2023-01-01"))).toBe(true);
	});

	it("returns true for YYYY-MM-DD format", () => {
		expect(isDateLike("2023-01-01")).toBe(true);
		expect(isDateLike("1999-12-31")).toBe(true);
		expect(isDateLike("2024-02-29")).toBe(true);
	});

	it("returns true for ISO 8601 format", () => {
		expect(isDateLike("2023-01-01T12:30:45")).toBe(true);
		expect(isDateLike("2023-01-01T12:30:45.123Z")).toBe(true);
		expect(isDateLike("2023-01-01T12:30:45+05:30")).toBe(true);
	});

	it("returns true for MM/DD/YYYY format", () => {
		expect(isDateLike("01/01/2023")).toBe(true);
		expect(isDateLike("12/31/1999")).toBe(true);
		expect(isDateLike("02/29/2024")).toBe(true);
	});

	it("returns false for invalid dates", () => {
		// Note: The regex patterns are not strict enough to validate actual dates
		// They just check the format, so "2023-13-01" matches YYYY-MM-DD pattern
		expect(isDateLike("13/01/2023")).toBe(false); // Invalid month format
		expect(isDateLike("not-a-date")).toBe(false);
		expect(isDateLike("")).toBe(false);
	});

	it("returns false for other types", () => {
		expect(isDateLike(123)).toBe(false);
		expect(isDateLike(true)).toBe(false);
		expect(isDateLike(null)).toBe(false);
		expect(isDateLike(undefined)).toBe(false);
		expect(isDateLike({})).toBe(false);
		expect(isDateLike([])).toBe(false);
	});
});

describe("parseValue", () => {
	it("returns empty string for null and undefined", () => {
		expect(parseValue(null)).toBe("");
		expect(parseValue(undefined)).toBe("");
	});

	it("returns numbers as-is", () => {
		expect(parseValue(42)).toBe(42);
		expect(parseValue(3.14)).toBe(3.14);
		expect(parseValue(-10)).toBe(-10);
	});

	it("converts booleans to strings", () => {
		expect(parseValue(true)).toBe("true");
		expect(parseValue(false)).toBe("false");
	});

	it("returns Date objects as-is", () => {
		const date = new Date("2023-01-01");
		expect(parseValue(date)).toBe(date);
	});

	it("parses numeric strings to numbers", () => {
		expect(parseValue("42")).toBe(42);
		expect(parseValue("3.14")).toBe(3.14);
		expect(parseValue("-10")).toBe(-10);
		expect(parseValue("1e5")).toBe(100000);
	});

	it("parses date-like strings to Date objects", () => {
		const result1 = parseValue("2023-01-01");
		expect(result1).toBeInstanceOf(Date);
		if (result1 instanceof Date) {
			expect(result1.getFullYear()).toBe(2023);
		}

		const result2 = parseValue("2023-01-01T12:30:45");
		expect(result2).toBeInstanceOf(Date);

		const result3 = parseValue("01/01/2023");
		expect(result3).toBeInstanceOf(Date);
	});

	it("returns other values as strings", () => {
		expect(parseValue("hello")).toBe("hello");
		expect(parseValue("")).toBe("");
		expect(parseValue("123abc")).toBe("123abc");
		expect(parseValue({})).toBe("[object Object]");
		expect(parseValue([])).toBe("");
	});
});

describe("compareValues", () => {
	it("compares numbers correctly", () => {
		expect(compareValues(1, 2, "asc")).toBe(-1);
		expect(compareValues(2, 1, "asc")).toBe(1);
		expect(compareValues(1, 1, "asc")).toBe(0);
		expect(compareValues(1, 2, "desc")).toBe(1);
		expect(compareValues(2, 1, "desc")).toBe(-1);
	});

	it("compares dates correctly", () => {
		const date1 = new Date("2023-01-01");
		const date2 = new Date("2023-01-02");

		// Date comparison returns the time difference in milliseconds
		const timeDiff = date1.getTime() - date2.getTime();
		expect(compareValues(date1, date2, "asc")).toBe(timeDiff);
		expect(compareValues(date2, date1, "asc")).toBe(-timeDiff);
		expect(compareValues(date1, date1, "asc")).toBe(0);
		expect(compareValues(date1, date2, "desc")).toBe(-timeDiff);
	});

	it("compares date vs string correctly", () => {
		const date = new Date("2023-01-01");
		expect(compareValues(date, "hello", "asc")).toBe(-1);
		expect(compareValues("hello", date, "asc")).toBe(1);
	});

	it("compares strings correctly (case-insensitive)", () => {
		expect(compareValues("apple", "banana", "asc")).toBe(-1);
		expect(compareValues("banana", "apple", "asc")).toBe(1);
		expect(compareValues("Apple", "apple", "asc")).toBe(0);
		expect(compareValues("apple", "banana", "desc")).toBe(1);
	});

	it("handles mixed types by parsing", () => {
		expect(compareValues("123", 456, "asc")).toBe(-333);
		const date = new Date("2023-01-01");
		const date2 = new Date("2023-01-02");
		const timeDiff = date.getTime() - date2.getTime();
		expect(compareValues("2023-01-01", date2, "asc")).toBe(timeDiff);
	});

	it("handles null/undefined values", () => {
		expect(compareValues(null, "hello", "asc")).toBe(-1);
		expect(compareValues("hello", null, "asc")).toBe(1);
		expect(compareValues(null, null, "asc")).toBe(0);
		expect(compareValues(undefined, "hello", "asc")).toBe(-1);
	});

	it("orders dates before numeric values with equal weight", () => {
		const date = new Date("2023-01-01T00:00:00Z");
		expect(compareValues(date, "42", "asc")).toBe(-1);
	});

	it("classifies plain strings with lowest priority weight", () => {
		expect(compareValues("alpha", "beta", "asc")).toBeLessThan(0);
	});
});

describe("sortRows", () => {
	const mockRows: DataRow[] = [
		{ id: 1, name: "Alice", age: 30 },
		{ id: 2, name: "Bob", age: 25 },
		{ id: 3, name: "Charlie", age: 35 },
	];

	it("sorts ascending by column", () => {
		const sortConfig: SortConfig = { column: "age", direction: "asc" };
		const result = sortRows(mockRows, sortConfig);

		expect(result[0].age).toBe(25);
		expect(result[1].age).toBe(30);
		expect(result[2].age).toBe(35);
	});

	it("sorts descending by column", () => {
		const sortConfig: SortConfig = { column: "age", direction: "desc" };
		const result = sortRows(mockRows, sortConfig);

		expect(result[0].age).toBe(35);
		expect(result[1].age).toBe(30);
		expect(result[2].age).toBe(25);
	});

	it("returns original rows when sorting is off", () => {
		const sortConfig: SortConfig = { column: "age", direction: "off" };
		const result = sortRows(mockRows, sortConfig);

		expect(result).toEqual(mockRows);
	});

	it("returns original rows when no column specified", () => {
		const sortConfig: SortConfig = { column: "", direction: "asc" };
		const result = sortRows(mockRows, sortConfig);

		expect(result).toEqual(mockRows);
	});

	it("does not mutate original array", () => {
		const sortConfig: SortConfig = { column: "age", direction: "asc" };
		const originalCopy = [...mockRows];
		sortRows(mockRows, sortConfig);

		expect(mockRows).toEqual(originalCopy);
	});

	it("handles missing values in sort column", () => {
		const rowsWithMissing: DataRow[] = [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob", age: 25 },
			{ id: 3, name: "Charlie", age: null },
		];
		const sortConfig: SortConfig = { column: "age", direction: "asc" };
		const result = sortRows(rowsWithMissing, sortConfig);

		// Missing values (null/undefined) get parsed to empty string ""
		// Empty strings come before numbers in localeCompare
		expect(result[0].age).toBeNull(); // null values come first
		expect(result[1].age).toBe(25); // Numbers come after strings
	});
});

describe("filterRows", () => {
	const mockRows: DataRow[] = [
		{ id: 1, name: "Alice Johnson", age: 30, city: "New York" },
		{ id: 2, name: "Bob Smith", age: 25, city: "Los Angeles" },
		{ id: 3, name: "Charlie Brown", age: 35, city: "New York" },
	];

	const mockColumns: ColumnInfo[] = [
		{ name: "id", dataType: "integer", nullable: false },
		{ name: "name", dataType: "varchar", nullable: false },
		{ name: "age", dataType: "integer", nullable: false },
		{ name: "city", dataType: "varchar", nullable: true },
	];

	it("filters rows based on text search", () => {
		const result = filterRows(mockRows, "alice", mockColumns);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Alice Johnson");
	});

	it("filters case-insensitively", () => {
		const result = filterRows(mockRows, "ALICE", mockColumns);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Alice Johnson");
	});

	it("filters across all columns", () => {
		const result = filterRows(mockRows, "new york", mockColumns);
		expect(result).toHaveLength(2);
	});

	it("filters numeric values", () => {
		const result = filterRows(mockRows, "30", mockColumns);
		expect(result).toHaveLength(1);
		expect(result[0].age).toBe(30);
	});

	it("returns all rows when filter is empty", () => {
		const result = filterRows(mockRows, "", mockColumns);
		expect(result).toEqual(mockRows);
	});

	it("returns all rows when filter is whitespace only", () => {
		const result = filterRows(mockRows, "   ", mockColumns);
		expect(result).toEqual(mockRows);
	});

	it("handles null/undefined values", () => {
		const rowsWithNulls: DataRow[] = [
			{ id: 1, name: "Alice", age: null },
			{ id: 2, name: null, age: 25 },
		];
		const result = filterRows(rowsWithNulls, "alice", mockColumns);
		expect(result).toHaveLength(1);
	});

	it("returns empty array when no matches found", () => {
		const result = filterRows(mockRows, "xyz", mockColumns);
		expect(result).toHaveLength(0);
	});
});

describe("processRows", () => {
	const mockRows: DataRow[] = [
		{ id: 1, name: "Alice Johnson", age: 30, city: "New York" },
		{ id: 2, name: "Bob Smith", age: 25, city: "Los Angeles" },
		{ id: 3, name: "Charlie Brown", age: 35, city: "New York" },
	];

	const mockColumns: ColumnInfo[] = [
		{ name: "id", dataType: "integer", nullable: false },
		{ name: "name", dataType: "varchar", nullable: false },
		{ name: "age", dataType: "integer", nullable: false },
		{ name: "city", dataType: "varchar", nullable: true },
	];

	it("applies both filtering and sorting", () => {
		const sortConfig: SortConfig = { column: "age", direction: "desc" };
		const result = processRows(mockRows, sortConfig, "new york", mockColumns);

		expect(result).toHaveLength(2);
		expect(result[0].age).toBe(35); // Charlie (35) comes before Alice (30)
		expect(result[1].age).toBe(30);
	});

	it("applies only sorting when no filter", () => {
		const sortConfig: SortConfig = { column: "age", direction: "asc" };
		const result = processRows(mockRows, sortConfig, "", mockColumns);

		expect(result).toHaveLength(3);
		expect(result[0].age).toBe(25);
		expect(result[1].age).toBe(30);
		expect(result[2].age).toBe(35);
	});

	it("applies only filtering when sorting is off", () => {
		const sortConfig: SortConfig = { column: "age", direction: "off" };
		const result = processRows(mockRows, sortConfig, "alice", mockColumns);

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Alice Johnson");
	});

	it("returns original rows when no filter or sort", () => {
		const sortConfig: SortConfig = { column: "", direction: "off" };
		const result = processRows(mockRows, sortConfig, "", mockColumns);

		expect(result).toEqual(mockRows);
	});
});

describe("formatValueForDisplay", () => {
	it("formats null and undefined as NULL", () => {
		expect(formatValueForDisplay(null)).toBe("NULL");
		expect(formatValueForDisplay(undefined)).toBe("NULL");
	});

	it("formats dates as ISO strings", () => {
		const date = new Date("2023-01-01T12:30:45.123Z");
		expect(formatValueForDisplay(date)).toBe(date.toISOString());
	});

	it("formats objects as JSON", () => {
		const obj = { key: "value", num: 42 };
		expect(formatValueForDisplay(obj)).toBe(JSON.stringify(obj));
	});

	it("formats other types as strings", () => {
		expect(formatValueForDisplay("hello")).toBe("hello");
		expect(formatValueForDisplay(42)).toBe("42");
		expect(formatValueForDisplay(true)).toBe("true");
		expect(formatValueForDisplay(false)).toBe("false");
	});
});

describe("truncateString", () => {
	it("returns original string when under limit", () => {
		expect(truncateString("hello", 10)).toBe("hello");
		expect(truncateString("hello", 5)).toBe("hello");
	});

	it("truncates string when over limit", () => {
		expect(truncateString("hello world", 8)).toBe("hello...");
		expect(truncateString("1234567890", 5)).toBe("12...");
	});

	it("handles edge cases", () => {
		expect(truncateString("hello", 3)).toBe("...");
		expect(truncateString("hello", 4)).toBe("h...");
		expect(truncateString("", 10)).toBe("");
	});
});

describe("calculateColumnWidth", () => {
	it("calculates width based on header and content", () => {
		const values = ["Alice", "Bob", "Charlie Brown"];
		const width = calculateColumnWidth("name", values);

		expect(width).toBeGreaterThanOrEqual("Charlie Brown".length + 2);
		expect(width).toBeLessThanOrEqual(52); // default max + 2
	});

	it("respects custom max width", () => {
		const values = ["Very long name that exceeds the default limit"];
		const width = calculateColumnWidth("name", values, 20);

		expect(width).toBe(20);
	});

	it("adds padding to calculated width", () => {
		const values = ["short"];
		const width = calculateColumnWidth("column", values);

		expect(width).toBe(Math.max("column".length, "short".length) + 2);
	});

	it("handles mixed value types", () => {
		const values = ["text", 123, true, null, new Date("2023-01-01")];
		const width = calculateColumnWidth("mixed", values);

		expect(width).toBeGreaterThan(0);
		expect(width).toBeLessThanOrEqual(52);
	});

	it("handles empty values array", () => {
		const width = calculateColumnWidth("empty", []);

		expect(width).toBe("empty".length + 2);
	});

	it("handles null/undefined values in array", () => {
		const values = ["Alice", null, undefined, "Bob"];
		const width = calculateColumnWidth("name", values);

		expect(width).toBe(
			Math.max("name".length, "Alice".length, "NULL".length) + 2,
		);
	});
});

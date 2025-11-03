import { describe, expect, it } from "bun:test";
import { ActionType } from "../../src/state/actions.js";
import { tableCacheKey } from "../../src/state/cache.js";
import { appReducer } from "../../src/state/reducer.js";
import { initialAppState, type TableInfo } from "../../src/types/state.js";

const table: TableInfo = {
	schema: "public",
	name: "users",
	type: "table",
};

describe("appReducer UpdateDataRowValue", () => {
	it("updates data rows, expanded row, and cached rows", () => {
		const cacheKey = tableCacheKey(table)!;
		const initialState = {
			...initialAppState,
			selectedTable: table,
			selectedRowIndex: 0,
			dataRows: [{ id: 1, name: "Alice" }],
			expandedRow: { id: 1, name: "Alice" },
			tableCache: {
				[cacheKey]: {
					columns: [],
					rows: [{ id: 1, name: "Alice" }],
					hasMore: false,
					offset: 0,
				},
			},
		};

		const nextState = appReducer(initialState, {
			type: ActionType.UpdateDataRowValue,
			columnName: "name",
			value: "Bob",
			rowIndex: 0,
			table,
		});

		expect(nextState.dataRows[0].name).toBe("Bob");
		expect(nextState.expandedRow?.name).toBe("Bob");
		expect(nextState.tableCache[cacheKey].rows[0].name).toBe("Bob");
	});

	it("falls back to selectedRowIndex when rowIndex is null", () => {
		const initialState = {
			...initialAppState,
			selectedTable: table,
			selectedRowIndex: 1,
			dataRows: [
				{ id: 1, notes: "hello" },
				{ id: 2, notes: "hi" },
			],
			expandedRow: null,
		};

		const nextState = appReducer(initialState, {
			type: ActionType.UpdateDataRowValue,
			columnName: "notes",
			value: "edited",
			rowIndex: null,
			table,
		});

		expect(nextState.dataRows[1].notes).toBe("edited");
	});

	it("skips cache update when cache missing", () => {
		const initialState = {
			...initialAppState,
			selectedTable: table,
			selectedRowIndex: 0,
			dataRows: [{ id: 1, info: "a" }],
			tableCache: {},
		};

		const nextState = appReducer(initialState, {
			type: ActionType.UpdateDataRowValue,
			columnName: "info",
			value: "b",
			rowIndex: 0,
			table,
		});

		expect(nextState.tableCache).toEqual({});
	});
});

describe("appReducer miscellaneous actions", () => {
	it("updates showCommandHints flag", () => {
		const nextState = appReducer(initialAppState, {
			type: ActionType.SetShowCommandHints,
			show: false,
		});
		expect(nextState.showCommandHints).toBe(false);
	});
});

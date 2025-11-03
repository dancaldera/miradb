import type { DBType, ViewHistoryEntry } from "../types/state.js";
import { ViewState } from "../types/state.js";

/**
 * Creates a unique ID for history entries
 */
function generateHistoryId(): string {
	return `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a view history entry with standardized format
 */
export function createHistoryEntry(
	view: ViewState,
	summary: string,
	data?: {
		dbType?: DBType;
		tableName?: string;
		connectionName?: string;
		query?: string;
		[key: string]: unknown;
	},
): ViewHistoryEntry {
	return {
		id: generateHistoryId(),
		view,
		timestamp: Date.now(),
		summary,
		data,
	};
}

/**
 * Helper to create history entries for common view transitions
 */
export const historyHelpers = {
	dbTypeSelected: (dbType: DBType) =>
		createHistoryEntry(ViewState.DBType, `Selected ${dbType}`, { dbType }),

	connectionEstablished: (connectionName: string, dbType: DBType) =>
		createHistoryEntry(ViewState.Connection, `Connected to ${connectionName}`, {
			connectionName,
			dbType,
		}),

	tablesLoaded: (count: number) =>
		createHistoryEntry(ViewState.Tables, `Loaded ${count} tables`),

	tableSelected: (tableName: string) =>
		createHistoryEntry(ViewState.Tables, `Selected table: ${tableName}`, {
			tableName,
		}),

	columnsViewed: (tableName: string, columnCount: number) =>
		createHistoryEntry(
			ViewState.Columns,
			`Viewing ${columnCount} columns in ${tableName}`,
			{ tableName },
		),

	dataPreview: (tableName: string) =>
		createHistoryEntry(
			ViewState.DataPreview,
			`Preview data from ${tableName}`,
			{
				tableName,
			},
		),

	queryExecuted: (query: string) =>
		createHistoryEntry(ViewState.Query, `Executed query`, { query }),

	searchPerformed: (term: string) =>
		createHistoryEntry(ViewState.Search, `Searched for: ${term}`, {
			query: term,
		}),
};

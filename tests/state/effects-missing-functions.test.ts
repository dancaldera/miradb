import type { Mock } from "bun:test";
import { vi } from "bun:test";

vi.mock("../../src/database/connection.js", () => ({
	createDatabaseConnection: vi.fn(),
}));

vi.mock("../../src/utils/persistence.js", () => ({
	loadConnections: vi.fn(async () => ({
		connections: [],
		normalized: 0,
		skipped: 0,
	})),
	loadQueryHistory: vi.fn(async () => []),
	loadTableCache: vi.fn(async () => ({})),
	saveConnections: vi.fn(async () => {}),
	saveQueryHistory: vi.fn(async () => {}),
	saveTableCache: vi.fn(async () => {}),
}));

vi.mock("../../src/utils/export.js", () => ({
	exportData: vi.fn(async () => "/path/to/export.csv"),
	formatExportSummary: vi.fn(() => "Export summary"),
}));

vi.mock("../../src/utils/history.ts", () => ({
	historyHelpers: {
		queryExecuted: vi.fn(() => ({
			id: "1",
			view: "Tables" as any,
			summary: "Query executed",
			timestamp: "2023-01-01T00:00:00.000Z",
		})),
		connectionEstablished: vi.fn(() => ({
			id: "1",
			view: "Connection" as any,
			summary: "Connection established",
			timestamp: "2023-01-01T00:00:00.000Z",
		})),
	},
}));

import { beforeEach, describe, expect, it } from "bun:test";
import { createDatabaseConnection } from "../../src/database/connection.js";
import { ConnectionError, DatabaseError } from "../../src/database/errors.js";
import type {
	DatabaseConfig,
	DatabaseConnection,
} from "../../src/database/types.js";
import { ActionType } from "../../src/state/actions.js";
import * as effects from "../../src/state/effects.js";
import type { ColumnInfo, DataRow, TableInfo } from "../../src/types/state.js";
import { DBType, initialAppState, ViewState } from "../../src/types/state.js";
import * as exportUtils from "../../src/utils/export.js";
import { historyHelpers } from "../../src/utils/history.js";
import * as persistence from "../../src/utils/persistence.js";

const createDatabaseConnectionMock = createDatabaseConnection as Mock<
	typeof createDatabaseConnection
>;
const loadConnectionsMock = persistence.loadConnections as Mock<
	typeof persistence.loadConnections
>;
const loadQueryHistoryMock = persistence.loadQueryHistory as Mock<
	typeof persistence.loadQueryHistory
>;
const loadTableCacheMock = persistence.loadTableCache as Mock<
	typeof persistence.loadTableCache
>;
const saveConnectionsMock = persistence.saveConnections as Mock<
	typeof persistence.saveConnections
>;
const saveQueryHistoryMock = persistence.saveQueryHistory as Mock<
	typeof persistence.saveQueryHistory
>;
const saveTableCacheMock = persistence.saveTableCache as Mock<
	typeof persistence.saveTableCache
>;
const exportDataMock = exportUtils.exportData as Mock<
	typeof exportUtils.exportData
>;
const formatExportSummaryMock = exportUtils.formatExportSummary as Mock<
	typeof exportUtils.formatExportSummary
>;
const historyHelpersMock = historyHelpers as any;

type Dispatch = (action: any) => void;

describe("effects - Missing Functions", () => {
	let dispatch: Mock<Dispatch>;

	beforeEach(() => {
		vi.clearAllMocks();
		dispatch = vi.fn() as Dispatch;
	});

	describe("searchTableRows", () => {
		it("searches rows with term and pagination", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => ({
					rows: [
						{ id: 1, name: "Alice Johnson", email: "alice@example.com" },
						{ id: 2, name: "Alice Smith", email: "alice.smith@example.com" },
					],
					rowCount: 2,
				})),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [
					{ name: "id", dataType: "integer", nullable: false },
					{ name: "name", dataType: "varchar", nullable: false },
					{ name: "email", dataType: "varchar", nullable: false },
				],
			};

			await effects.searchTableRows(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				{
					name: "users",
					schema: "public",
					type: "table",
				},
				state.columns,
				{ term: "Alice", offset: 0, limit: 50 },
			);

			expect(connectionStub.query).toHaveBeenCalled();
			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetSearchResultsPage,
					rows: expect.any(Array),
					totalCount: expect.any(Number),
					offset: 0,
					hasMore: expect.any(Boolean),
				}),
			);
		});

		it("searches rows with empty results", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => ({
					rows: [],
					rowCount: 0,
				})),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.MySQL,
					connectionString: "mysql://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [{ name: "id", dataType: "integer", nullable: false }],
			};

			await effects.searchTableRows(
				dispatch,
				state,
				{ type: DBType.MySQL, connectionString: "mysql://example" },
				{ name: "users", schema: "public", type: "table" },
				state.columns,
				{ term: "nonexistent", offset: 0, limit: 50 },
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			const searchResultsAction = actions.find(
				(action) => action.type === ActionType.SetSearchResultsPage,
			);
			expect(searchResultsAction.rows).toEqual([]);
			expect(searchResultsAction.totalCount).toBe(0);
		});

		it("handles search errors gracefully", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => {
					throw new DatabaseError(
						"Search failed",
						"SEARCH_ERROR",
						"Search query failed",
					);
				}),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [{ name: "id", dataType: "integer", nullable: false }],
			};

			await effects.searchTableRows(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				{ name: "users", schema: "public", type: "table" },
				state.columns,
				{ term: "test", offset: 0, limit: 50 },
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: expect.stringContaining("Search failed"),
				}),
			);
		});

		it("handles connection errors during search", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {
					throw new ConnectionError(
						"Connection failed",
						"CONN_ERROR",
						"Could not connect",
					);
				}),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [{ name: "id", dataType: "integer", nullable: false }],
			};

			await effects.searchTableRows(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				{ name: "users", schema: "public", type: "table" },
				state.columns,
				{ term: "test", offset: 0, limit: 50 },
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: expect.stringContaining("Connection failed"),
				}),
			);
		});

		it("uses pagination parameters correctly", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => ({
					rows: [{ id: 1 }],
					rowCount: 1,
				})),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.SQLite,
					connectionString: "/path/to/db.sqlite",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [{ name: "id", dataType: "integer", nullable: false }],
			};

			await effects.searchTableRows(
				dispatch,
				state,
				{ type: DBType.SQLite, connectionString: "/path/to/db.sqlite" },
				{ name: "users", schema: "main", type: "table" },
				state.columns,
				{ term: "john", offset: 100, limit: 25 },
			);

			expect(connectionStub.query).toHaveBeenCalled();
			const actions = dispatch.mock.calls.map((call) => call[0]);
			const searchResultsAction = actions.find(
				(action) => action.type === ActionType.SetSearchResultsPage,
			);
			expect(searchResultsAction.offset).toBe(100);
		});
	});

	describe("executeQuery", () => {
		it("executes query and records history", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => ({
					rows: [{ id: 1, name: "Alice" }],
					rowCount: 1,
				})),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				dbType: DBType.PostgreSQL,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				queryHistory: [],
			};

			await effects.executeQuery(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				"SELECT * FROM users",
			);

			expect(connectionStub.query).toHaveBeenCalledWith(
				"SELECT * FROM users",
				[],
			);
			expect(saveQueryHistoryMock).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						query: "SELECT * FROM users",
						connectionId: "conn1",
					}),
				]),
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.AddQueryHistoryItem,
					item: expect.objectContaining({
						query: "SELECT * FROM users",
						rowCount: 1,
						error: undefined,
					}),
				}),
			);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.AddQueryHistoryItem,
				}),
			);
		});

		it("handles query execution errors", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => {
					throw new DatabaseError(
						"Syntax error",
						"SYNTAX_ERROR",
						"Invalid SQL syntax",
					);
				}),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				dbType: DBType.PostgreSQL,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				queryHistory: [],
			};

			await effects.executeQuery(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				"INVALID SQL",
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.AddQueryHistoryItem,
					item: expect.objectContaining({
						query: "INVALID SQL",
						error: expect.stringContaining("Syntax error"),
					}),
				}),
			);
		});

		it("limits query history size", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {}),
				query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			// Create a history array with 100 items
			const largeHistory = Array.from({ length: 100 }, (_, i) => ({
				id: `item-${i}`,
				connectionId: "conn1",
				query: `SELECT ${i}`,
				executedAt: new Date().toISOString(),
				durationMs: 10,
				rowCount: 0,
			}));

			const state = {
				...initialAppState,
				dbType: DBType.PostgreSQL,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				queryHistory: largeHistory,
			};

			await effects.executeQuery(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				"SELECT * FROM users",
			);

			expect(saveQueryHistoryMock).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						query: "SELECT * FROM users",
						connectionId: "conn1",
					}),
				]),
			);
			const savedHistory = saveQueryHistoryMock.mock.calls[0][0] as any[];
			expect(savedHistory.length).toBeLessThanOrEqual(100);
		});

		it("handles connection errors during query execution", async () => {
			const connectionStub = {
				connect: vi.fn(async () => {
					throw new ConnectionError(
						"Database unavailable",
						"CONN_REFUSED",
						"Connection refused",
					);
				}),
				close: vi.fn(async () => {}),
			};

			createDatabaseConnectionMock.mockReturnValue(connectionStub as any);

			const state = {
				...initialAppState,
				dbType: DBType.PostgreSQL,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				queryHistory: [],
			};

			await effects.executeQuery(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				"SELECT * FROM users",
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: expect.stringContaining("Database unavailable"),
				}),
			);
		});

		it("handles queries without active connection", async () => {
			const state = {
				...initialAppState,
				activeConnection: null,
				queryHistory: [],
			};

			await effects.executeQuery(
				dispatch,
				state,
				{ type: DBType.PostgreSQL, connectionString: "postgres://example" },
				"SELECT * FROM users",
			);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: "No active connection.",
				}),
			);
		});
	});

	describe("persistConnections", () => {
		it("saves connections to persistence", async () => {
			const connections = [
				{
					id: "1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/test",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
			];

			await effects.persistConnections(dispatch, connections);

			expect(saveConnectionsMock).toHaveBeenCalledWith(connections);
		});

		it("handles persistence errors", async () => {
			const error = new Error("Failed to save connections");
			saveConnectionsMock.mockRejectedValue(error);

			await effects.persistConnections(dispatch, []);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: expect.stringContaining("Failed to save connections"),
				}),
			);
		});
	});

	describe("exportTableData", () => {
		it("exports table data with specified format", async () => {
			const mockFilePath = "/home/user/.mirador/exports/export.csv";
			exportDataMock.mockResolvedValue(mockFilePath);
			formatExportSummaryMock.mockReturnValue(
				"Exported 100 rows to CSV: export.csv",
			);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [
					{ name: "id", dataType: "integer", nullable: false },
					{ name: "name", dataType: "varchar", nullable: false },
				],
				dataRows: [
					{ id: 1, name: "Alice" },
					{ id: 2, name: "Bob" },
				],
				selectedTable: { name: "users", schema: "public", type: "table" },
			};

			await effects.exportTableData(dispatch, state, "csv", true);

			expect(exportDataMock).toHaveBeenCalledWith(
				state.dataRows,
				state.columns,
				{ format: "csv", includeHeaders: true },
			);
			expect(formatExportSummaryMock).toHaveBeenCalled();

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetInfo,
					message: expect.stringContaining("Exported"),
				}),
			);
		});

		it("handles export errors", async () => {
			const error = new Error("Export failed");
			exportDataMock.mockRejectedValue(error);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [{ name: "id", dataType: "integer", nullable: false }],
				dataRows: [{ id: 1, name: "Alice" }],
				selectedTable: { name: "users", schema: "public", type: "table" },
			};

			await effects.exportTableData(dispatch, state, "json", false);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: expect.stringContaining("Export failed"),
				}),
			);
		});

		it("shows error notification when no table is selected", async () => {
			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				selectedTable: null,
			};

			await effects.exportTableData(dispatch, state, "csv", true);

			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: "No data available to export.",
				}),
			);
		});

		it("handles empty data gracefully", async () => {
			const mockFilePath = "/home/user/.mirador/exports/empty.csv";
			exportDataMock.mockResolvedValue(mockFilePath);
			formatExportSummaryMock.mockReturnValue(
				"Exported 0 rows to CSV: empty.csv",
			);

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [{ name: "id", dataType: "integer", nullable: false }],
				dataRows: [],
				selectedTable: { name: "empty_table", schema: "public", type: "table" },
			};

			await effects.exportTableData(dispatch, state, "csv", true);

			// Should dispatch error when no data available
			const actions = dispatch.mock.calls.map((call) => call[0]);
			expect(actions).toContainEqual(
				expect.objectContaining({
					type: ActionType.SetError,
					error: "No data available to export.",
				}),
			);
		});

		it("handles large datasets with pagination", async () => {
			const mockFilePath = "/home/user/.mirador/exports/large.csv";
			exportDataMock.mockResolvedValue(mockFilePath);
			formatExportSummaryMock.mockReturnValue(
				"Exported 1000 rows to CSV: large.csv",
			);

			const largeDataRows = Array.from({ length: 1000 }, (_, i) => ({
				id: i + 1,
				name: `User ${i + 1}`,
				email: `user${i + 1}@example.com`,
			}));

			const state = {
				...initialAppState,
				activeConnection: {
					id: "conn1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				columns: [
					{ name: "id", dataType: "integer", nullable: false },
					{ name: "name", dataType: "varchar", nullable: false },
					{ name: "email", dataType: "varchar", nullable: false },
				],
				dataRows: largeDataRows,
				selectedTable: { name: "users", schema: "public", type: "table" },
			};

			await effects.exportTableData(dispatch, state, "csv", true);

			expect(exportDataMock).toHaveBeenCalledWith(
				largeDataRows,
				state.columns,
				{ format: "csv", includeHeaders: true },
			);
		});
	});
});

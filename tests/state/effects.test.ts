import { vi } from "vitest";

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

import { beforeEach, describe, expect, it } from "vitest";
import * as effects from "../../src/state/effects.js";
const {
	clearConnectionCache,
	clearTableCacheEntry,
	connectToDatabase,
	fetchColumns,
	fetchTableData,
	fetchTables,
	removeSavedConnection,
	updateSavedConnection,
} = effects;
import { ActionType } from "../../src/state/actions.js";
import { DBType, ViewState, initialAppState } from "../../src/types/state.js";
import { createDatabaseConnection } from "../../src/database/connection.js";
import * as persistence from "../../src/utils/persistence.js";

type Dispatch = (action: any) => void;

describe("effects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("connectToDatabase establishes connection, persists it, and loads tables", async () => {
		const dispatch = vi.fn() as Dispatch;
		const baseState = {
			...initialAppState,
			dbType: DBType.PostgreSQL,
			savedConnections: [],
		};

		const connectionStub = {
			connect: vi.fn(async () => {}),
			close: vi.fn(async () => {}),
		};

		const tablesConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [
					{
						table_schema: "public",
						table_name: "users",
						table_type: "BASE TABLE",
					},
				],
				rowCount: 1,
			})),
			close: vi.fn(async () => {}),
		};

		const mockedCreate = vi.mocked(createDatabaseConnection);
		mockedCreate
			.mockImplementationOnce(() => connectionStub as any)
			.mockImplementationOnce(() => tablesConnectionStub as any);

		await connectToDatabase(dispatch, baseState, {
			type: DBType.PostgreSQL,
			connectionString: "postgres://user:pass@localhost:5432/db",
		});

		expect(connectionStub.connect).toHaveBeenCalled();
		expect(connectionStub.close).toHaveBeenCalled();
		expect(tablesConnectionStub.query).toHaveBeenCalled();
		expect(persistence.saveConnections).toHaveBeenCalledTimes(1);
		expect(persistence.loadTableCache).toHaveBeenCalledTimes(1);

		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				{ type: ActionType.StartLoading },
				expect.objectContaining({ type: ActionType.SetActiveConnection }),
				{ type: ActionType.SetView, view: ViewState.Tables },
				expect.objectContaining({ type: ActionType.SetTables }),
				{ type: ActionType.StopLoading },
			]),
		);
	});

	it("initializeApp normalizes legacy connections and rewrites file", async () => {
		const dispatch = vi.fn() as Dispatch;
		const legacyConnection = {
			id: "abc",
			name: "Prod",
			type: DBType.PostgreSQL,
			connectionString: "postgres://prod",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		vi.mocked(persistence.loadConnections).mockResolvedValueOnce({
			connections: [legacyConnection],
			normalized: 1,
			skipped: 0,
		});
		vi.mocked(persistence.loadQueryHistory).mockResolvedValueOnce([]);

		await effects.initializeApp(dispatch);

		expect(persistence.saveConnections).toHaveBeenCalledWith([
			legacyConnection,
		]);
		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: ActionType.SetSavedConnections }),
				expect.objectContaining({
					type: ActionType.AddNotification,
					notification: expect.objectContaining({
						message: expect.stringContaining("Normalized"),
					}),
				}),
			]),
		);
	});

	it("fetchTables maps sqlite metadata to table info", async () => {
		const dispatch = vi.fn() as Dispatch;
		const sqliteConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [
					{ table_schema: null, table_name: "people", table_type: "table" },
					{ table_schema: null, table_name: "view_people", table_type: "view" },
				],
				rowCount: 2,
			})),
			close: vi.fn(async () => {}),
		};

		vi.mocked(createDatabaseConnection).mockReturnValueOnce(
			sqliteConnectionStub as any,
		);

		await fetchTables(dispatch, {
			type: DBType.SQLite,
			connectionString: "/tmp/example.sqlite",
		});

		expect(sqliteConnectionStub.query).toHaveBeenCalled();
		const actions = dispatch.mock.calls.map((call) => call[0]);
		const setTablesAction = actions.find(
			(action) => action.type === ActionType.SetTables,
		);
		expect(setTablesAction).toBeDefined();
		expect(setTablesAction.tables).toEqual([
			{ schema: undefined, name: "people", type: "table" },
			{ schema: undefined, name: "view_people", type: "view" },
		]);
	});

	it("fetchColumns maps postgres columns", async () => {
		const dispatch = vi.fn() as Dispatch;
		const columnsConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [
					{
						column_name: "id",
						data_type: "integer",
						is_nullable: "NO",
						column_default: "nextval",
						is_primary_key: true,
					},
				],
				rowCount: 1,
			})),
			close: vi.fn(async () => {}),
		};

		vi.mocked(createDatabaseConnection).mockReturnValueOnce(
			columnsConnectionStub as any,
		);

		const state = {
			...initialAppState,
			activeConnection: {
				id: "conn1",
				name: "Test",
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			tableCache: {},
		};

		await fetchColumns(
			dispatch,
			state,
			{
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
			},
			{
				name: "users",
				schema: "public",
				type: "table",
			},
		);

		const actions = dispatch.mock.calls.map((call) => call[0]);
		const setColumnsAction = actions.find(
			(action) => action.type === ActionType.SetColumns,
		);
		expect(setColumnsAction).toBeDefined();
		expect(setColumnsAction.columns[0]).toEqual(
			expect.objectContaining({
				name: "id",
				dataType: "integer",
				nullable: false,
				isPrimaryKey: true,
			}),
		);
		expect(actions).toEqual(
			expect.arrayContaining([
				{ type: ActionType.SetRefreshingTable, key: "public|users" },
				expect.objectContaining({
					type: ActionType.SetRefreshTimestamp,
					key: "public|users",
				}),
			]),
		);
		expect(persistence.saveTableCache).toHaveBeenCalledWith(
			"conn1",
			expect.any(Object),
		);
	});

	it("fetchTableData appends rows and tracks pagination state", async () => {
		const dispatch = vi.fn() as Dispatch;
		const rowsConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [
					{ id: 1, name: "Alice" },
					{ id: 2, name: "Bob" },
				],
				rowCount: 2,
			})),
			close: vi.fn(async () => {}),
		};

		vi.mocked(createDatabaseConnection).mockReturnValueOnce(
			rowsConnectionStub as any,
		);

		const state = {
			...initialAppState,
			activeConnection: {
				id: "conn1",
				name: "Test",
				type: DBType.MySQL,
				connectionString: "mysql://example",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			tableCache: {},
			columns: [],
		};

		await fetchTableData(
			dispatch,
			state,
			{
				type: DBType.MySQL,
				connectionString: "mysql://example",
			},
			{
				name: "users",
				schema: "public",
				type: "table",
			},
			{
				offset: 0,
				limit: 2,
				append: false,
			},
		);

		const actions = dispatch.mock.calls.map((call) => call[0]);
		const setRows = actions.find(
			(action) => action.type === ActionType.SetDataRows,
		);
		const hasMore = actions.find(
			(action) => action.type === ActionType.SetHasMoreRows,
		);
		const setOffset = actions.find(
			(action) => action.type === ActionType.SetCurrentOffset,
		);
		expect(setRows).toBeDefined();
		expect(setRows.rows).toHaveLength(2);
		expect(hasMore).toEqual({ type: ActionType.SetHasMoreRows, hasMore: true });
		expect(setOffset).toEqual({ type: ActionType.SetCurrentOffset, offset: 0 });
		expect(actions).toEqual(
			expect.arrayContaining([
				{ type: ActionType.SetRefreshingTable, key: "public|users" },
				expect.objectContaining({
					type: ActionType.SetRefreshTimestamp,
					key: "public|users",
				}),
			]),
		);
		expect(persistence.saveTableCache).toHaveBeenCalledWith(
			"conn1",
			expect.any(Object),
		);
	});

	it("fetchTableData sets non-zero offset when provided", async () => {
		const dispatch = vi.fn() as Dispatch;
		const rowsConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [{ id: 3 }, { id: 4 }],
				rowCount: 2,
			})),
			close: vi.fn(async () => {}),
		};

		vi.mocked(createDatabaseConnection).mockReturnValueOnce(
			rowsConnectionStub as any,
		);

		const state = {
			...initialAppState,
			activeConnection: {
				id: "conn2",
				name: "Test",
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			tableCache: {},
			columns: [],
		};

		await fetchTableData(
			dispatch,
			state,
			{
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
			},
			{
				name: "orders",
				schema: "public",
				type: "table",
			},
			{
				offset: 50,
				limit: 50,
			},
		);

		const actions = dispatch.mock.calls.map((call) => call[0]);
		const setOffset = actions.find(
			(action) => action.type === ActionType.SetCurrentOffset,
		);
		expect(setOffset).toEqual({
			type: ActionType.SetCurrentOffset,
			offset: 50,
		});
		expect(actions).toEqual(
			expect.arrayContaining([
				{ type: ActionType.SetRefreshingTable, key: "public|orders" },
				expect.objectContaining({
					type: ActionType.SetRefreshTimestamp,
					key: "public|orders",
				}),
			]),
		);
		expect(persistence.saveTableCache).toHaveBeenCalledWith(
			"conn2",
			expect.any(Object),
		);
	});

	it("clearTableCacheEntry removes cache and refreshes data", async () => {
		const dispatch = vi.fn() as Dispatch;
		const columnConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [
					{
						column_name: "id",
						data_type: "integer",
						is_nullable: "NO",
						column_default: null,
						is_primary_key: true,
					},
				],
				rowCount: 1,
			})),
			close: vi.fn(async () => {}),
		};

		const dataConnectionStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({
				rows: [{ id: 1 }],
				rowCount: 1,
			})),
			close: vi.fn(async () => {}),
		};

		const mockedCreate = vi.mocked(createDatabaseConnection);
		mockedCreate
			.mockImplementationOnce(() => columnConnectionStub as any)
			.mockImplementationOnce(() => dataConnectionStub as any);

		const state = {
			...initialAppState,
			activeConnection: {
				id: "conn3",
				name: "Test",
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			tableCache: {
				"public|users": {
					columns: [],
					rows: [{ id: 2 }],
					hasMore: false,
					offset: 0,
				},
			},
		};

		await clearTableCacheEntry(
			dispatch,
			state,
			{
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
			},
			{
				name: "users",
				schema: "public",
				type: "table",
			},
		);

		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toContainEqual({
			type: ActionType.RemoveTableCacheEntry,
			key: "public|users",
		});
		expect(persistence.saveTableCache).toHaveBeenCalledWith("conn3", {});
		expect(
			actions.some((action) => action.type === ActionType.SetColumns),
		).toBe(true);
		expect(
			actions.some((action) => action.type === ActionType.SetDataRows),
		).toBe(true);
		expect(
			actions.some((action) => action.type === ActionType.AddNotification),
		).toBe(true);
	});

	it("clearConnectionCache clears cache and sets info message", async () => {
		const dispatch = vi.fn() as Dispatch;
		const state = {
			...initialAppState,
			activeConnection: {
				id: "conn4",
				name: "Test",
				type: DBType.SQLite,
				connectionString: "/tmp/db.sqlite",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			tableCache: {
				"default|users": {
					columns: [],
					rows: [],
					hasMore: false,
					offset: 0,
				},
			},
		};

		await clearConnectionCache(dispatch, state);

		expect(persistence.saveTableCache).toHaveBeenCalledWith("conn4", {});
		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				{ type: ActionType.SetTableCache, cache: {} },
				{ type: ActionType.SetRefreshingTable, key: null },
			]),
		);
		expect(
			actions.some((action) => action.type === ActionType.AddNotification),
		).toBe(true);
	});

	it("throttles repeated table data refreshes", async () => {
		const dispatch = vi.fn() as Dispatch;
		const mockedCreate = vi.mocked(createDatabaseConnection);
		mockedCreate.mockClear();

		const state = {
			...initialAppState,
			activeConnection: {
				id: "conn5",
				name: "Test",
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			refreshTimestamps: {
				"public|users": Date.now(),
			},
		};

		await fetchTableData(
			dispatch,
			state,
			{
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
			},
			{
				name: "users",
				schema: "public",
				type: "table",
			},
		);

		expect(createDatabaseConnection).not.toHaveBeenCalled();
		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).not.toContainEqual(
			expect.objectContaining({ type: ActionType.SetDataRows }),
		);
		expect(actions).toContainEqual(
			expect.objectContaining({ type: ActionType.AddNotification }),
		);
	});

	it("removeSavedConnection updates state and persists", async () => {
		const dispatch = vi.fn() as Dispatch;
		const state = {
			...initialAppState,
			savedConnections: [
				{
					id: "abc",
					name: "Test",
					type: DBType.PostgreSQL,
					connectionString: "postgres://example",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			],
			activeConnection: {
				id: "abc",
				name: "Test",
				type: DBType.PostgreSQL,
				connectionString: "postgres://example",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		};

		await removeSavedConnection(dispatch, state, "abc");

		expect(persistence.saveConnections).toHaveBeenCalledWith([]);
		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				{ type: ActionType.RemoveSavedConnection, connectionId: "abc" },
				{ type: ActionType.ClearActiveConnection },
			]),
		);
		expect(
			actions.some((action) => action.type === ActionType.AddNotification),
		).toBe(true);
	});

	it("updateSavedConnection persists renamed connection", async () => {
		const dispatch = vi.fn() as Dispatch;
		const connection = {
			id: "abc",
			name: "Old Name",
			type: DBType.PostgreSQL,
			connectionString: "postgres://example",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const state = {
			...initialAppState,
			savedConnections: [connection],
			activeConnection: connection,
		};

		await effects.updateSavedConnection(dispatch, state, "abc", {
			name: "New Name",
		});

		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: ActionType.UpdateSavedConnection,
					connection: expect.objectContaining({ name: "New Name" }),
				}),
				expect.objectContaining({
					type: ActionType.SetActiveConnection,
					connection: expect.objectContaining({ name: "New Name" }),
				}),
				expect.objectContaining({ type: ActionType.AddNotification }),
			]),
		);
		expect(persistence.saveConnections).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ name: "New Name" })]),
		);
	});

	it("updateSavedConnection prevents duplicate names", async () => {
		const dispatch = vi.fn() as Dispatch;
		const state = {
			...initialAppState,
			savedConnections: [
				{
					id: "abc",
					name: "Prod",
					type: DBType.PostgreSQL,
					connectionString: "postgres://prod",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: "def",
					name: "Staging",
					type: DBType.PostgreSQL,
					connectionString: "postgres://staging",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			],
		};

		await effects.updateSavedConnection(dispatch, state, "def", {
			name: "Prod",
		});

		expect(persistence.saveConnections).not.toHaveBeenCalled();
		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: ActionType.AddNotification }),
			]),
		);
	});

	it("updateSavedConnection requires non-empty connection string", async () => {
		const dispatch = vi.fn() as Dispatch;
		const state = {
			...initialAppState,
			savedConnections: [
				{
					id: "abc",
					name: "Prod",
					type: DBType.PostgreSQL,
					connectionString: "postgres://prod",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			],
		};

		await effects.updateSavedConnection(dispatch, state, "abc", {
			connectionString: "   ",
		});

		expect(persistence.saveConnections).not.toHaveBeenCalled();
		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: ActionType.AddNotification }),
			]),
		);
	});

	it("updateSavedConnection refreshes active connection when connection string changes", async () => {
		const dispatch = vi.fn() as Dispatch;
		const connection = {
			id: "abc",
			name: "Prod",
			type: DBType.PostgreSQL,
			connectionString: "postgres://prod",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const connectionStub = {
			connect: vi.fn(async () => {}),
			close: vi.fn(async () => {}),
		};

		const tableStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
			close: vi.fn(async () => {}),
		};

		vi.mocked(createDatabaseConnection)
			.mockImplementationOnce(() => connectionStub as any)
			.mockImplementationOnce(() => tableStub as any);

		const state = {
			...initialAppState,
			savedConnections: [connection],
			activeConnection: connection,
			dbType: DBType.PostgreSQL,
		};

		await effects.updateSavedConnection(dispatch, state, "abc", {
			connectionString: "postgres://new",
		});

		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: ActionType.SetActiveConnection,
					connection: expect.objectContaining({
						connectionString: "postgres://new",
					}),
				}),
			]),
		);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: ActionType.AddNotification,
					notification: expect.objectContaining({
						message: "Connection details changed; reconnecting…",
					}),
				}),
			]),
		);
	});

	it("updateSavedConnection updates database type and reconnects active session", async () => {
		const dispatch = vi.fn() as Dispatch;
		const connection = {
			id: "abc",
			name: "Prod",
			type: DBType.PostgreSQL,
			connectionString: "postgres://prod",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const connectionStub = {
			connect: vi.fn(async () => {}),
			close: vi.fn(async () => {}),
		};

		const tableStub = {
			connect: vi.fn(async () => {}),
			query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
			close: vi.fn(async () => {}),
		};

		vi.mocked(createDatabaseConnection)
			.mockImplementationOnce(() => connectionStub as any)
			.mockImplementationOnce(() => tableStub as any);

		const state = {
			...initialAppState,
			savedConnections: [connection],
			activeConnection: connection,
			dbType: DBType.PostgreSQL,
		};

		await effects.updateSavedConnection(dispatch, state, "abc", {
			type: DBType.MySQL,
		});

		const actions = dispatch.mock.calls.map((call) => call[0]);
		expect(actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: ActionType.SetActiveConnection,
					connection: expect.objectContaining({ type: DBType.MySQL }),
				}),
				expect.objectContaining({
					type: ActionType.AddNotification,
					notification: expect.objectContaining({
						message: "Connection details changed; reconnecting…",
					}),
				}),
			]),
		);
		expect(persistence.saveConnections).toHaveBeenCalled();
	});
});

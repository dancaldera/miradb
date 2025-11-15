import { beforeEach, describe, expect, it, vi } from "bun:test";
import { constants } from "node:fs";
import path from "node:path";
import type {
	ColumnInfo,
	ConnectionInfo,
	QueryHistoryItem,
	TableCacheEntry,
} from "../../src/types/state.js";
import { DBType } from "../../src/types/state.js";
import {
	__persistenceInternals,
	type ConnectionsLoadResult,
	loadConnections,
	loadQueryHistory,
	loadTableCache,
	saveConnections,
	saveQueryHistory,
	saveTableCache,
	setPersistenceDataDirectory,
} from "../../src/utils/persistence.js";

// Mock the file system operations
const mockMkdir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockAccess = vi.fn();
const mockHomedir = vi.fn(() => "/home/user");

vi.mock("node:fs/promises", () => ({
	mkdir: mockMkdir,
	readFile: mockReadFile,
	writeFile: mockWriteFile,
	access: mockAccess,
}));

vi.mock("node:os", () => ({
	homedir: mockHomedir,
}));

vi.mock("node:fs", () => ({
	constants: {
		F_OK: 0,
	},
}));

describe("persistence utilities", () => {
	const mockDataDir = path.join("/home/user", ".mirador");

	beforeEach(() => {
		vi.clearAllMocks();
		setPersistenceDataDirectory(mockDataDir);
		mockMkdir.mockResolvedValue(undefined);
		mockWriteFile.mockResolvedValue(undefined);
		mockAccess.mockResolvedValue(undefined);
	});

	describe("loadConnections", () => {
		it("returns empty result when file doesn't exist", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));

			const result = await loadConnections();

			expect(result).toEqual({
				connections: [],
				normalized: 0,
				skipped: 0,
			});
		});

		it("returns empty result when file is empty", async () => {
			mockReadFile.mockResolvedValue("");

			const result = await loadConnections();

			expect(result).toEqual({
				connections: [],
				normalized: 0,
				skipped: 0,
			});
		});

		it("loads valid connections", async () => {
			const mockConnections: ConnectionInfo[] = [
				{
					id: "1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/test",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(mockConnections));

			const result = await loadConnections();

			expect(result.connections).toEqual(mockConnections);
			expect(result.normalized).toBe(0);
			expect(result.skipped).toBe(0);
		});

		it("handles malformed JSON gracefully", async () => {
			mockReadFile.mockResolvedValue("invalid json");

			await expect(loadConnections()).rejects.toThrow();
		});

		it("handles non-array data", async () => {
			mockReadFile.mockResolvedValue('{"not": "an array"}');

			const result = await loadConnections();

			expect(result.connections).toEqual([]);
			expect(result.normalized).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("normalizes legacy connections", async () => {
			const legacyData = [
				{
					name: "Legacy DB",
					driver: "postgres",
					connection_str: "postgres://localhost/legacy",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(legacyData));

			const result = await loadConnections();

			expect(result.connections).toHaveLength(1);
			expect(result.connections[0].name).toBe("Legacy DB");
			expect(result.connections[0].type).toBe(DBType.PostgreSQL);
			expect(result.normalized).toBe(1);
			expect(result.skipped).toBe(0);
		});

		it("skips invalid connection entries", async () => {
			const mixedData = [
				{
					id: "1",
					name: "Valid DB",
					type: DBType.MySQL,
					connectionString: "mysql://localhost/test",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				{ invalid: "entry" },
				null,
			];
			mockReadFile.mockResolvedValue(JSON.stringify(mixedData));

			const result = await loadConnections();

			expect(result.connections).toHaveLength(1);
			expect(result.normalized).toBe(0);
			expect(result.skipped).toBe(2);
		});

		it("handles different legacy driver names", async () => {
			const legacyData = [
				{ driver: "postgresql", connection_str: "postgres://localhost/db1" },
				{ driver: "pg", connection_str: "postgres://localhost/db2" },
				{ driver: "mysql", connection_str: "mysql://localhost/db3" },
				{ driver: "sqlite", connection_str: "/path/to/db1.sqlite" },
				{ driver: "sqlite3", connection_str: "/path/to/db2.sqlite" },
			];
			mockReadFile.mockResolvedValue(JSON.stringify(legacyData));

			const result = await loadConnections();

			expect(result.connections).toHaveLength(5);
			expect(result.connections[0].type).toBe(DBType.PostgreSQL);
			expect(result.connections[1].type).toBe(DBType.PostgreSQL);
			expect(result.connections[2].type).toBe(DBType.MySQL);
			expect(result.connections[3].type).toBe(DBType.SQLite);
			expect(result.connections[4].type).toBe(DBType.SQLite);
			expect(result.normalized).toBe(5);
		});

		it("skips legacy connections with unsupported drivers", async () => {
			const legacyData = [
				{ driver: "oracle", connection_str: "oracle://localhost/db" },
			];
			mockReadFile.mockResolvedValue(JSON.stringify(legacyData));

			const result = await loadConnections();

			expect(result.connections).toHaveLength(0);
			expect(result.skipped).toBe(1);
		});

		it("deduplicates connections sharing type and connection string", async () => {
			const duplicateData = [
				{
					id: "1",
					name: "Primary",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/primary",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				{
					id: "2",
					name: "Primary (newer)",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/primary",
					createdAt: "2023-01-02T00:00:00.000Z",
					updatedAt: "2023-01-02T00:00:00.000Z",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(duplicateData));

			const result = await loadConnections();

			expect(result.connections).toHaveLength(1);
			expect(result.connections[0]).toEqual(
				expect.objectContaining({
					name: "Primary (newer)",
					connectionString: "postgres://localhost/primary",
				}),
			);
			expect(result.skipped).toBe(1);
		});

		it("normalizes legacy entries through internal helper", () => {
			const result = __persistenceInternals.normalizeConnectionEntry({
				name: "Legacy DB",
				driver: "postgres",
				connection_str: "postgres://localhost/legacy",
			});

			expect(result).not.toBeNull();
			expect(result?._normalized).toBe(true);
		});

		it("logs when normalization fallback fails", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const safeParseSpy = vi
				.spyOn(__persistenceInternals.connectionSchema, "safeParse")
				.mockImplementationOnce(() => ({ success: false }) as any)
				.mockImplementationOnce(() => ({ success: false }) as any);

			const result = __persistenceInternals.normalizeConnectionEntry({
				name: "Broken",
				driver: "postgres",
				connection_str: "postgres://broken",
			});

			expect(result).toBeNull();
			expect(warnSpy).toHaveBeenCalledWith(
				"Unable to normalize legacy connection entry.",
			);

			warnSpy.mockRestore();
			safeParseSpy.mockRestore();
		});

		it("creates directory if it doesn't exist", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));

			await loadConnections();

			expect(mockMkdir).toHaveBeenCalledWith(mockDataDir, { recursive: true });
		});
	});

	describe("saveConnections", () => {
		it("saves connections to file", async () => {
			const connections: ConnectionInfo[] = [
				{
					id: "1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/test",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
			];

			await saveConnections(connections, true);

			expect(mockWriteFile).toHaveBeenCalledWith(
				path.join(mockDataDir, "connections.json"),
				JSON.stringify(connections, null, 2),
				"utf-8",
			);
		});

		it("creates directory if it doesn't exist", async () => {
			await saveConnections([], true);

			expect(mockMkdir).toHaveBeenCalledWith(mockDataDir, { recursive: true });
		});
	});

	describe("loadQueryHistory", () => {
		it("returns empty array when file doesn't exist", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));

			const result = await loadQueryHistory();

			expect(result).toEqual([]);
		});

		it("returns empty array when file is empty", async () => {
			mockReadFile.mockResolvedValue("");

			const result = await loadQueryHistory();

			expect(result).toEqual([]);
		});

		it("loads valid query history", async () => {
			const mockHistory: QueryHistoryItem[] = [
				{
					id: "1",
					connectionId: "conn1",
					query: "SELECT * FROM users",
					executedAt: "2023-01-01T00:00:00.000Z",
					durationMs: 100,
					rowCount: 10,
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(mockHistory));

			const result = await loadQueryHistory();

			expect(result).toEqual(mockHistory);
		});

		it("handles query history with errors", async () => {
			const mockHistory: QueryHistoryItem[] = [
				{
					id: "1",
					connectionId: "conn1",
					query: "INVALID SQL",
					executedAt: "2023-01-01T00:00:00.000Z",
					durationMs: 50,
					rowCount: 0,
					error: "Syntax error",
				},
			];
			mockReadFile.mockResolvedValue(JSON.stringify(mockHistory));

			const result = await loadQueryHistory();

			expect(result).toEqual(mockHistory);
		});

		it("filters invalid entries", async () => {
			const mixedData = [
				{
					id: "1",
					connectionId: "conn1",
					query: "SELECT * FROM users",
					executedAt: "2023-01-01T00:00:00.000Z",
					durationMs: 100,
					rowCount: 10,
				},
				{ invalid: "entry" },
			];
			mockReadFile.mockResolvedValue(JSON.stringify(mixedData));

			const result = await loadQueryHistory();

			expect(result).toHaveLength(1);
		});

		it("handles non-array data", async () => {
			mockReadFile.mockResolvedValue('{"not": "an array"}');

			const result = await loadQueryHistory();

			expect(result).toEqual([]);
		});
	});

	describe("saveQueryHistory", () => {
		it("saves query history to file", async () => {
			const history: QueryHistoryItem[] = [
				{
					id: "1",
					connectionId: "conn1",
					query: "SELECT * FROM users",
					executedAt: "2023-01-01T00:00:00.000Z",
					durationMs: 100,
					rowCount: 10,
				},
			];

			await saveQueryHistory(history, true);

			expect(mockWriteFile).toHaveBeenCalledWith(
				path.join(mockDataDir, "query-history.json"),
				JSON.stringify(history, null, 2),
				"utf-8",
			);
		});
	});

	describe("loadTableCache", () => {
		it("returns empty cache when file doesn't exist", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));

			const result = await loadTableCache("conn1");

			expect(result).toEqual({});
		});

		it("returns empty cache when file is empty", async () => {
			mockReadFile.mockResolvedValue("");

			const result = await loadTableCache("conn1");

			expect(result).toEqual({});
		});

		it("loads cache for specific connection", async () => {
			const mockCache = {
				conn1: {
					"public|users": {
						columns: [
							{ name: "id", dataType: "integer", nullable: false },
							{ name: "name", dataType: "varchar", nullable: false },
						],
						rows: [{ id: 1, name: "Alice" }],
						hasMore: true,
						offset: 0,
					},
				},
				conn2: {
					"public|posts": {
						columns: [
							{ name: "id", dataType: "integer", nullable: false },
							{ name: "title", dataType: "varchar", nullable: false },
						],
						rows: [{ id: 1, title: "Hello World" }],
						hasMore: false,
						offset: 10,
					},
				},
			};
			mockReadFile.mockResolvedValue(JSON.stringify(mockCache));

			const result = await loadTableCache("conn1");

			expect(result).toEqual(mockCache.conn1);
		});

		it("returns empty cache for unknown connection", async () => {
			const mockCache = {
				conn1: {
					"public|users": {
						columns: [],
						rows: [],
						hasMore: false,
						offset: 0,
					},
				},
			};
			mockReadFile.mockResolvedValue(JSON.stringify(mockCache));

			const result = await loadTableCache("unknown");

			expect(result).toEqual({});
		});

		it("handles invalid cache file format", async () => {
			mockReadFile.mockResolvedValue("invalid json");

			const result = await loadTableCache("conn1");

			expect(result).toEqual({});
		});

		it("handles non-object cache data", async () => {
			mockReadFile.mockResolvedValue("null");

			const result = await loadTableCache("conn1");

			expect(result).toEqual({});
		});

		it("skips invalid cache entries", async () => {
			const mockCache = {
				conn1: {
					"public|users": {
						columns: [{ name: "id", dataType: "integer", nullable: false }],
						rows: [{ id: 1 }],
						hasMore: true,
						offset: 0,
					},
					"invalid|entry": {
						// Missing required fields
						columns: [],
						// Missing rows, hasMore, offset
					},
				},
			};
			mockReadFile.mockResolvedValue(JSON.stringify(mockCache));

			const result = await loadTableCache("conn1");

			expect(Object.keys(result)).toHaveLength(1);
			expect(result).toHaveProperty("public|users");
		});

		it("skips invalid connection cache objects", async () => {
			const mockCache = {
				conn1: "not an object",
				conn2: {
					"public|users": {
						columns: [],
						rows: [],
						hasMore: false,
						offset: 0,
					},
				},
			};
			mockReadFile.mockResolvedValue(JSON.stringify(mockCache));

			const result = await loadTableCache("conn1");

			expect(result).toEqual({});
		});
	});

	describe("saveTableCache", () => {
		it("saves cache for specific connection", async () => {
			const existingCache = {
				conn1: {
					"public|users": {
						columns: [],
						rows: [],
						hasMore: false,
						offset: 0,
					},
				},
			};
			const newCache: Record<string, TableCacheEntry> = {
				"public|posts": {
					columns: [],
					rows: [],
					hasMore: false,
					offset: 0,
				},
			};

			mockReadFile.mockResolvedValue(JSON.stringify(existingCache));

			await saveTableCache("conn2", newCache, true);

			const expectedCache = {
				...existingCache,
				conn2: newCache,
			};

			expect(mockWriteFile).toHaveBeenCalledWith(
				path.join(mockDataDir, "table-cache.json"),
				JSON.stringify(expectedCache, null, 2),
				"utf-8",
			);
		});

		it("overwrites existing cache for connection", async () => {
			const existingCache = {
				conn1: {
					"public|users": {
						columns: [],
						rows: [],
						hasMore: false,
						offset: 0,
					},
				},
			};
			const newCache: Record<string, TableCacheEntry> = {
				"public|posts": {
					columns: [],
					rows: [],
					hasMore: false,
					offset: 0,
				},
			};

			mockReadFile.mockResolvedValue(JSON.stringify(existingCache));

			await saveTableCache("conn1", newCache, true);

			const expectedCache = {
				conn1: newCache,
			};

			expect(mockWriteFile).toHaveBeenCalledWith(
				path.join(mockDataDir, "table-cache.json"),
				JSON.stringify(expectedCache, null, 2),
				"utf-8",
			);
		});

		it("creates new cache file when none exists", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));

			const newCache: Record<string, TableCacheEntry> = {
				"public|users": {
					columns: [],
					rows: [],
					hasMore: false,
					offset: 0,
				},
			};

			await saveTableCache("conn1", newCache, true);

			expect(mockWriteFile).toHaveBeenCalledWith(
				path.join(mockDataDir, "table-cache.json"),
				JSON.stringify({ conn1: newCache }, null, 2),
				"utf-8",
			);
		});
	});

	describe("error handling", () => {
		it("handles mkdir failures gracefully", async () => {
			const error = new Error("Permission denied");
			mockMkdir.mockRejectedValue(error);

			await expect(loadConnections()).rejects.toThrow(
				"Failed to ensure data directory",
			);
		});

		it("handles readFile failures", async () => {
			const error = new Error("Permission denied");
			mockReadFile.mockRejectedValue(error);

			await expect(loadConnections()).rejects.toThrow(error);
		});

		it("handles writeFile failures", async () => {
			const error = new Error("Disk full");
			mockWriteFile.mockRejectedValue(error);

			await expect(saveConnections([], true)).rejects.toThrow(error);
		});
	});

	describe("integration scenarios", () => {
		it("maintains data integrity through save/load cycles", async () => {
			const originalConnections: ConnectionInfo[] = [
				{
					id: "1",
					name: "Test DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/test",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
			];

			await saveConnections(originalConnections, true);
			mockReadFile.mockResolvedValue(JSON.stringify(originalConnections));

			const result = await loadConnections();

			expect(result.connections).toEqual(originalConnections);
			expect(result.normalized).toBe(0);
			expect(result.skipped).toBe(0);
		});

		it("handles mixed valid and invalid data gracefully", async () => {
			const mixedConnections = [
				{
					id: "1",
					name: "Valid DB",
					type: DBType.PostgreSQL,
					connectionString: "postgres://localhost/valid",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
				},
				{ driver: "mysql", connection_str: "mysql://localhost/legacy" }, // Legacy
				{ invalid: "entry" }, // Invalid
			];
			mockReadFile.mockResolvedValue(JSON.stringify(mixedConnections));

			const result = await loadConnections();

			expect(result.connections).toHaveLength(2); // Valid + Legacy
			expect(result.normalized).toBe(1);
			expect(result.skipped).toBe(1);
		});
	});
});

import { beforeEach, describe, expect, it, vi } from "bun:test";
import { ConnectionError, DatabaseError } from "../../src/database/errors.js";
import { MySQLConnection } from "../../src/database/mysql.js";

// Mock the mysql2/promise module
const mockMysqlQuery = vi.fn();
const mockMysqlEnd = vi.fn();
let mockPool: any;

vi.mock("mysql2/promise", () => ({
	default: {
		createPool: vi.fn(() => {
			mockPool = {
				getConnection: vi.fn(),
				query: mockMysqlQuery,
				end: mockMysqlEnd,
			};
			return mockPool;
		}),
	},
}));

describe("MySQLConnection", () => {
	let connection: MySQLConnection;

	beforeEach(() => {
		vi.clearAllMocks();
		mockMysqlQuery.mockReset();
		mockMysqlEnd.mockReset();
		connection = new MySQLConnection({
			type: "MySQL" as any,
			connectionString: "mysql://test",
		});
	});

	it("creates connection with correct type", () => {
		expect(connection.type).toBe("mysql");
	});

	it("connects successfully", async () => {
		const mockConnection = {
			release: vi.fn(),
		};
		mockPool.getConnection.mockResolvedValue(mockConnection);

		await connection.connect();

		expect(mockPool.getConnection).toHaveBeenCalled();
		expect(mockConnection.release).toHaveBeenCalled();
		expect((connection as any).connected).toBe(true);
	});

	it("throws ConnectionError on connection failure", async () => {
		const error = new Error("Connection failed");
		(error as any).code = "ECONNREFUSED";
		mockPool.getConnection.mockRejectedValue(error);

		await expect(connection.connect()).rejects.toThrow(ConnectionError);
	});

	it("queries successfully when connected", async () => {
		(connection as any).connected = true;
		const mockRows = [{ id: 1, name: "test" }];
		const mockFields = [{ name: "id" }, { name: "name" }];
		mockMysqlQuery.mockResolvedValue([mockRows, mockFields]);

		const result = await connection.query("SELECT * FROM users", [1]);

		expect(mockMysqlQuery).toHaveBeenCalledWith("SELECT * FROM users", [1]);
		expect(result).toEqual({
			rows: mockRows,
			rowCount: 1,
			fields: ["id", "name"],
		});
	});

	it("auto-connects when querying while not connected", async () => {
		(connection as any).connected = false;
		const mockConnection = {
			release: vi.fn(),
		};
		const mockRows = [{ id: 1 }];
		const mockFields = [{ name: "id" }];

		mockPool.getConnection.mockResolvedValue(mockConnection);
		mockMysqlQuery.mockResolvedValue([mockRows, mockFields]);

		await connection.query("SELECT * FROM users");

		expect(mockPool.getConnection).toHaveBeenCalled();
		expect(mockMysqlQuery).toHaveBeenCalledWith("SELECT * FROM users", []);
		expect((connection as any).connected).toBe(true);
	});

	it("throws DatabaseError on query failure", async () => {
		(connection as any).connected = true;
		const error = new Error("Syntax error");
		(error as any).code = "ER_PARSE_ERROR";
		mockMysqlQuery.mockRejectedValue(error);

		await expect(connection.query("INVALID SQL")).rejects.toThrow(
			DatabaseError,
		);
	});

	it("executes SQL successfully", async () => {
		(connection as any).connected = true;
		const mockRows = [];
		const mockFields = [];
		mockMysqlQuery.mockResolvedValue([mockRows, mockFields]);

		await connection.execute("DELETE FROM users WHERE id = ?", [1]);

		expect(mockMysqlQuery).toHaveBeenCalledWith(
			"DELETE FROM users WHERE id = ?",
			[1],
		);
	});

	it("closes connection successfully", async () => {
		mockMysqlEnd.mockResolvedValue(undefined);

		await connection.close();

		expect(mockMysqlEnd).toHaveBeenCalled();
		expect((connection as any).connected).toBe(false);
	});

	it("handles fields without name property", async () => {
		(connection as any).connected = true;
		const mockRows = [{ id: 1 }];
		const mockFields = [{ catalog: "def", table: "users" }]; // No name property
		mockMysqlQuery.mockResolvedValue([mockRows, mockFields]);

		const result = await connection.query("SELECT * FROM users");

		expect(result.fields).toEqual([""]);
	});

	it("handles fields with name property", async () => {
		(connection as any).connected = true;
		const mockRows = [{ id: 1 }];
		const mockFields = [{ name: "id", table: "users" }];
		mockMysqlQuery.mockResolvedValue([mockRows, mockFields]);

		const result = await connection.query("SELECT * FROM users");

		expect(result.fields).toEqual(["id"]);
	});

	it("handles missing fields gracefully", async () => {
		(connection as any).connected = true;
		const mockRows = [{ id: 1 }];
		mockMysqlQuery.mockResolvedValue([mockRows, undefined]);

		const result = await connection.query("SELECT * FROM users");

		expect(result.fields).toBeUndefined();
	});

	it("creates connection with custom pool config", () => {
		const customConnection = new MySQLConnection({
			type: "MySQL" as any,
			connectionString: "mysql://test",
			pool: {
				max: 20,
			},
		});

		expect(customConnection.type).toBe("mysql");
	});

	it("handles non-error exceptions gracefully", async () => {
		(connection as any).connected = true;
		mockMysqlQuery.mockRejectedValue("String error");

		await expect(connection.query("SELECT * FROM users")).rejects.toThrow(
			DatabaseError,
		);
	});

	it("preserves error code in ConnectionError", async () => {
		const error = new Error("Access denied");
		(error as any).code = "ER_ACCESS_DENIED_ERROR";
		mockPool.getConnection.mockRejectedValue(error);

		try {
			await connection.connect();
		} catch (e) {
			expect(e).toBeInstanceOf(ConnectionError);
			if (e instanceof ConnectionError) {
				expect(e.code).toBe("ER_ACCESS_DENIED_ERROR");
				expect(e.detail).toBe("Access denied");
			}
		}
	});

	it("preserves error code in DatabaseError", async () => {
		(connection as any).connected = true;
		const error = new Error("Duplicate entry");
		(error as any).code = "ER_DUP_ENTRY";
		mockMysqlQuery.mockRejectedValue(error);

		try {
			await connection.query("INSERT INTO users");
		} catch (e) {
			expect(e).toBeInstanceOf(DatabaseError);
			if (e instanceof DatabaseError) {
				expect(e.code).toBe("ER_DUP_ENTRY");
				expect(e.detail).toBe("Duplicate entry");
			}
		}
	});

	it("handles empty result set", async () => {
		(connection as any).connected = true;
		mockMysqlQuery.mockResolvedValue([[], []]);

		const result = await connection.query("SELECT * FROM empty_table");

		expect(result.rows).toEqual([]);
		expect(result.rowCount).toBe(0);
	});

	it("handles large row count", async () => {
		(connection as any).connected = true;
		const mockRows = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
		mockMysqlQuery.mockResolvedValue([mockRows, []]);

		const result = await connection.query("SELECT * FROM large_table");

		expect(result.rowCount).toBe(1000);
	});
});

import { beforeEach, describe, expect, it, vi } from "bun:test";
import { ConnectionError, DatabaseError } from "../../src/database/errors.js";
import { PostgresConnection } from "../../src/database/postgres.js";

// Mock the pg module
const mockQuery = vi.fn();
const mockEnd = vi.fn();

vi.mock("pg", () => ({
	Pool: class {
		query = mockQuery;
		end = mockEnd;
		constructor(config: any) {}
	},
}));

describe("PostgresConnection", () => {
	let connection: PostgresConnection;
	let mockPool: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockQuery.mockReset();
		mockEnd.mockReset();
		connection = new PostgresConnection({
			type: "PostgreSQL" as any,
			connectionString: "postgres://test",
		});
	});

	it("creates connection with correct type", () => {
		expect(connection.type).toBe("postgresql");
	});

	it("connects successfully", async () => {
		mockQuery.mockResolvedValue({ rows: [] });

		await connection.connect();

		expect(mockQuery).toHaveBeenCalledWith("SELECT 1");
		expect((connection as any).connected).toBe(true);
	});

	it("throws ConnectionError on connection failure", async () => {
		const error = new Error("Connection failed");
		(error as any).code = "ECONNREFUSED";
		mockQuery.mockRejectedValue(error);

		await expect(connection.connect()).rejects.toThrow(ConnectionError);
	});

	it("queries successfully when connected", async () => {
		(connection as any).connected = true;
		const mockResult = {
			rows: [{ id: 1, name: "test" }],
			rowCount: 1,
			fields: [{ name: "id" }, { name: "name" }],
		};
		mockQuery.mockResolvedValue(mockResult);

		const result = await connection.query("SELECT * FROM users", [1]);

		expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM users", [1]);
		expect(result).toEqual({
			rows: [{ id: 1, name: "test" }],
			rowCount: 1,
			fields: ["id", "name"],
		});
	});

	it("auto-connects when querying while not connected", async () => {
		(connection as any).connected = false;
		mockQuery
			.mockResolvedValueOnce({ rows: [] }) // For connect()
			.mockResolvedValueOnce({
				rows: [{ id: 1 }],
				rowCount: 1,
				fields: [],
			}); // For query()

		await connection.query("SELECT * FROM users");

		expect(mockQuery).toHaveBeenCalledTimes(2);
		expect(mockQuery).toHaveBeenNthCalledWith(1, "SELECT 1");
		expect(mockQuery).toHaveBeenNthCalledWith(2, "SELECT * FROM users", []);
	});

	it("throws DatabaseError on query failure", async () => {
		(connection as any).connected = true;
		const error = new Error("Syntax error");
		(error as any).code = "42601";
		mockQuery.mockRejectedValue(error);

		await expect(connection.query("INVALID SQL")).rejects.toThrow(
			DatabaseError,
		);
	});

	it("executes SQL successfully", async () => {
		(connection as any).connected = true;
		mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

		await connection.execute("DELETE FROM users WHERE id = ?", [1]);

		expect(mockQuery).toHaveBeenCalledWith(
			"DELETE FROM users WHERE id = ?",
			[1],
		);
	});

	it("closes connection successfully", async () => {
		mockEnd.mockResolvedValue(undefined);

		await connection.close();

		expect(mockEnd).toHaveBeenCalled();
		expect((connection as any).connected).toBe(false);
	});

	it("handles missing rowCount gracefully", async () => {
		(connection as any).connected = true;
		mockQuery.mockResolvedValue({
			rows: [{ id: 1 }],
			// rowCount is missing
		});

		const result = await connection.query("SELECT * FROM users");

		expect(result.rowCount).toBe(1); // Should fallback to rows.length
	});

	it("handles missing fields gracefully", async () => {
		(connection as any).connected = true;
		mockQuery.mockResolvedValue({
			rows: [{ id: 1 }],
			rowCount: 1,
			// fields is missing
		});

		const result = await connection.query("SELECT * FROM users");

		expect(result.fields).toBeUndefined();
	});

	it("creates connection with custom pool config", () => {
		const customConnection = new PostgresConnection({
			type: "PostgreSQL" as any,
			connectionString: "postgres://test",
			pool: {
				max: 20,
				idleTimeoutMillis: 60000,
				connectionTimeoutMillis: 15000,
			},
		});

		expect(customConnection.type).toBe("postgresql");
	});

	it("handles non-error exceptions gracefully", async () => {
		(connection as any).connected = true;
		mockQuery.mockRejectedValue("String error");

		await expect(connection.query("SELECT * FROM users")).rejects.toThrow(
			DatabaseError,
		);
	});

	it("preserves error code in ConnectionError", async () => {
		const error = new Error("Connection failed");
		(error as any).code = "28000";
		mockQuery.mockRejectedValue(error);

		try {
			await connection.connect();
		} catch (e) {
			expect(e).toBeInstanceOf(ConnectionError);
			if (e instanceof ConnectionError) {
				expect(e.code).toBe("28000");
				expect(e.detail).toBe("Connection failed");
			}
		}
	});

	it("preserves error code in DatabaseError", async () => {
		(connection as any).connected = true;
		const error = new Error("Query failed");
		(error as any).code = "23505";
		mockQuery.mockRejectedValue(error);

		try {
			await connection.query("INSERT INTO users");
		} catch (e) {
			expect(e).toBeInstanceOf(DatabaseError);
			if (e instanceof DatabaseError) {
				expect(e.code).toBe("23505");
				expect(e.detail).toBe("Query failed");
			}
		}
	});
});

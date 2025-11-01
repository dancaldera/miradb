import { describe, expect, it } from "vitest";
import { parameterize } from "../../src/database/parameterize.js";
import { DBType } from "../../src/types/state.js";

describe("parameterize", () => {
	it("returns original SQL for PostgreSQL", () => {
		const query = parameterize(
			"SELECT * FROM users WHERE id = $1",
			DBType.PostgreSQL,
			[1],
		);
		expect(query.sql).toBe("SELECT * FROM users WHERE id = $1");
		expect(query.params).toEqual([1]);
	});

	it("converts positional params to question marks for MySQL", () => {
		const query = parameterize(
			"SELECT * FROM users WHERE id = $1 AND name = $2",
			DBType.MySQL,
			[1, "Alice"],
		);
		expect(query.sql).toBe("SELECT * FROM users WHERE id = ? AND name = ?");
		expect(query.params).toEqual([1, "Alice"]);
	});

	it("converts positional params to question marks for SQLite", () => {
		const query = parameterize(
			"UPDATE users SET name = $1 WHERE id = $2",
			DBType.SQLite,
			["Bob", 2],
		);
		expect(query.sql).toBe("UPDATE users SET name = ? WHERE id = ?");
		expect(query.params).toEqual(["Bob", 2]);
	});

	it("handles queries without parameters", () => {
		const query = parameterize("SELECT 1", DBType.PostgreSQL);
		expect(query.sql).toBe("SELECT 1");
		expect(query.params).toEqual([]);
	});
});

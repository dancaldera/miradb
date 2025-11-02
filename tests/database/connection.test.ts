import { beforeEach, describe, expect, it, vi } from "bun:test";
import { createDatabaseConnection } from "../../src/database/connection.js";
import { DBType } from "../../src/types/state.js";

vi.mock("pg", () => ({
	__esModule: true,
	Pool: class {
		query = vi.fn();
		end = vi.fn();
		constructor() {}
	},
}));

vi.mock("mysql2/promise", () => ({
	__esModule: true,
	default: {
		createPool: () => ({
			query: vi.fn(async () => [[], []]),
			getConnection: vi.fn(async () => ({
				release: () => {},
			})),
			end: vi.fn(),
		}),
	},
}));

vi.mock("bun:sqlite", () => ({
	__esModule: true,
	Database: class {
		exec() {}
		query() {
			return {
				all: () => [],
				run: () => ({
					lastInsertRowid: 0,
					changes: 0,
				}),
			};
		}
		close() {}
	},
}));

describe("createDatabaseConnection", () => {
	const baseConfig = {
		connectionString: "example",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a PostgreSQL connection", () => {
		const connection = createDatabaseConnection({
			...baseConfig,
			type: DBType.PostgreSQL,
		});

		expect(connection.type).toBe(DBType.PostgreSQL);
	});

	it("creates a MySQL connection", () => {
		const connection = createDatabaseConnection({
			...baseConfig,
			type: DBType.MySQL,
		});

		expect(connection.type).toBe(DBType.MySQL);
	});

	it("creates a SQLite connection", () => {
		const connection = createDatabaseConnection({
			...baseConfig,
			type: DBType.SQLite,
		});

		expect(connection.type).toBe(DBType.SQLite);
	});
});

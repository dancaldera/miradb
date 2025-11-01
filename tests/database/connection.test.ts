import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("better-sqlite3", () => ({
	__esModule: true,
	default: class {
		pragma() {}
		prepare() {
			return {
				all: () => [],
				run: () => {},
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

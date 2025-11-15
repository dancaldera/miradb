import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	clearConnectionFactoryOverrides,
	createDatabaseConnection,
	setConnectionFactoryOverrides,
} from "../../src/database/connection.js";
import { ConnectionError } from "../../src/database/errors.js";
import type {
	DatabaseConfig,
	DatabaseConnection,
	QueryResult,
} from "../../src/database/types.js";
import { DBType } from "../../src/types/state.js";

class MockConnection implements DatabaseConnection {
	public readonly connectionString: string;
	public readonly config: DatabaseConfig;

	constructor(
		public readonly type: DBType,
		config: DatabaseConfig,
	) {
		this.connectionString = config.connectionString;
		this.config = config;
	}

	async connect(): Promise<void> {
		// no-op for testing
	}

	async query<
		T extends Record<string, unknown> = Record<string, unknown>,
	>(): Promise<QueryResult<T>> {
		return { rows: [], rowCount: 0 };
	}

	async execute(): Promise<void> {
		// no-op for testing
	}

	async close(): Promise<void> {
		// no-op for testing
	}
}

const createMockFactory =
	(type: DBType) =>
	(config: DatabaseConfig): DatabaseConnection =>
		new MockConnection(type, config);

beforeAll(() => {
	setConnectionFactoryOverrides({
		[DBType.PostgreSQL]: createMockFactory(DBType.PostgreSQL),
		[DBType.MySQL]: createMockFactory(DBType.MySQL),
		[DBType.SQLite]: createMockFactory(DBType.SQLite),
	});
});

afterAll(() => {
	clearConnectionFactoryOverrides();
});

describe("createDatabaseConnection", () => {
	it("creates PostgreSQL connection", () => {
		const config = {
			type: DBType.PostgreSQL,
			connectionString: "postgres://localhost/test",
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("postgresql");
		expect(connection.connectionString).toBe("postgres://localhost/test");
	});

	it("creates MySQL connection", () => {
		const config = {
			type: DBType.MySQL,
			connectionString: "mysql://localhost/test",
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("mysql");
		expect(connection.connectionString).toBe("mysql://localhost/test");
	});

	it("creates SQLite connection", () => {
		const config = {
			type: DBType.SQLite,
			connectionString: "/path/to/database.sqlite",
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("sqlite");
		expect(connection.connectionString).toBe("/path/to/database.sqlite");
	});

	it("creates connections with additional config properties", () => {
		const config = {
			type: DBType.PostgreSQL,
			connectionString: "postgres://localhost/test",
			pool: {
				max: 10,
				idleTimeoutMillis: 30000,
			},
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("postgresql");
	});

	it("throws ConnectionError for unsupported database type", () => {
		const config = {
			type: "unsupported" as any,
			connectionString: "test://localhost/test",
		};

		expect(() => createDatabaseConnection(config)).toThrow(ConnectionError);
		expect(() => createDatabaseConnection(config)).toThrow(
			"Unsupported database type: unsupported",
		);
	});

	it("throws ConnectionError for null database type", () => {
		const config = {
			type: null as any,
			connectionString: "test://localhost/test",
		};

		expect(() => createDatabaseConnection(config)).toThrow(ConnectionError);
		expect(() => createDatabaseConnection(config)).toThrow(
			"Unsupported database type: null",
		);
	});

	it("throws ConnectionError for undefined database type", () => {
		const config = {
			type: undefined as any,
			connectionString: "test://localhost/test",
		};

		expect(() => createDatabaseConnection(config)).toThrow(ConnectionError);
		expect(() => createDatabaseConnection(config)).toThrow(
			"Unsupported database type: undefined",
		);
	});

	it("preserves all config properties in connection", () => {
		const config = {
			type: DBType.MySQL,
			connectionString: "mysql://localhost:3306/test",
			pool: {
				max: 20,
				min: 5,
				acquireTimeoutMillis: 60000,
				createTimeoutMillis: 30000,
				idleTimeoutMillis: 600000,
			},
			ssl: {
				rejectUnauthorized: false,
			},
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("mysql");
		expect(connection.connectionString).toBe("mysql://localhost:3306/test");
	});

	it("handles empty connection string", () => {
		const config = {
			type: DBType.SQLite,
			connectionString: "",
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("sqlite");
		expect(connection.connectionString).toBe("");
	});

	it("handles complex connection strings", () => {
		const complexConnectionString =
			"postgres://user:password@host:5432/database?sslmode=require&application_name=seerdb";
		const config = {
			type: DBType.PostgreSQL,
			connectionString: complexConnectionString,
		};

		const connection = createDatabaseConnection(config);

		expect(connection.type).toBe("postgresql");
		expect(connection.connectionString).toBe(complexConnectionString);
	});

	it("works with all valid DB types", () => {
		const validTypes = [
			{ type: DBType.PostgreSQL, expected: "postgresql" },
			{ type: DBType.MySQL, expected: "mysql" },
			{ type: DBType.SQLite, expected: "sqlite" },
		];

		validTypes.forEach(({ type, expected }) => {
			const config = {
				type,
				connectionString: "test://localhost/test",
			};

			const connection = createDatabaseConnection(config);

			expect(connection.type).toBe(expected);
		});
	});
});

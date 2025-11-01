import { DBType } from "../types/state.js";
import { ConnectionError } from "./errors.js";
import { MySQLConnection } from "./mysql.js";
import { PostgresConnection } from "./postgres.js";
import { SQLiteConnection } from "./sqlite.js";
import type { DatabaseConfig, DatabaseConnection } from "./types.js";

export function createDatabaseConnection(
	config: DatabaseConfig,
): DatabaseConnection {
	switch (config.type) {
		case DBType.PostgreSQL:
			return new PostgresConnection(config);
		case DBType.MySQL:
			return new MySQLConnection(config);
		case DBType.SQLite:
			return new SQLiteConnection(config);
		default:
			throw new ConnectionError(`Unsupported database type: ${config.type}`);
	}
}

import { DBType } from "../types/state.js";
import { ConnectionError } from "./errors.js";
import { MySQLConnection } from "./mysql.js";
import { PostgresConnection } from "./postgres.js";
import { SQLiteConnection } from "./sqlite.js";
import type { DatabaseConfig, DatabaseConnection } from "./types.js";

type ConnectionFactory = (config: DatabaseConfig) => DatabaseConnection;

const defaultFactories: Record<DBType, ConnectionFactory> = {
	[DBType.PostgreSQL]: (config) => new PostgresConnection(config),
	[DBType.MySQL]: (config) => new MySQLConnection(config),
	[DBType.SQLite]: (config) => new SQLiteConnection(config),
};

let factoryOverrides: Partial<Record<DBType, ConnectionFactory>> | undefined;

function resolveFactory(type: DBType): ConnectionFactory {
	return factoryOverrides?.[type] ?? defaultFactories[type];
}

export function setConnectionFactoryOverrides(
	overrides: Partial<Record<DBType, ConnectionFactory>> | null,
): void {
	factoryOverrides = overrides ?? undefined;
}

export function clearConnectionFactoryOverrides(): void {
	factoryOverrides = undefined;
}

export function createDatabaseConnection(
	config: DatabaseConfig,
): DatabaseConnection {
	const { type } = config;

	if (
		type === DBType.PostgreSQL ||
		type === DBType.MySQL ||
		type === DBType.SQLite
	) {
		const factory = resolveFactory(type);
		return factory(config);
	}

	throw new ConnectionError(`Unsupported database type: ${config.type}`);
}

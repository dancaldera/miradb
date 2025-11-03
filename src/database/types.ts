import type { Database as BunDatabase } from "bun:sqlite";
import type { Pool as MySQLPool } from "mysql2/promise";
import type { Pool as PostgresPool } from "pg";
import type { DBType } from "../types/state.js";

export type SQLiteDatabase = BunDatabase;

export interface DatabaseConfig {
	type: DBType;
	connectionString: string;
	pool?: PoolConfig;
}

export interface PoolConfig {
	max?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
	closeTimeoutMillis?: number;
}

export interface QueryRow {
	[column: string]: unknown;
}

export interface QueryResult<T = QueryRow> {
	rows: T[];
	rowCount: number;
	fields?: string[];
}

export interface DatabaseConnection {
	readonly type: DBType;
	connect(): Promise<void>;
	query<T extends QueryRow = QueryRow>(
		sql: string,
		params?: unknown[],
	): Promise<QueryResult<T>>;
	execute(sql: string, params?: unknown[]): Promise<void>;
	stream?<T extends QueryRow = QueryRow>(
		sql: string,
		params?: unknown[],
	): AsyncGenerator<T[], void, unknown>;
	close(): Promise<void>;
}

export interface DatabaseDriver {
	createConnection(config: DatabaseConfig): DatabaseConnection;
}

export type SupportedPool =
	| { client: "postgres"; pool: PostgresPool }
	| { client: "mysql"; pool: MySQLPool }
	| { client: "sqlite"; db: SQLiteDatabase };

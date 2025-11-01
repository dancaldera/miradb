import { Pool } from "pg";
import { DBType } from "../types/state.js";
import type {
	DatabaseConfig,
	DatabaseConnection,
	QueryResult,
} from "./types.js";
import { ConnectionError, DatabaseError } from "./errors.js";

export class PostgresConnection implements DatabaseConnection {
	public readonly type = DBType.PostgreSQL;
	private pool: Pool;
	private connected = false;

	constructor(private readonly config: DatabaseConfig) {
		this.pool = new Pool({
			connectionString: config.connectionString,
			max: config.pool?.max ?? 10,
			idleTimeoutMillis: config.pool?.idleTimeoutMillis ?? 30_000,
			connectionTimeoutMillis: config.pool?.connectionTimeoutMillis ?? 10_000,
		});
	}

	async connect(): Promise<void> {
		try {
			await this.pool.query("SELECT 1");
			this.connected = true;
		} catch (error) {
			throw new ConnectionError(
				"Failed to connect to PostgreSQL database.",
				error instanceof Error ? (error as { code?: string }).code : undefined,
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async query<T extends Record<string, unknown> = Record<string, unknown>>(
		sql: string,
		params: unknown[] = [],
	): Promise<QueryResult<T>> {
		if (!this.connected) {
			await this.connect();
		}

		try {
			const result = await this.pool.query(sql, params);
			return {
				rows: result.rows as T[],
				rowCount: result.rowCount ?? result.rows.length,
				fields: result.fields?.map((field) => field.name),
			};
		} catch (error) {
			throw new DatabaseError(
				"PostgreSQL query failed.",
				error instanceof Error ? (error as { code?: string }).code : undefined,
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		await this.query(sql, params);
	}

	async close(): Promise<void> {
		await this.pool.end();
		this.connected = false;
	}
}

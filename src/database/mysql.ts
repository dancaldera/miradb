import type { Pool } from "mysql2/promise";
import mysql from "mysql2/promise";
import { DBType } from "../types/state.js";
import { ConnectionError, DatabaseError } from "./errors.js";
import type {
	DatabaseConfig,
	DatabaseConnection,
	QueryResult,
} from "./types.js";

export class MySQLConnection implements DatabaseConnection {
	public readonly type = DBType.MySQL;
	private pool: Pool;
	private connected = false;
	private readonly closeTimeoutMillis: number;

	constructor(private readonly config: DatabaseConfig) {
		this.pool = mysql.createPool({
			uri: config.connectionString,
			waitForConnections: true,
			connectionLimit: config.pool?.max ?? 10,
			queueLimit: 0,
		});
		this.closeTimeoutMillis = config.pool?.closeTimeoutMillis ?? 5_000;
	}

	async connect(): Promise<void> {
		try {
			const connection = await this.pool.getConnection();
			this.connected = true;
			connection.release();
		} catch (error) {
			throw new ConnectionError(
				"Failed to connect to MySQL database.",
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
			const [rows, fields] = await this.pool.query(sql, params);
			const typedRows = rows as T[];
			return {
				rows: typedRows,
				rowCount: typedRows.length,
				fields: fields?.map((field) =>
					"name" in field ? String(field.name) : "",
				),
			};
		} catch (error) {
			throw new DatabaseError(
				"MySQL query failed.",
				error instanceof Error ? (error as { code?: string }).code : undefined,
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		await this.query(sql, params);
	}

	async close(): Promise<void> {
		const closePromise = this.pool.end();
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
		let timedOut = false;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutHandle = setTimeout(() => {
				timedOut = true;
				reject(new Error("MySQL pool close timed out."));
			}, this.closeTimeoutMillis);
		});

		try {
			await Promise.race([closePromise, timeoutPromise]);
		} catch (error) {
			if (timedOut) {
				console.warn(
					"MySQL pool close timed out; continuing shutdown asynchronously.",
				);
				closePromise
					.catch((closeError) => {
						console.warn("MySQL pool close eventually failed:", closeError);
					})
					.finally(() => {
						if (timeoutHandle) {
							clearTimeout(timeoutHandle);
						}
					});
			} else {
				console.warn("Failed to close MySQL pool cleanly:", error);
			}
		} finally {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			this.connected = false;
		}
	}
}

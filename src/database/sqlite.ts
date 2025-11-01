import Database from "better-sqlite3";
import { DBType } from "../types/state.js";
import type {
	DatabaseConfig,
	DatabaseConnection,
	QueryResult,
	SQLiteDatabase,
} from "./types.js";
import { ConnectionError, DatabaseError } from "./errors.js";

export class SQLiteConnection implements DatabaseConnection {
	public readonly type = DBType.SQLite;
	private db: SQLiteDatabase | null = null;

	constructor(private readonly config: DatabaseConfig) {}

	async connect(): Promise<void> {
		try {
			this.db = new Database(this.config.connectionString, {
				fileMustExist: false,
			});
			this.db.pragma("journal_mode = WAL");
		} catch (error) {
			throw new ConnectionError(
				"Failed to open SQLite database.",
				error instanceof Error ? (error as { code?: string }).code : undefined,
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async query<T extends Record<string, unknown> = Record<string, unknown>>(
		sql: string,
		params: unknown[] = [],
	): Promise<QueryResult<T>> {
		if (!this.db) {
			await this.connect();
		}
		try {
			const statement = this.db!.prepare(sql);
			const rows = statement.all(...params) as T[];
			return {
				rows,
				rowCount: rows.length,
			};
		} catch (error) {
			throw new DatabaseError(
				"SQLite query failed.",
				error instanceof Error ? (error as { code?: string }).code : undefined,
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		if (!this.db) {
			await this.connect();
		}
		try {
			const statement = this.db!.prepare(sql);
			statement.run(...params);
		} catch (error) {
			throw new DatabaseError(
				"SQLite statement execution failed.",
				error instanceof Error ? (error as { code?: string }).code : undefined,
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async close(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}

import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { DBType } from '../types/state.js';
import type { DatabaseConfig, DatabaseConnection, QueryResult } from './types.js';
import { ConnectionError, DatabaseError } from './errors.js';

export class MySQLConnection implements DatabaseConnection {
  public readonly type = DBType.MySQL;
  private pool: Pool;
  private connected = false;

  constructor(private readonly config: DatabaseConfig) {
    this.pool = mysql.createPool({
      uri: config.connectionString,
      waitForConnections: true,
      connectionLimit: config.pool?.max ?? 10,
      queueLimit: 0
    });
  }

  async connect(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      this.connected = true;
      connection.release();
    } catch (error) {
      throw new ConnectionError(
        'Failed to connect to MySQL database.',
        error instanceof Error ? (error as { code?: string }).code : undefined,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
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
        fields: fields?.map(field => 'name' in field ? String(field.name) : '')
      };
    } catch (error) {
      throw new DatabaseError(
        'MySQL query failed.',
        error instanceof Error ? (error as { code?: string }).code : undefined,
        error instanceof Error ? error.message : undefined
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

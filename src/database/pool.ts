import { Pool as PostgresPool } from 'pg';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import { DBType } from '../types/state.js';
import type { PoolConfig, SupportedPool } from './types.js';
import { ConnectionError } from './errors.js';

export function createPool(
  type: DBType,
  connectionString: string,
  poolConfig?: PoolConfig
): SupportedPool {
  switch (type) {
    case DBType.PostgreSQL: {
      const pool = new PostgresPool({
        connectionString,
        max: poolConfig?.max ?? 10,
        idleTimeoutMillis: poolConfig?.idleTimeoutMillis ?? 30_000,
        connectionTimeoutMillis: poolConfig?.connectionTimeoutMillis ?? 10_000
      });
      return { client: 'postgres', pool };
    }
    case DBType.MySQL: {
      const pool = mysql.createPool({
        uri: connectionString,
        waitForConnections: true,
        connectionLimit: poolConfig?.max ?? 10,
        queueLimit: 0
      });
      return { client: 'mysql', pool };
    }
    case DBType.SQLite: {
      try {
        const db = new Database(connectionString, { fileMustExist: false });
        return { client: 'sqlite', db };
      } catch (error) {
        throw new ConnectionError(
          'Failed to open SQLite database.',
          'SQLITE_OPEN_ERROR',
          error instanceof Error ? error.message : undefined
        );
      }
    }
    default:
      throw new ConnectionError(`Unsupported database type: ${type}`);
  }
}

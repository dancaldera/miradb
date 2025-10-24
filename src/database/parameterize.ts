import { DBType } from '../types/state.js';

const POSTGRES_PLACEHOLDER = /\$(\d+)/g;

export interface ParameterizedQuery {
  sql: string;
  params: unknown[];
}

export function parameterize(
  sql: string,
  dbType: DBType,
  params: unknown[] = []
): ParameterizedQuery {
  if (dbType === DBType.PostgreSQL) {
    return { sql, params };
  }

  if (dbType === DBType.MySQL || dbType === DBType.SQLite) {
    const convertedSql = sql.replace(POSTGRES_PLACEHOLDER, () => '?');
    return { sql: convertedSql, params };
  }

  return { sql, params };
}

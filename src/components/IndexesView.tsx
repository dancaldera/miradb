import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import { createDatabaseConnection } from '../database/connection.js';
import { DBType } from '../types/state.js';
import { ViewBuilder } from './ViewBuilder.js';

interface Index {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  type?: string;
}

export const IndexesView: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [indexes, setIndexes] = useState<Index[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state?.activeConnection || !state?.dbType || !state?.selectedTable) {
      return;
    }

    const fetchIndexes = async () => {
      setLoading(true);
      try {
        const connection = createDatabaseConnection({
          type: state.dbType,
          connectionString: state.activeConnection.connectionString
        });
        await connection.connect();

        let query: string;
        const params: any[] = [];

        switch (state.dbType) {
          case DBType.PostgreSQL:
            query = `
              SELECT
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                am.amname as index_type
              FROM pg_class t
              JOIN pg_index ix ON t.oid = ix.indrelid
              JOIN pg_class i ON i.oid = ix.indexrelid
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
              JOIN pg_am am ON i.relam = am.oid
              JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE t.relkind = 'r'
                AND t.relname = $1
                AND n.nspname = $2
              ORDER BY i.relname, a.attnum
            `;
            const schemaName = state.selectedTable.includes('.')
              ? state.selectedTable.split('.')[0]
              : 'public';
            const tableName = state.selectedTable.includes('.')
              ? state.selectedTable.split('.').pop()
              : state.selectedTable;
            params.push(tableName, schemaName);
            break;

          case DBType.MySQL:
            query = `
              SELECT
                INDEX_NAME as index_name,
                COLUMN_NAME as column_name,
                NON_UNIQUE = 0 as is_unique,
                INDEX_NAME = 'PRIMARY' as is_primary,
                INDEX_TYPE as index_type
              FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
              ORDER BY INDEX_NAME, SEQ_IN_INDEX
            `;
            params.push(state.selectedTable.split('.').pop() || state.selectedTable);
            break;

          case DBType.SQLite:
            query = `PRAGMA index_list(?)`;
            params.push(state.selectedTable.split('.').pop() || state.selectedTable);
            break;

          default:
            throw new Error(`Unsupported database type: ${state.dbType}`);
        }

        const result = await connection.query(query, params);

        let formattedIndexes: Index[] = [];

        if (state.dbType === DBType.SQLite) {
          // SQLite returns different format, need to get column info separately
          const indexList = result.rows;
          for (const indexRow of indexList as any[]) {
            const columnsQuery = `PRAGMA index_info(?)`;
            const columnsResult = await connection.query(columnsQuery, [indexRow.name]);

            formattedIndexes.push({
              name: indexRow.name,
              tableName: state.selectedTable!,
              columns: columnsResult.rows.map((row: any) => row.name),
              isUnique: Boolean(indexRow.unique),
              isPrimary: indexRow.name === 'sqlite_autoindex_' + state.selectedTable
            });
          }
        } else {
          // Group by index name and collect columns
          const indexMap = new Map<string, Index>();

          for (const row of result.rows as any[]) {
            const indexName = row.index_name;

            if (!indexMap.has(indexName)) {
              indexMap.set(indexName, {
                name: indexName,
                tableName: state.selectedTable!,
                columns: [],
                isUnique: Boolean(row.is_unique),
                isPrimary: Boolean(row.is_primary),
                type: row.index_type
              });
            }

            const index = indexMap.get(indexName)!;
            if (!index.columns.includes(row.column_name)) {
              index.columns.push(row.column_name);
            }
          }

          formattedIndexes = Array.from(indexMap.values());
        }

        setIndexes(formattedIndexes);
        await connection.close();
      } catch (error) {
        dispatch({
          type: ActionType.SetError,
          error: error instanceof Error ? error.message : 'Failed to fetch indexes'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchIndexes();
  }, [state?.activeConnection, state?.dbType, state?.selectedTable, dispatch]);

  const primaryKeys = indexes.filter(i => i.isPrimary);
  const uniqueIndexes = indexes.filter(i => i.isUnique && !i.isPrimary);
  const nonUniqueIndexes = indexes.filter(i => !i.isUnique && !i.isPrimary);

  return (
    <ViewBuilder
      title="Table Indexes"
      subtitle={`Table: ${state?.selectedTable || 'Unknown'}`}
      footer="Esc: Back to table view"
    >
      {loading ? (
        <Text color="yellow">Loading indexes...</Text>
      ) : (
        <Box flexDirection="column">
          {indexes.length === 0 ? (
            <Box flexDirection="column">
              <Text color="gray">No indexes found for this table.</Text>
              <Text color="gray">This table might not have any indexes defined.</Text>
            </Box>
          ) : (
            <>
              {primaryKeys.length > 0 && (
                <Box flexDirection="column" marginBottom={2}>
                  <Text color="green" bold>Primary Key Indexes ({primaryKeys.length}):</Text>
                  {primaryKeys.map((index, indexIndex) => (
                    <Box key={index.name || indexIndex} flexDirection="column" paddingX={1}>
                      <Text color="green">
                        {index.name}
                      </Text>
                      <Text color="white">
                        Columns: {index.columns.join(', ')}
                      </Text>
                      {index.type && (
                        <Text color="gray" dimColor>
                          Type: {index.type}
                        </Text>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {uniqueIndexes.length > 0 && (
                <Box flexDirection="column" marginBottom={2}>
                  <Text color="blue" bold>Unique Indexes ({uniqueIndexes.length}):</Text>
                  {uniqueIndexes.map((index, indexIndex) => (
                    <Box key={index.name || indexIndex} flexDirection="column" paddingX={1}>
                      <Text color="blue">
                        {index.name}
                      </Text>
                      <Text color="white">
                        Columns: {index.columns.join(', ')}
                      </Text>
                      {index.type && (
                        <Text color="gray" dimColor>
                          Type: {index.type}
                        </Text>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {nonUniqueIndexes.length > 0 && (
                <Box flexDirection="column" marginBottom={2}>
                  <Text color="yellow" bold>Non-Unique Indexes ({nonUniqueIndexes.length}):</Text>
                  {nonUniqueIndexes.map((index, indexIndex) => (
                    <Box key={index.name || indexIndex} flexDirection="column" paddingX={1}>
                      <Text color="yellow">
                        {index.name}
                      </Text>
                      <Text color="white">
                        Columns: {index.columns.join(', ')}
                      </Text>
                      {index.type && (
                        <Text color="gray" dimColor>
                          Type: {index.type}
                        </Text>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              Total indexes: {indexes.length}
            </Text>
            <Text color="gray" dimColor>
              Primary: {primaryKeys.length} • Unique: {uniqueIndexes.length} • Non-unique: {nonUniqueIndexes.length}
            </Text>
          </Box>
        </Box>
      )}
    </ViewBuilder>
  );
};
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import { createDatabaseConnection } from '../database/connection.js';
import { DBType } from '../types/state.js';
import { ViewBuilder } from './ViewBuilder.js';

interface Relationship {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  constraintType: 'FOREIGN KEY' | 'PRIMARY KEY' | 'UNIQUE';
}

export const RelationshipsView: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state?.activeConnection || !state?.dbType || !state?.selectedTable) {
      return;
    }

    const fetchRelationships = async () => {
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
                tc.constraint_name,
                tc.table_name as source_table,
                kcu.column_name as source_column,
                ccu.table_name AS target_table,
                ccu.column_name AS target_column,
                tc.constraint_type
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              LEFT JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
              WHERE tc.table_schema = $1
                AND tc.table_name = $2
              ORDER BY tc.constraint_type, tc.constraint_name
            `;
            params.push(state.selectedTable.split('.')[0] || 'public', state.selectedTable.split('.').pop() || state.selectedTable);
            break;

          case DBType.MySQL:
            query = `
              SELECT
                CONSTRAINT_NAME as constraint_name,
                TABLE_NAME as source_table,
                COLUMN_NAME as source_column,
                REFERENCED_TABLE_NAME as target_table,
                REFERENCED_COLUMN_NAME as target_column,
                CONSTRAINT_TYPE as constraint_type
              FROM information_schema.KEY_COLUMN_USAGE
              LEFT JOIN information_schema.TABLE_CONSTRAINTS
                ON information_schema.KEY_COLUMN_USAGE.CONSTRAINT_NAME = information_schema.TABLE_CONSTRAINTS.CONSTRAINT_NAME
              WHERE information_schema.KEY_COLUMN_USAGE.TABLE_SCHEMA = DATABASE()
                AND information_schema.KEY_COLUMN_USAGE.TABLE_NAME = ?
              ORDER BY information_schema.TABLE_CONSTRAINTS.CONSTRAINT_TYPE, CONSTRAINT_NAME
            `;
            params.push(state.selectedTable.split('.').pop() || state.selectedTable);
            break;

          case DBType.SQLite:
            query = `PRAGMA foreign_key_list(?)`;
            params.push(state.selectedTable.split('.').pop() || state.selectedTable);
            break;

          default:
            throw new Error(`Unsupported database type: ${state.dbType}`);
        }

        const result = await connection.query(query, params);

        let formattedRelationships: Relationship[] = [];

        if (state.dbType === DBType.SQLite) {
          // SQLite returns different format
          formattedRelationships = result.rows.map((row: any) => ({
            constraintName: row.id || `fk_${row.table}`,
            sourceTable: state.selectedTable!,
            sourceColumn: row.from,
            targetTable: row.table,
            targetColumn: row.to,
            constraintType: 'FOREIGN KEY' as const
          }));
        } else {
          formattedRelationships = result.rows.map((row: any) => ({
            constraintName: row.constraint_name,
            sourceTable: row.source_table,
            sourceColumn: row.source_column,
            targetTable: row.target_table,
            targetColumn: row.target_column,
            constraintType: row.constraint_type || 'FOREIGN KEY'
          }));
        }

        setRelationships(formattedRelationships);
        await connection.close();
      } catch (error) {
        dispatch({
          type: ActionType.SetError,
          error: error instanceof Error ? error.message : 'Failed to fetch relationships'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRelationships();
  }, [state?.activeConnection, state?.dbType, state?.selectedTable, dispatch]);

  const foreignKeys = relationships.filter(r => r.constraintType === 'FOREIGN KEY');
  const primaryKeys = relationships.filter(r => r.constraintType === 'PRIMARY KEY');
  const uniqueConstraints = relationships.filter(r => r.constraintType === 'UNIQUE');

  return (
    <ViewBuilder
      title="Table Relationships"
      subtitle={`Table: ${state.selectedTable || 'Unknown'}`}
      footer="Esc: Back to table view"
    >
      {loading ? (
        <Text color="yellow">Loading relationships...</Text>
      ) : (
        <Box flexDirection="column">
          {foreignKeys.length === 0 && primaryKeys.length === 0 && uniqueConstraints.length === 0 ? (
            <Box flexDirection="column">
              <Text color="gray">No relationships found for this table.</Text>
              <Text color="gray">This table might not have any foreign keys or constraints defined.</Text>
            </Box>
          ) : (
            <>
              {foreignKeys.length > 0 && (
                <Box flexDirection="column" marginBottom={2}>
                  <Text color="cyan" bold>Foreign Keys ({foreignKeys.length}):</Text>
                  {foreignKeys.map((fk, index) => (
                    <Box key={fk.constraintName || index} flexDirection="column" paddingX={1}>
                      <Text color="yellow">
                        {fk.sourceColumn} → {fk.targetTable}.{fk.targetColumn}
                      </Text>
                      <Text color="gray" dimColor>
                        Constraint: {fk.constraintName}
                      </Text>
                    </Box>
                  ))}
                </Box>
              )}

              {primaryKeys.length > 0 && (
                <Box flexDirection="column" marginBottom={2}>
                  <Text color="green" bold>Primary Keys ({primaryKeys.length}):</Text>
                  {primaryKeys.map((pk, index) => (
                    <Box key={pk.constraintName || index} flexDirection="column" paddingX={1}>
                      <Text color="green">
                        {pk.sourceColumn}
                      </Text>
                      <Text color="gray" dimColor>
                        Constraint: {pk.constraintName}
                      </Text>
                    </Box>
                  ))}
                </Box>
              )}

              {uniqueConstraints.length > 0 && (
                <Box flexDirection="column" marginBottom={2}>
                  <Text color="blue" bold>Unique Constraints ({uniqueConstraints.length}):</Text>
                  {uniqueConstraints.map((uc, index) => (
                    <Box key={uc.constraintName || index} flexDirection="column" paddingX={1}>
                      <Text color="blue">
                        {uc.sourceColumn}
                      </Text>
                      <Text color="gray" dimColor>
                        Constraint: {uc.constraintName}
                      </Text>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              Total relationships: {relationships.length}
            </Text>
          </Box>
        </Box>
      )}
    </ViewBuilder>
  );
};
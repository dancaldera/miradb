import React, { useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppDispatch, useAppState } from '../state/context.js';
import { clearConnectionCache, clearTableCacheEntry, fetchColumns, fetchTableData } from '../state/effects.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import type { ColumnInfo, TableInfo } from '../types/state.js';
import { tableCacheKey } from '../state/cache.js';

const PAGE_SIZE = 50;

export const DataPreviewView: React.FC = () => {
  const dispatch = useAppDispatch();
  const state = useAppState();

  const table = state.selectedTable;

  useEffect(() => {
    if (!state.activeConnection || !state.dbType || !table) {
      dispatch({ type: ActionType.SetView, view: ViewState.Tables });
      return;
    }

    if (state.columns.length === 0) {
      void fetchColumns(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table);
    }

    if (state.dataRows.length === 0) {
      void fetchTableData(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table, { offset: 0, limit: PAGE_SIZE });
    }
  }, [
    dispatch,
    state.activeConnection,
    state.dbType,
    state.columns.length,
    state.dataRows.length,
    table
  ]);

  useInput((input, key) => {
    if (!table || !state.activeConnection || !state.dbType) {
      return;
    }

    if (key.leftArrow || input === 'b') {
      dispatch({ type: ActionType.ClearSelectedTable });
      dispatch({ type: ActionType.SetView, view: ViewState.Tables });
    }

    if ((input === 'p' || input === 'P') && state.currentOffset > 0 && !state.loading) {
      const previousOffset = Math.max(0, state.currentOffset - PAGE_SIZE);
      void fetchTableData(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table, { offset: previousOffset, limit: PAGE_SIZE });
      return;
    }

    if (input === 'r' && !state.loading) {
      void fetchTableData(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table, { offset: state.currentOffset, limit: PAGE_SIZE });
      return;
    }

    if ((input === 'c' || input === 'C') && !state.loading) {
      void clearTableCacheEntry(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table);
      return;
    }

    if ((input === 'g' || input === 'G') && !state.loading) {
      void clearConnectionCache(dispatch, state);
      return;
    }

    if ((input === 'n' || key.rightArrow) && state.hasMoreRows && !state.loading) {
      void fetchTableData(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table, { offset: state.currentOffset + PAGE_SIZE, limit: PAGE_SIZE });
    }
  });

  const rowsToDisplay = state.dataRows;

  const totalLoaded = state.currentOffset + state.dataRows.length;
  const cacheKey = tableCacheKey(table);
  const cacheEntry = cacheKey ? state.tableCache[cacheKey] : undefined;
  const statusMessage = useMemo(() => {
    const currentPage = Math.floor(state.currentOffset / PAGE_SIZE) + 1;
    const moreRowsText = state.hasMoreRows ? 'More rows available' : 'End of results';
    const prevText = state.currentOffset > 0 ? 'p previous page' : 'prev unavailable';
    const nextText = state.hasMoreRows ? 'n/→ next page' : 'next unavailable';
    const cacheText = cacheEntry ? (cacheEntry.rows.length > 0 ? 'cache warm' : 'cache metadata') : 'cache empty';
    const controlInfo = ['←/b back', prevText, nextText, 'r refresh', 'c clear table cache', 'g clear all cache']
      .filter(Boolean)
      .join(', ');
    return `Rows loaded: ${totalLoaded} • Page: ${currentPage} • ${moreRowsText} • ${cacheText} • Controls: ${controlInfo}`;
  }, [cacheEntry, state.currentOffset, state.hasMoreRows, totalLoaded]);

  const columnSummary = useMemo(() => {
    if (state.columns.length === 0) {
      return <Text dimColor>Loading column metadata…</Text>;
    }

    return state.columns.map(column => (
      <Text key={column.name} color={column.isPrimaryKey ? 'yellow' : undefined}>
        {renderColumnSummary(column)}
      </Text>
    ));
  }, [state.columns]);

  if (!table) {
    return (
      <Box>
        <Text color="red">No table selected.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        Previewing <Text color="cyan">{renderTableName(table)}</Text>
      </Text>
      {state.refreshingTableKey === cacheKey && (
        <Text color="yellow">Refreshing data…</Text>
      )}
      <Box marginTop={1} flexDirection="column">
        {columnSummary}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {rowsToDisplay.length === 0 ? (
          <Text dimColor>No rows loaded yet.</Text>
        ) : (
          rowsToDisplay.map((row, index) => (
            <Text key={index}>
              {formatRow(row, state.columns)}
            </Text>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {statusMessage}
          {state.loading ? ' Loading…' : ''}
        </Text>
      </Box>
    </Box>
  );
};

function renderTableName(table: TableInfo): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name;
}

function renderColumnSummary(column: ColumnInfo): string {
  const parts = [
    column.name,
    `type=${column.dataType}`,
    column.nullable ? 'nullable' : 'NOT NULL'
  ];

  if (column.isPrimaryKey) {
    parts.push('[PK]');
  }
  if (column.isForeignKey && column.foreignTable && column.foreignColumn) {
    parts.push(`[FK → ${column.foreignTable}.${column.foreignColumn}]`);
  }

  return parts.join(' • ');
}

function formatRow(row: Record<string, unknown>, columns: { name: string }[]): string {
  if (columns.length === 0) {
    return JSON.stringify(row);
  }

  const parts = columns.map(column => {
    const value = row[column.name];
    return `${column.name}=${stringifyValue(value)}`;
  });

  return parts.join(' | ');
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

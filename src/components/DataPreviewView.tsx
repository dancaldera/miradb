import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppDispatch, useAppState } from '../state/context.js';
import { clearConnectionCache, clearTableCacheEntry, exportTableData, fetchColumns, fetchTableData } from '../state/effects.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import type { ColumnInfo, TableInfo } from '../types/state.js';
import { tableCacheKey } from '../state/cache.js';
import { processRows, formatValueForDisplay, truncateString, calculateColumnWidth } from '../utils/data-processing.js';
import { copyToClipboard, formatTableForClipboard } from '../utils/clipboard.js';

const PAGE_SIZE = 50;

export const DataPreviewView: React.FC = () => {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const [horizontalOffset, setHorizontalOffset] = useState(0);

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

    if (input === 'd' && state.dataRows.length > 0) {
      dispatch({ type: ActionType.SetView, view: ViewState.RowDetail });
    }

    if (input === 'q') {
      dispatch({ type: ActionType.SetView, view: ViewState.Query });
    }

    // Sorting shortcuts
    if (input === 's' && state.columns.length > 0) {
      // Cycle through columns for sorting
      const currentColumn = state.sortConfig.column;
      const currentDirection = state.sortConfig.direction;

      let nextColumn: string | null = null;
      let nextDirection: 'asc' | 'desc' | 'off' = 'asc';

      if (!currentColumn) {
        // Start with first column
        nextColumn = state.columns[0].name;
        nextDirection = 'asc';
      } else {
        const currentIndex = state.columns.findIndex(col => col.name === currentColumn);
        if (currentIndex === -1) {
          // Current column not found, start over
          nextColumn = state.columns[0].name;
          nextDirection = 'asc';
        } else {
          if (currentDirection === 'asc') {
            // Same column, switch to desc
            nextColumn = currentColumn;
            nextDirection = 'desc';
          } else if (currentDirection === 'desc') {
            // Same column, switch to off
            nextColumn = null;
            nextDirection = 'off';
          } else {
            // Move to next column
            const nextIndex = (currentIndex + 1) % state.columns.length;
            nextColumn = state.columns[nextIndex].name;
            nextDirection = 'asc';
          }
        }
      }

      dispatch({
        type: ActionType.SetSortConfig,
        sortConfig: { column: nextColumn, direction: nextDirection }
      });
    }

    // Clear sorting
    if (input === 'S') {
      dispatch({
        type: ActionType.SetSortConfig,
        sortConfig: { column: null, direction: 'off' }
      });
    }

    // Filtering shortcuts
    if (input === 'f') {
      // This would require a more complex input dialog
      // For now, just clear filter
      dispatch({ type: ActionType.SetFilterValue, filterValue: '' });
    }

    // Export shortcuts
    if (input === 'e') {
      // Export as CSV
      void exportTableData(dispatch, state, 'csv', true);
    }
    if (input === 'E') {
      // Export as JSON
      void exportTableData(dispatch, state, 'json', true);
    }

    // Clipboard shortcuts
    if (input === 'c' && key.ctrl) {
      // Copy current view to clipboard
      const tableText = formatTableForClipboard(rowsToDisplay, state.columns, true);
      copyToClipboard(tableText).then(success => {
        if (success) {
          dispatch({
            type: ActionType.SetInfo,
            message: `Copied ${rowsToDisplay.length} rows to clipboard`
          });
        } else {
          dispatch({
            type: ActionType.SetError,
            error: 'Failed to copy to clipboard'
          });
        }
      });
      return;
    }

    // Horizontal scrolling
    if (key.leftArrow && horizontalOffset > 0) {
      setHorizontalOffset(Math.max(0, horizontalOffset - 10));
    }
    if (key.rightArrow && horizontalOffset < 100) {
      setHorizontalOffset(Math.min(100, horizontalOffset + 10));
    }
  });

  // Process rows with sorting and filtering
  const processedRows = useMemo(() => {
    return processRows(state.dataRows, state.sortConfig, state.filterValue, state.columns);
  }, [state.dataRows, state.sortConfig, state.filterValue, state.columns]);

  const rowsToDisplay = processedRows;

  const totalLoaded = state.currentOffset + processedRows.length;
  const cacheKey = tableCacheKey(table);
  const cacheEntry = cacheKey ? state.tableCache[cacheKey] : undefined;
  const statusMessage = useMemo(() => {
    const currentPage = Math.floor(state.currentOffset / PAGE_SIZE) + 1;
    const moreRowsText = state.hasMoreRows ? 'More rows available' : 'End of results';
    const prevText = state.currentOffset > 0 ? 'p previous page' : 'prev unavailable';
    const nextText = state.hasMoreRows ? 'n next page' : 'next unavailable';
    const cacheText = cacheEntry ? (cacheEntry.rows.length > 0 ? 'cache warm' : 'cache metadata') : 'cache empty';

    let sortText = '';
    if (state.sortConfig.column && state.sortConfig.direction !== 'off') {
      sortText = `Sorted by ${state.sortConfig.column} (${state.sortConfig.direction})`;
    }

    let filterText = '';
    if (state.filterValue) {
      filterText = `Filtered: "${state.filterValue}"`;
    }

    const parts = [
      `Rows: ${rowsToDisplay.length}${state.filterValue ? `/${state.dataRows.length}` : ''} loaded`,
      `Page: ${currentPage}`,
      moreRowsText,
      cacheText,
      sortText,
      filterText,
      `Controls: ←/b back, ${prevText}, ${nextText}, s sort, S clear sort, f clear filter, r refresh, c clear cache, g clear all`
    ].filter(Boolean);

    return parts.join(' • ');
  }, [cacheEntry, state.currentOffset, state.hasMoreRows, totalLoaded, rowsToDisplay.length, state.dataRows.length, state.sortConfig, state.filterValue]);

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
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ←/b: Back | p/n: Previous/Next page | s: Sort | S: Clear sort | f: Clear filter | e: Export CSV | E: Export JSON | Ctrl+C: Copy | r: Refresh | c: Clear cache | d: Row details | q: Query
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

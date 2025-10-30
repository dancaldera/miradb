import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppDispatch, useAppState } from '../state/context.js';
import { clearConnectionCache, clearTableCacheEntry, exportTableData, fetchColumns, fetchTableData } from '../state/effects.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import type { ColumnInfo, DataRow, TableInfo } from '../types/state.js';
import { tableCacheKey } from '../state/cache.js';
import { processRows, formatValueForDisplay, truncateString, calculateColumnWidth } from '../utils/data-processing.js';
import { copyToClipboard, formatTableForClipboard } from '../utils/clipboard.js';
import { getColorForDataType, formatValueWithTruncation, getHeaderColor } from '../utils/color-mapping.js';
import { selectVisibleColumns, getColumnDisplayWidth, getVisibilityModeLabel, getNextVisibilityMode } from '../utils/column-selection.js';

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

    // Handle expanded row view first
    if (state.expandedRow) {
      if (key.escape || input === 'q' || input === 'b') {
        dispatch({ type: ActionType.SetExpandedRow, row: null });
      }
      return;
    }

    // Navigation between views
    if (key.escape || input === 'b') {
      dispatch({ type: ActionType.ClearSelectedTable });
      dispatch({ type: ActionType.SetView, view: ViewState.Tables });
      return;
    }

    // Row selection with up/down arrows
    if (key.upArrow) {
      if (state.selectedRowIndex === null || state.selectedRowIndex === 0) {
        dispatch({ type: ActionType.SetSelectedRowIndex, index: rowsToDisplay.length - 1 });
      } else {
        dispatch({ type: ActionType.SetSelectedRowIndex, index: state.selectedRowIndex - 1 });
      }
      return;
    }

    if (key.downArrow) {
      if (state.selectedRowIndex === null) {
        dispatch({ type: ActionType.SetSelectedRowIndex, index: 0 });
      } else if (state.selectedRowIndex >= rowsToDisplay.length - 1) {
        dispatch({ type: ActionType.SetSelectedRowIndex, index: 0 });
      } else {
        dispatch({ type: ActionType.SetSelectedRowIndex, index: state.selectedRowIndex + 1 });
      }
      return;
    }

    // Enter key to expand selected row
    if (key.return && state.selectedRowIndex !== null && rowsToDisplay[state.selectedRowIndex]) {
      dispatch({ type: ActionType.SetExpandedRow, row: rowsToDisplay[state.selectedRowIndex] });
      return;
    }

    // Home key to jump to first page (if supported by terminal)
    if ('home' in key && (key as Record<string, unknown>).home && state.currentOffset > 0 && !state.loading) {
      void fetchTableData(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, table, { offset: 0, limit: PAGE_SIZE });
      return;
    }

    // Pagination - previous page
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

    // Column visibility toggle
    if (input === 'v') {
      const nextMode = getNextVisibilityMode(state.columnVisibilityMode);
      dispatch({
        type: ActionType.SetColumnVisibilityMode,
        mode: nextMode
      });
      return;
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

  // Select visible columns based on visibility mode
  const visibleColumns = useMemo(() => {
    return selectVisibleColumns(state.columns, state.columnVisibilityMode, 5);
  }, [state.columns, state.columnVisibilityMode]);

  const totalLoaded = state.currentOffset + processedRows.length;
  const cacheKey = tableCacheKey(table);
  const cacheEntry = cacheKey ? state.tableCache[cacheKey] : undefined;
  const statusMessage = useMemo(() => {
    const currentPage = Math.floor(state.currentOffset / PAGE_SIZE) + 1;
    const startRow = state.currentOffset + 1;
    const endRow = state.currentOffset + rowsToDisplay.length;

    const parts: string[] = [];

    // Row range display
    parts.push(`Showing rows ${startRow}-${endRow}`);

    // Page number
    parts.push(`Page ${currentPage}`);

    // More rows indicator
    if (state.hasMoreRows) {
      parts.push('More available');
    } else {
      parts.push('End reached');
    }

    // Sort status
    if (state.sortConfig.column && state.sortConfig.direction !== 'off') {
      const arrow = state.sortConfig.direction === 'asc' ? '↑' : '↓';
      parts.push(`Sort: ${state.sortConfig.column} ${arrow}`);
    }

    // Filter status
    if (state.filterValue) {
      parts.push(`Filter: "${state.filterValue}"`);
    }

    return parts.join(' • ');
  }, [state.currentOffset, state.hasMoreRows, rowsToDisplay.length, state.sortConfig, state.filterValue]);

  if (!table) {
    return (
      <Box>
        <Text color="red">No table selected.</Text>
      </Box>
    );
  }

  // Show expanded row view if a row is expanded
  if (state.expandedRow && state.columns.length > 0) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="cyan">{renderTableName(table)}</Text> • Row Details
        </Text>
        <Box marginTop={1}>
          {renderExpandedRow(state.expandedRow, state.columns)}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text>
          <Text color="cyan" bold>{renderTableName(table)}</Text>
          {state.loading && <Text color="yellow"> • Loading…</Text>}
          {state.refreshingTableKey === cacheKey && <Text color="yellow"> • Refreshing…</Text>}
        </Text>
        <Text dimColor> {statusMessage}</Text>
      </Box>

      {/* View mode indicator */}
      <Box marginTop={1}>
        <Text dimColor>
          [{getVisibilityModeLabel(state.columnVisibilityMode)}] {visibleColumns.length === state.columns.length ? 'All' : visibleColumns.length} of {state.columns.length} columns
        </Text>
      </Box>

      {/* Table header row */}
      {visibleColumns.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {renderHeaderRow(visibleColumns, state.sortConfig)}
          <Text dimColor>{'─'.repeat(80)}</Text>
        </Box>
      )}

      {/* Data rows */}
      <Box marginTop={1} flexDirection="column">
        {rowsToDisplay.length === 0 ? (
          <Text dimColor>
            {state.loading ? 'Loading rows…' : 'No rows available.'}
          </Text>
        ) : (
          rowsToDisplay.map((row, index) => (
            <Box key={index}>
              {renderCondensedRow(row, visibleColumns, index === state.selectedRowIndex)}
            </Box>
          ))
        )}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓: Select | Enter: Expand | v: Toggle columns | p/n: Prev/Next | s: Sort | r: Refresh | Esc: Back
        </Text>
      </Box>
    </Box>
  );
};

function renderTableName(table: TableInfo): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name;
}

/**
 * Render a condensed row with colored values based on data types
 */
function renderCondensedRow(
  row: DataRow,
  columns: ColumnInfo[],
  isSelected: boolean
): React.ReactElement {
  if (columns.length === 0) {
    return <Text>{JSON.stringify(row)}</Text>;
  }

  const parts: React.ReactElement[] = [];

  // Selection indicator
  if (isSelected) {
    parts.push(<Text key="indicator" color="cyan" bold>▶ </Text>);
  } else {
    parts.push(<Text key="indicator">  </Text>);
  }

  // Render each column value with appropriate color and dynamic width
  columns.forEach((column, idx) => {
    const value = row[column.name];
    const color = getColorForDataType(column.dataType, value);
    const width = getColumnDisplayWidth(column);
    const formattedValue = formatValueWithTruncation(value, width);

    if (idx > 0) {
      parts.push(<Text key={`sep-${idx}`} dimColor> | </Text>);
    }

    parts.push(
      <Text key={`col-${idx}`} color={color} dimColor={value === null || value === undefined}>
        {formattedValue}
      </Text>
    );
  });

  return <Text>{parts}</Text>;
}

/**
 * Render column header row
 */
function renderHeaderRow(columns: ColumnInfo[], sortConfig: { column: string | null; direction: 'asc' | 'desc' | 'off' }): React.ReactElement {
  const parts: React.ReactElement[] = [];

  parts.push(<Text key="indicator">  </Text>);

  columns.forEach((column, idx) => {
    if (idx > 0) {
      parts.push(<Text key={`sep-${idx}`} dimColor> | </Text>);
    }

    const width = getColumnDisplayWidth(column);
    let columnText = formatValueWithTruncation(column.name.toUpperCase(), width);

    // Add sort indicator
    if (sortConfig.column === column.name) {
      if (sortConfig.direction === 'asc') {
        columnText += ' ↑';
      } else if (sortConfig.direction === 'desc') {
        columnText += ' ↓';
      }
    }

    parts.push(
      <Text key={`col-${idx}`} color={getHeaderColor()} bold>
        {columnText}
      </Text>
    );
  });

  return <Text>{parts}</Text>;
}

/**
 * Render expanded row view with full details
 */
function renderExpandedRow(row: DataRow, columns: ColumnInfo[]): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">Row Details</Text>
      <Text dimColor>─────────────────────────────────────────────────────────────</Text>
      <Box flexDirection="column" marginY={1}>
        {columns.map(column => {
          const value = row[column.name];
          const color = getColorForDataType(column.dataType, value);
          const formattedValue = value === null || value === undefined
            ? 'NULL'
            : typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value);

          return (
            <Box key={column.name} flexDirection="row">
              <Text bold color="cyan" dimColor>{column.name}: </Text>
              <Text color={color} dimColor={value === null || value === undefined}>
                {formattedValue}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Text dimColor>─────────────────────────────────────────────────────────────</Text>
      <Text dimColor>Esc/q/b: Close</Text>
    </Box>
  );
}

# Mirador: Migration Guide from Go to Node.js/TypeScript

## Executive Summary

This document provides a comprehensive guide for migrating the **Mirador** database explorer from Go to Node.js with TypeScript. The current application is a terminal-based UI (TUI) built with bubbletea, spanning ~6,300 lines of Go code across 31 files, supporting PostgreSQL, MySQL, and SQLite databases.

**Migration Objectives:**
- Preserve all functionality: database connectivity, query execution, data browsing, export capabilities
- Maintain the clean architecture: modular packages, clear separation of concerns
- Leverage TypeScript for type safety (equivalent to Go's static typing)
- Use Ink (React-based TUI framework) for component-driven UI development
- Optimize for Node.js event loop and async patterns

**Target Stack:**
- **Runtime:** Node.js 18+ with TypeScript 5+
- **TUI Framework:** Ink (React for CLIs)
- **State Management:** React Context + useReducer (Redux-like pattern)
- **Database Drivers:** pg (PostgreSQL), mysql2 (MySQL), better-sqlite3 (SQLite)
- **Build Tool:** esbuild or swc for fast TypeScript compilation
- **Package Manager:** npm or pnpm

---

## Table of Contents

1. [Architecture Comparison](#architecture-comparison)
2. [Technology Stack Mapping](#technology-stack-mapping)
3. [Package-by-Package Migration](#package-by-package-migration)
4. [State Management Strategy](#state-management-strategy)
5. [Database Layer Migration](#database-layer-migration)
6. [UI Components with Ink](#ui-components-with-ink)
7. [Performance Considerations](#performance-considerations)
8. [Project Structure](#project-structure)
9. [Dependencies & Configuration](#dependencies--configuration)
10. [Migration Roadmap](#migration-roadmap)
11. [Risk Assessment](#risk-assessment)

---

## Architecture Comparison

### Go (Current) vs Node.js/TypeScript (Target)

| Aspect | Go (bubbletea) | Node.js/TypeScript (Ink) |
|--------|----------------|--------------------------|
| **Paradigm** | Event-driven with Update/View pattern | React component model with hooks |
| **State** | Single immutable Model struct | React state (useState, useReducer, Context) |
| **Async** | tea.Cmd returns future messages | Promises/async-await with useEffect |
| **Type System** | Static typing with structs | TypeScript interfaces and types |
| **Components** | Functions returning strings | React functional components (JSX/TSX) |
| **Styling** | lipgloss inline styles | chalk/ink-gradient or inline styles |
| **Concurrency** | Goroutines + channels | Event loop + worker threads (if needed) |
| **Package Model** | Go modules (internal/) | NPM packages (src/) |

### Pattern Translation

**Go Pattern:**
```go
func Update(msg tea.Msg) (tea.Model, tea.Cmd)
func View() string
```

**React/Ink Pattern:**
```tsx
const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    // Async operations (equivalent to tea.Cmd)
  }, [dependencies]);

  return <Component />; // JSX replaces string building
}
```

---

## Technology Stack Mapping

### Core Dependencies

| Go Package | Node.js Equivalent | Purpose |
|------------|-------------------|---------|
| `bubbletea` | `ink` (^4.4.1) | TUI framework |
| `bubbles/list` | `ink-select-input` | Selectable lists |
| `bubbles/table` | `ink-table` | Data tables |
| `bubbles/textinput` | `ink-text-input` | Text input fields |
| `bubbles/textarea` | `ink-text-input` (multiline) | Multi-line text editing |
| `lipgloss` | `chalk` (^5.3.0) | Terminal styling |
| `lib/pq` | `pg` (^8.11.3) | PostgreSQL driver |
| `go-sql-driver/mysql` | `mysql2` (^3.6.5) | MySQL driver |
| `mattn/go-sqlite3` | `better-sqlite3` (^9.2.2) | SQLite driver |
| `atotto/clipboard` | `clipboardy` (^4.0.0) | Clipboard operations |

### Additional Node.js Dependencies

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "ink-select-input": "^5.0.0",
    "ink-table": "^3.1.0",
    "ink-text-input": "^5.0.1",
    "ink-spinner": "^5.0.0",
    "chalk": "^5.3.0",
    "pg": "^8.11.3",
    "mysql2": "^3.6.5",
    "better-sqlite3": "^9.2.2",
    "clipboardy": "^4.0.0",
    "date-fns": "^3.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/better-sqlite3": "^7.6.8",
    "@types/pg": "^8.10.9",
    "tsx": "^4.7.0",
    "esbuild": "^0.19.11",
    "vitest": "^1.1.0"
  }
}
```

---

## Package-by-Package Migration

### 1. `internal/config` → `src/config`

**Go Responsibilities:**
- Load/save connections from `~/.mirador/connections.json`
- Load/save query history from `~/.mirador/query_history.json`
- Handle file system errors gracefully

**Node.js/TypeScript Equivalent:**

```typescript
// src/config/storage.ts
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';

const configDir = join(homedir(), '.mirador');

// Zod schemas for validation
const SavedConnectionSchema = z.object({
  name: z.string(),
  driver: z.enum(['postgres', 'mysql', 'sqlite']),
  connectionStr: z.string(),
});

const QueryHistoryEntrySchema = z.object({
  query: z.string(),
  timestamp: z.string(),
  database: z.string(),
  success: z.boolean(),
  rowCount: z.number().optional(),
});

export type SavedConnection = z.infer<typeof SavedConnectionSchema>;
export type QueryHistoryEntry = z.infer<typeof QueryHistoryEntrySchema>;

export async function loadSavedConnections(): Promise<SavedConnection[]> {
  try {
    const data = await readFile(join(configDir, 'connections.json'), 'utf-8');
    return z.array(SavedConnectionSchema).parse(JSON.parse(data));
  } catch {
    return [];
  }
}

export async function saveConnections(connections: SavedConnection[]): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(
    join(configDir, 'connections.json'),
    JSON.stringify(connections, null, 2)
  );
}

// Similar for query history...
```

**Migration Notes:**
- Use `fs/promises` for async file I/O (non-blocking)
- Use Zod for runtime validation (type safety + validation)
- Keep JSON structure identical for compatibility

---

### 2. `internal/models` → `src/types`

**Go Responsibilities:**
- Define core types: Model, SavedConnection, QueryHistoryEntry, TableInfo
- Define enums: ViewState, DBType, SortDirection
- Define message types for async results

**Node.js/TypeScript Equivalent:**

```typescript
// src/types/state.ts
export enum ViewState {
  DBTypeView = 'DBTypeView',
  ConnectionView = 'ConnectionView',
  SavedConnectionsView = 'SavedConnectionsView',
  TablesView = 'TablesView',
  ColumnsView = 'ColumnsView',
  DataPreviewView = 'DataPreviewView',
  RowDetailView = 'RowDetailView',
  QueryView = 'QueryView',
  QueryHistoryView = 'QueryHistoryView',
  RelationshipsView = 'RelationshipsView',
  IndexesView = 'IndexesView',
}

export enum DBType {
  PostgreSQL = 'postgres',
  MySQL = 'mysql',
  SQLite = 'sqlite',
}

export enum SortDirection {
  Off = 'off',
  Asc = 'asc',
  Desc = 'desc',
}

export interface AppState {
  // View state
  currentView: ViewState;

  // Database connection
  db: DatabaseConnection | null;
  selectedDB: DBType | null;
  selectedSchema: string | null;
  selectedTable: string | null;

  // Data
  savedConnections: SavedConnection[];
  queryHistory: QueryHistoryEntry[];
  tables: TableInfo[];
  columns: ColumnInfo[];

  // Data preview
  dataPreviewAllRows: any[];
  dataPreviewAllColumns: string[];
  dataPreviewCurrentPage: number;
  dataPreviewItemsPerPage: number;
  dataPreviewSortColumn: number;
  dataPreviewSortDirection: SortDirection;
  dataPreviewFilterValue: string;

  // UI state
  isConnecting: boolean;
  isLoadingTables: boolean;
  isLoadingColumns: boolean;
  isExecutingQuery: boolean;
  statusMessage: string;
  errorMessage: string;

  // Form inputs
  connectionString: string;
  connectionName: string;
  queryText: string;
  searchText: string;
}

// Action types for reducer
export type Action =
  | { type: 'SET_VIEW'; view: ViewState }
  | { type: 'SET_DB_TYPE'; dbType: DBType }
  | { type: 'CONNECT_SUCCESS'; db: DatabaseConnection }
  | { type: 'LOAD_TABLES_SUCCESS'; tables: TableInfo[] }
  | { type: 'SET_LOADING'; key: string; value: boolean }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_INPUT'; field: string; value: string }
  // ... more actions
```

**Migration Notes:**
- TypeScript enums replace Go const blocks
- Interfaces replace structs
- Discriminated unions for Action types (type safety for reducers)
- Keep field names consistent with Go for easier migration

---

### 3. `internal/database` → `src/database`

**Go Responsibilities:**
- Multi-driver SQL generation
- Connection management
- Query execution (GetTables, GetColumns, GetIndexes, etc.)
- Result mapping

**Node.js/TypeScript Equivalent:**

```typescript
// src/database/connection.ts
import { Pool, PoolConfig } from 'pg';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import { DBType } from '../types/state';

export interface DatabaseConnection {
  type: DBType;
  execute<T = any>(sql: string, params?: any[]): Promise<T[]>;
  close(): Promise<void>;
}

class PostgreSQLConnection implements DatabaseConnection {
  type = DBType.PostgreSQL;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async execute<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Similar classes for MySQL and SQLite...

export async function createConnection(
  type: DBType,
  connectionString: string
): Promise<DatabaseConnection> {
  switch (type) {
    case DBType.PostgreSQL:
      return new PostgreSQLConnection(connectionString);
    case DBType.MySQL:
      return new MySQLConnection(connectionString);
    case DBType.SQLite:
      return new SQLiteConnection(connectionString);
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

// src/database/queries.ts
import { DatabaseConnection } from './connection';
import { DBType } from '../types/state';

export async function getTables(
  db: DatabaseConnection,
  schema?: string
): Promise<TableInfo[]> {
  let sql: string;
  let params: any[] = [];

  switch (db.type) {
    case DBType.PostgreSQL:
      sql = `
        SELECT
          schemaname as schema,
          tablename as name,
          'table' as type
        FROM pg_tables
        WHERE schemaname = $1
        UNION ALL
        SELECT
          schemaname as schema,
          viewname as name,
          'view' as type
        FROM pg_views
        WHERE schemaname = $1
        ORDER BY name
      `;
      params = [schema || 'public'];
      break;

    case DBType.MySQL:
      sql = `
        SELECT
          TABLE_NAME as name,
          TABLE_TYPE as type
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `;
      break;

    case DBType.SQLite:
      sql = `
        SELECT
          name,
          type
        FROM sqlite_master
        WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;
      break;
  }

  return await db.execute<TableInfo>(sql, params);
}

// Similar functions: getColumns, getIndexes, getRelationships, etc.
```

**Migration Notes:**
- Use connection pooling for PostgreSQL and MySQL (better performance)
- SQLite is synchronous but wrap in async interface for consistency
- Parameterized queries with driver-specific placeholders ($1 vs ?)
- Error handling with try/catch (async/await pattern)

---

### 4. `internal/styles` → `src/styles`

**Go Responsibilities:**
- Color palette definitions
- Reusable lipgloss styles
- Layout constants

**Node.js/TypeScript Equivalent:**

```typescript
// src/styles/theme.ts
import chalk from 'chalk';

export const colors = {
  primaryBlue: '#00b8db',
  accentBlue: '#29d3ea',
  successGreen: '#00ff00',
  errorRed: '#ff0000',
  warningOrange: '#ffa500',
  textPrimary: '#ffffff',
  textSecondary: '#888888',
  border: '#444444',
};

export const theme = {
  title: chalk.hex(colors.primaryBlue).bold,
  subtitle: chalk.hex(colors.accentBlue),
  success: chalk.hex(colors.successGreen),
  error: chalk.hex(colors.errorRed).bold,
  warning: chalk.hex(colors.warningOrange),
  muted: chalk.hex(colors.textSecondary),
  highlight: chalk.bgHex(colors.primaryBlue).white,
  border: chalk.hex(colors.border),
};

export const spacing = {
  padding: 1,
  margin: 1,
  cardPadding: 2,
};

// Helper functions
export const box = (content: string, title?: string) => {
  const lines = content.split('\n');
  const width = Math.max(...lines.map(l => l.length));
  const top = title
    ? `┌─ ${theme.title(title)} ${'─'.repeat(width - title.length - 1)}┐`
    : `┌${'─'.repeat(width + 2)}┐`;
  const bottom = `└${'─'.repeat(width + 2)}┘`;
  const body = lines.map(line => `│ ${line.padEnd(width)} │`).join('\n');
  return `${top}\n${body}\n${bottom}`;
};
```

**Migration Notes:**
- Chalk provides similar functionality to lipgloss
- Use chalk chainable API for complex styles
- Box drawing characters work identically in Node.js terminals
- Consider `ink-gradient` for gradient effects

---

### 5. `internal/state` → State Management with React

**Go Responsibilities:**
- View-specific update handlers
- State transition logic
- Async command triggering

**Node.js/TypeScript Equivalent:**

Instead of separate handler files, use React's useReducer pattern:

```typescript
// src/state/reducer.ts
import { AppState, Action } from '../types/state';

export const initialState: AppState = {
  currentView: ViewState.DBTypeView,
  db: null,
  selectedDB: null,
  // ... initialize all fields
};

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.view };

    case 'SET_DB_TYPE':
      return { ...state, selectedDB: action.dbType };

    case 'CONNECT_SUCCESS':
      return {
        ...state,
        db: action.db,
        isConnecting: false,
        currentView: ViewState.TablesView,
      };

    case 'LOAD_TABLES_SUCCESS':
      return {
        ...state,
        tables: action.tables,
        isLoadingTables: false,
      };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.message };

    // ... more cases

    default:
      return state;
  }
}

// src/state/context.tsx
import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { appReducer, initialState } from './reducer';
import { AppState, Action } from '../types/state';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
};
```

**Async Operations (equivalent to tea.Cmd):**

```typescript
// src/state/operations.ts
import { Dispatch } from 'react';
import { Action } from '../types/state';
import { createConnection } from '../database/connection';
import { getTables } from '../database/queries';

export async function connectToDatabase(
  dispatch: Dispatch<Action>,
  dbType: DBType,
  connectionString: string
) {
  dispatch({ type: 'SET_LOADING', key: 'isConnecting', value: true });

  try {
    const db = await createConnection(dbType, connectionString);
    dispatch({ type: 'CONNECT_SUCCESS', db });

    // Auto-load tables
    loadTables(dispatch, db);
  } catch (error) {
    dispatch({
      type: 'SET_ERROR',
      message: `Connection failed: ${error.message}`
    });
    dispatch({ type: 'SET_LOADING', key: 'isConnecting', value: false });
  }
}

export async function loadTables(
  dispatch: Dispatch<Action>,
  db: DatabaseConnection,
  schema?: string
) {
  dispatch({ type: 'SET_LOADING', key: 'isLoadingTables', value: true });

  try {
    const tables = await getTables(db, schema);
    dispatch({ type: 'LOAD_TABLES_SUCCESS', tables });
  } catch (error) {
    dispatch({ type: 'SET_ERROR', message: `Failed to load tables: ${error.message}` });
    dispatch({ type: 'SET_LOADING', key: 'isLoadingTables', value: false });
  }
}

// Similar async operations for columns, preview, queries, etc.
```

**Usage in Components:**

```typescript
// src/components/ConnectionView.tsx
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useAppState } from '../state/context';
import { connectToDatabase } from '../state/operations';

export const ConnectionView: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [connectionString, setConnectionString] = useState('');

  const handleSubmit = async () => {
    if (state.selectedDB && connectionString) {
      await connectToDatabase(dispatch, state.selectedDB, connectionString);
    }
  };

  return (
    <Box flexDirection="column">
      <Text>Enter connection string:</Text>
      <TextInput
        value={connectionString}
        onChange={setConnectionString}
        onSubmit={handleSubmit}
      />
      {state.isConnecting && <Text>Connecting...</Text>}
      {state.errorMessage && <Text color="red">{state.errorMessage}</Text>}
    </Box>
  );
};
```

**Migration Notes:**
- Replace tea.Cmd with async functions that dispatch actions
- Use useEffect for side effects (similar to Init/Update commands)
- Context provides global state (equivalent to passing Model around)
- Async operations are simpler in Node.js (native Promises)

---

### 6. `internal/utils` → `src/utils`

**Go Responsibilities:**
- Database helpers (result handlers, async loaders)
- UI helpers (table building, column width calculation)
- Type inference (numeric, date, boolean detection)
- Math utilities (min, max, pagination)

**Node.js/TypeScript Equivalent:**

```typescript
// src/utils/types.ts
export function isNumeric(value: any): boolean {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

export function isDateLike(value: any): boolean {
  if (value instanceof Date) return true;
  if (typeof value !== 'string') return false;

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,                    // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,  // ISO 8601
    /^\d{2}\/\d{2}\/\d{4}$/,                  // MM/DD/YYYY
  ];

  return datePatterns.some(pattern => pattern.test(value));
}

export function sanitizeValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// src/utils/table.ts
export function calculateColumnWidth(
  columnName: string,
  values: any[],
  maxWidth: number = 50
): number {
  const headerWidth = columnName.length;
  const maxValueWidth = Math.max(
    ...values.map(v => sanitizeValue(v).length)
  );
  return Math.min(Math.max(headerWidth, maxValueWidth) + 2, maxWidth);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// src/utils/pagination.ts
export function paginate<T>(
  items: T[],
  page: number,
  itemsPerPage: number
): T[] {
  const start = page * itemsPerPage;
  return items.slice(start, start + itemsPerPage);
}

export function getTotalPages(totalItems: number, itemsPerPage: number): number {
  return Math.ceil(totalItems / itemsPerPage);
}
```

**Migration Notes:**
- Pure functions translate directly
- Use TypeScript generics for type-safe utilities
- Date handling with native Date or date-fns library
- Keep utility functions small and focused

---

### 7. `internal/views` → `src/components`

**Go Responsibilities:**
- Render functions for each view
- ViewBuilder pattern for consistent layout
- Component helpers (status messages, help text, empty states)

**Node.js/TypeScript Equivalent:**

```typescript
// src/components/ViewBuilder.tsx
import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { theme, box } from '../styles/theme';

interface ViewBuilderProps {
  title: string;
  subtitle?: string;
  content: ReactNode;
  statusMessage?: string;
  statusType?: 'success' | 'error' | 'info';
  helpText?: string;
}

export const ViewBuilder: React.FC<ViewBuilderProps> = ({
  title,
  subtitle,
  content,
  statusMessage,
  statusType = 'info',
  helpText,
}) => {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Title */}
      <Text>{theme.title(title)}</Text>

      {/* Subtitle */}
      {subtitle && (
        <Box marginTop={1}>
          <Text>{theme.subtitle(subtitle)}</Text>
        </Box>
      )}

      {/* Main content */}
      <Box marginTop={1}>
        {content}
      </Box>

      {/* Status message */}
      {statusMessage && (
        <Box marginTop={1}>
          <Text color={statusType === 'error' ? 'red' : statusType === 'success' ? 'green' : 'blue'}>
            {statusMessage}
          </Text>
        </Box>
      )}

      {/* Help text */}
      {helpText && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
          <Text dimColor>{helpText}</Text>
        </Box>
      )}
    </Box>
  );
};

// src/components/DBTypeView.tsx
import React from 'react';
import SelectInput from 'ink-select-input';
import { useAppState } from '../state/context';
import { ViewBuilder } from './ViewBuilder';
import { DBType, ViewState } from '../types/state';

export const DBTypeView: React.FC = () => {
  const { dispatch } = useAppState();

  const items = [
    { label: 'PostgreSQL', value: DBType.PostgreSQL },
    { label: 'MySQL', value: DBType.MySQL },
    { label: 'SQLite', value: DBType.SQLite },
  ];

  const handleSelect = (item: typeof items[0]) => {
    dispatch({ type: 'SET_DB_TYPE', dbType: item.value });
    dispatch({ type: 'SET_VIEW', view: ViewState.ConnectionView });
  };

  return (
    <ViewBuilder
      title="DBX — Database Explorer v0.3.0"
      subtitle="Choose your database type"
      content={<SelectInput items={items} onSelect={handleSelect} />}
      helpText="↑/↓: Navigate | Enter: Select | s: Saved connections | q: Quit"
    />
  );
};

// src/components/TablesView.tsx
import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { useAppState } from '../state/context';
import { ViewBuilder } from './ViewBuilder';
import { loadDataPreview } from '../state/operations';

export const TablesView: React.FC = () => {
  const { state, dispatch } = useAppState();

  const items = state.tables.map(table => ({
    label: `${table.type === 'view' ? '👁️  ' : ''}${table.name} (${table.rowCount || 0} rows)`,
    value: table.name,
  }));

  const handleSelect = async (item: typeof items[0]) => {
    dispatch({ type: 'SET_SELECTED_TABLE', table: item.value });
    if (state.db) {
      await loadDataPreview(dispatch, state.db, item.value);
    }
  };

  return (
    <ViewBuilder
      title={`Tables — ${state.selectedDB || ''}`}
      subtitle={state.selectedSchema ? `Schema: ${state.selectedSchema}` : undefined}
      content={
        state.isLoadingTables ? (
          <Text>Loading tables...</Text>
        ) : items.length > 0 ? (
          <SelectInput items={items} onSelect={handleSelect} />
        ) : (
          <Text dimColor>No tables found</Text>
        )
      }
      helpText="↑/↓: Navigate | Enter: Select | p: Preview | v: Columns | f: Relationships | Esc: Back"
    />
  );
};
```

**Migration Notes:**
- Each Go view function becomes a React component
- Use Ink's built-in components (Box, Text) for layout
- ink-select-input replaces bubbles/list
- ink-table replaces bubbles/table
- Conditional rendering replaces string concatenation
- Props and hooks replace function parameters

---

## State Management Strategy

### Go's Update/View Pattern

```go
func Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    // Handle message, update model, return command
}

func View() string {
    // Render current state to string
}
```

### React/Ink Equivalent

**Key Differences:**
1. **State updates:** Immutable updates via `dispatch(action)`
2. **Side effects:** `useEffect` hook for async operations
3. **Rendering:** JSX components instead of string building
4. **Events:** Event handlers in JSX instead of KeyMsg matching

**Complete Example:**

```typescript
// src/App.tsx
import React, { useEffect } from 'react';
import { Box, useInput, useApp } from 'ink';
import { AppProvider, useAppState } from './state/context';
import { ViewState } from './types/state';

// Import all view components
import { DBTypeView } from './components/DBTypeView';
import { ConnectionView } from './components/ConnectionView';
import { TablesView } from './components/TablesView';
// ... more views

const AppContent: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { exit } = useApp();

  // Global key handlers
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }

    if (key.escape) {
      dispatch({ type: 'GO_BACK' });
    }

    if (input === '?') {
      dispatch({ type: 'TOGGLE_HELP' });
    }

    // ... more global shortcuts
  });

  // Auto-clear error messages after 5 seconds
  useEffect(() => {
    if (state.errorMessage) {
      const timeout = setTimeout(() => {
        dispatch({ type: 'CLEAR_ERROR' });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [state.errorMessage, dispatch]);

  // Render current view based on state
  const renderView = () => {
    switch (state.currentView) {
      case ViewState.DBTypeView:
        return <DBTypeView />;
      case ViewState.ConnectionView:
        return <ConnectionView />;
      case ViewState.TablesView:
        return <TablesView />;
      // ... more views
      default:
        return <Box><Text>Unknown view</Text></Box>;
    }
  };

  return renderView();
};

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
```

**Key Patterns:**

1. **Context + Reducer** = Global state management
2. **useInput hook** = Keyboard event handling (replaces KeyMsg)
3. **useEffect** = Side effects and async operations (replaces tea.Cmd)
4. **Conditional rendering** = View switching (replaces switch on ViewState)

---

## Database Layer Migration

### Connection Pooling

Unlike Go's `sql.DB` which manages pooling automatically, Node.js requires explicit pool configuration:

```typescript
// src/database/pool.ts
import { Pool } from 'pg';
import mysql from 'mysql2/promise';

export interface PoolConfig {
  max?: number;           // Maximum connections (default: 10)
  idleTimeoutMillis?: number;  // Idle timeout (default: 30000)
  connectionTimeoutMillis?: number;  // Connection timeout (default: 10000)
}

export function createPostgresPool(connectionString: string, config?: PoolConfig) {
  return new Pool({
    connectionString,
    max: config?.max || 10,
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 10000,
  });
}

export function createMySQLPool(connectionString: string, config?: PoolConfig) {
  return mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: config?.max || 10,
    queueLimit: 0,
  });
}
```

### Query Parameter Handling

Different drivers use different placeholder styles:

```typescript
// src/database/parameterize.ts
import { DBType } from '../types/state';

export function parameterize(sql: string, dbType: DBType, params: any[]): { sql: string; params: any[] } {
  switch (dbType) {
    case DBType.PostgreSQL:
      // Already uses $1, $2, etc.
      return { sql, params };

    case DBType.MySQL:
    case DBType.SQLite:
      // Convert $1, $2 to ?
      let index = 0;
      const convertedSQL = sql.replace(/\$\d+/g, () => {
        index++;
        return '?';
      });
      return { sql: convertedSQL, params };

    default:
      return { sql, params };
  }
}
```

### Transaction Support

```typescript
// src/database/transaction.ts
import { DatabaseConnection } from './connection';

export async function withTransaction<T>(
  db: DatabaseConnection,
  callback: (db: DatabaseConnection) => Promise<T>
): Promise<T> {
  await db.execute('BEGIN');
  try {
    const result = await callback(db);
    await db.execute('COMMIT');
    return result;
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

// Usage:
await withTransaction(db, async (tx) => {
  await tx.execute('UPDATE users SET balance = balance - 100 WHERE id = ?', [userId]);
  await tx.execute('INSERT INTO transactions (user_id, amount) VALUES (?, ?)', [userId, -100]);
});
```

### Error Handling

```typescript
// src/database/errors.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function handleDatabaseError(error: any): DatabaseError {
  // PostgreSQL errors
  if (error.code) {
    switch (error.code) {
      case '28P01':
        return new DatabaseError('Authentication failed', error.code);
      case '3D000':
        return new DatabaseError('Database does not exist', error.code);
      case '42P01':
        return new DatabaseError('Table does not exist', error.code);
      default:
        return new DatabaseError(error.message, error.code, error.detail);
    }
  }

  // MySQL errors
  if (error.errno) {
    switch (error.errno) {
      case 1045:
        return new DatabaseError('Access denied', String(error.errno));
      case 1049:
        return new DatabaseError('Unknown database', String(error.errno));
      default:
        return new DatabaseError(error.message, String(error.errno));
    }
  }

  return new DatabaseError(error.message || 'Unknown database error');
}
```

---

## UI Components with Ink

### Tables with Sorting and Filtering

```typescript
// src/components/DataTable.tsx
import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { SortDirection } from '../types/state';
import { theme } from '../styles/theme';

interface Column {
  key: string;
  label: string;
  width?: number;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  sortColumn?: string;
  sortDirection?: SortDirection;
  onSort?: (column: string) => void;
  filterValue?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  sortColumn,
  sortDirection,
  onSort,
  filterValue,
}) => {
  const [selectedRow, setSelectedRow] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedRow(Math.max(0, selectedRow - 1));
    }
    if (key.downArrow) {
      setSelectedRow(Math.min(data.length - 1, selectedRow + 1));
    }
  });

  // Filter data
  const filteredData = useMemo(() => {
    if (!filterValue) return data;
    return data.filter(row =>
      Object.values(row).some(value =>
        String(value).toLowerCase().includes(filterValue.toLowerCase())
      )
    );
  }, [data, filterValue]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || sortDirection === SortDirection.Off) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === SortDirection.Asc ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Render header
  const renderHeader = () => (
    <Box>
      {columns.map((col, idx) => {
        const sortIndicator =
          sortColumn === col.key
            ? sortDirection === SortDirection.Asc ? ' ↑' : ' ↓'
            : '';
        return (
          <Box key={col.key} width={col.width || 20} marginRight={1}>
            <Text bold color="blue">
              {col.label}{sortIndicator}
            </Text>
          </Box>
        );
      })}
    </Box>
  );

  // Render rows
  const renderRows = () =>
    sortedData.map((row, rowIdx) => (
      <Box key={rowIdx} backgroundColor={rowIdx === selectedRow ? 'blue' : undefined}>
        {columns.map(col => (
          <Box key={col.key} width={col.width || 20} marginRight={1}>
            <Text>{String(row[col.key] || '')}</Text>
          </Box>
        ))}
      </Box>
    ));

  return (
    <Box flexDirection="column">
      {renderHeader()}
      <Box marginTop={1} flexDirection="column">
        {renderRows()}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Showing {sortedData.length} of {data.length} rows
          {filterValue && ` (filtered by "${filterValue}")`}
        </Text>
      </Box>
    </Box>
  );
};
```

### Pagination Component

```typescript
// src/components/Pagination.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  useInput((input, key) => {
    if (key.leftArrow && currentPage > 0) {
      onPageChange(currentPage - 1);
    }
    if (key.rightArrow && currentPage < totalPages - 1) {
      onPageChange(currentPage + 1);
    }
  });

  return (
    <Box marginTop={1}>
      <Text>
        Page {currentPage + 1} of {totalPages}
        {' '}
        <Text dimColor>
          (← → to navigate)
        </Text>
      </Text>
    </Box>
  );
};
```

### Input with Validation

```typescript
// src/components/ValidatedInput.tsx
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ValidatedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  validate?: (value: string) => string | null;  // Returns error message or null
  placeholder?: string;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  label,
  value,
  onChange,
  onSubmit,
  validate,
  placeholder,
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (validate) {
      setError(validate(newValue));
    }
  };

  const handleSubmit = () => {
    if (validate) {
      const validationError = validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    onSubmit?.();
  };

  return (
    <Box flexDirection="column">
      <Text>{label}</Text>
      <TextInput
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
};
```

---

## Performance Considerations

### 1. Event Loop Optimization

**Challenge:** Node.js is single-threaded; blocking operations freeze the UI.

**Solutions:**
- Use async/await for all I/O operations
- Offload CPU-intensive tasks to worker threads
- Stream large result sets instead of loading all in memory

```typescript
// src/database/streaming.ts
import { DatabaseConnection } from './connection';

export async function* streamTableData(
  db: DatabaseConnection,
  table: string,
  batchSize: number = 1000
): AsyncGenerator<any[]> {
  let offset = 0;

  while (true) {
    const batch = await db.execute(
      `SELECT * FROM ${table} LIMIT ${batchSize} OFFSET ${offset}`
    );

    if (batch.length === 0) break;

    yield batch;
    offset += batchSize;
  }
}

// Usage in component:
const loadDataInBatches = async () => {
  for await (const batch of streamTableData(db, tableName)) {
    dispatch({ type: 'APPEND_DATA', data: batch });
    // UI updates incrementally
  }
};
```

### 2. Memory Management

**Challenge:** Large datasets can cause memory issues.

**Solutions:**
- Implement virtual scrolling for large tables
- Paginate data fetching
- Clear unused data from state

```typescript
// src/hooks/useVirtualScroll.ts
import { useState, useMemo } from 'react';

export function useVirtualScroll<T>(
  items: T[],
  visibleRows: number = 20
) {
  const [scrollOffset, setScrollOffset] = useState(0);

  const visibleItems = useMemo(() => {
    return items.slice(scrollOffset, scrollOffset + visibleRows);
  }, [items, scrollOffset, visibleRows]);

  const scrollDown = () => {
    setScrollOffset(Math.min(items.length - visibleRows, scrollOffset + 1));
  };

  const scrollUp = () => {
    setScrollOffset(Math.max(0, scrollOffset - 1));
  };

  return { visibleItems, scrollUp, scrollDown, scrollOffset };
}
```

### 3. Query Caching

**Challenge:** Repeated queries slow down the app.

**Solutions:**
- Implement LRU cache for query results
- Cache metadata (tables, columns, schemas)

```typescript
// src/utils/cache.ts
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

export const queryCache = new LRUCache<string, any[]>(50);

// Usage:
export async function getCachedTables(
  db: DatabaseConnection,
  schema?: string
): Promise<TableInfo[]> {
  const cacheKey = `tables:${db.type}:${schema || 'default'}`;

  const cached = queryCache.get(cacheKey);
  if (cached) return cached;

  const tables = await getTables(db, schema);
  queryCache.set(cacheKey, tables);
  return tables;
}
```

### 4. Debouncing User Input

**Challenge:** Search/filter on every keystroke is expensive.

**Solutions:**
- Debounce input handlers
- Use controlled debouncing for filters

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in filter component:
const FilterInput: React.FC = () => {
  const [filterInput, setFilterInput] = useState('');
  const debouncedFilter = useDebounce(filterInput, 500);
  const { dispatch } = useAppState();

  useEffect(() => {
    dispatch({ type: 'SET_FILTER', value: debouncedFilter });
  }, [debouncedFilter, dispatch]);

  return <TextInput value={filterInput} onChange={setFilterInput} />;
};
```

### 5. Connection Pooling Best Practices

```typescript
// Optimize pool size based on use case
const poolConfig = {
  // For read-heavy workloads:
  max: 20,

  // For write-heavy workloads:
  max: 5,

  // Aggressive timeout for CLI (user expects quick feedback):
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
};
```

---

## Project Structure

```
mirador-nodejs/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
├── src/
│   ├── index.tsx                    # Entry point (renders App)
│   ├── cli.ts                       # CLI argument parsing
│   ├── App.tsx                      # Main app component
│   │
│   ├── components/                  # UI components (views)
│   │   ├── ViewBuilder.tsx          # Shared layout component
│   │   ├── DBTypeView.tsx
│   │   ├── ConnectionView.tsx
│   │   ├── SavedConnectionsView.tsx
│   │   ├── TablesView.tsx
│   │   ├── ColumnsView.tsx
│   │   ├── DataPreviewView.tsx
│   │   ├── RowDetailView.tsx
│   │   ├── QueryView.tsx
│   │   ├── QueryHistoryView.tsx
│   │   ├── RelationshipsView.tsx
│   │   ├── IndexesView.tsx
│   │   ├── DataTable.tsx            # Reusable table component
│   │   ├── Pagination.tsx
│   │   ├── ValidatedInput.tsx
│   │   └── HelpText.tsx
│   │
│   ├── state/                       # State management
│   │   ├── context.tsx              # React context provider
│   │   ├── reducer.ts               # Main reducer
│   │   ├── operations.ts            # Async operations (like tea.Cmd)
│   │   └── actions.ts               # Action type definitions
│   │
│   ├── database/                    # Database layer
│   │   ├── connection.ts            # Connection abstraction
│   │   ├── pool.ts                  # Connection pooling
│   │   ├── queries.ts               # Query functions
│   │   ├── operations.ts            # CRUD operations
│   │   ├── errors.ts                # Error handling
│   │   ├── validation.ts            # Connection string validation
│   │   └── adapters/                # Driver-specific logic
│   │       ├── postgres.ts
│   │       ├── mysql.ts
│   │       └── sqlite.ts
│   │
│   ├── config/                      # Configuration & persistence
│   │   ├── storage.ts               # File I/O for connections/history
│   │   └── paths.ts                 # Config directory paths
│   │
│   ├── types/                       # TypeScript types
│   │   ├── state.ts                 # App state & actions
│   │   ├── database.ts              # Database-related types
│   │   └── index.ts                 # Re-exports
│   │
│   ├── utils/                       # Utility functions
│   │   ├── types.ts                 # Type inference helpers
│   │   ├── table.ts                 # Table formatting
│   │   ├── pagination.ts            # Pagination helpers
│   │   ├── cache.ts                 # LRU cache implementation
│   │   └── validation.ts            # Input validation
│   │
│   ├── styles/                      # Theming & styling
│   │   └── theme.ts                 # Color palette & styles
│   │
│   └── hooks/                       # Custom React hooks
│       ├── useDebounce.ts
│       ├── useVirtualScroll.ts
│       └── useKeyboardShortcuts.ts
│
├── tests/                           # Test files
│   ├── unit/
│   │   ├── utils/
│   │   ├── database/
│   │   └── state/
│   └── integration/
│       └── database/
│
└── dist/                            # Compiled output (gitignored)
```

---

## Dependencies & Configuration

### package.json

```json
{
  "name": "mirador",
  "version": "0.3.0",
  "description": "Terminal-based database explorer for PostgreSQL, MySQL, and SQLite",
  "main": "dist/index.js",
  "type": "module",
  "bin": {
    "mirador": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.tsx",
    "build": "esbuild src/index.tsx --bundle --platform=node --target=node18 --outfile=dist/index.js --format=esm --minify",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit"
  },
  "keywords": ["database", "tui", "cli", "postgresql", "mysql", "sqlite"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "ink-select-input": "^5.0.0",
    "ink-table": "^3.1.0",
    "ink-text-input": "^5.0.1",
    "ink-spinner": "^5.0.0",
    "ink-gradient": "^3.0.0",
    "chalk": "^5.3.0",
    "pg": "^8.11.3",
    "mysql2": "^3.6.5",
    "better-sqlite3": "^9.2.2",
    "clipboardy": "^4.0.0",
    "date-fns": "^3.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/better-sqlite3": "^7.6.8",
    "@types/pg": "^8.10.9",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "esbuild": "^0.19.11",
    "vitest": "^1.1.0",
    "@vitest/coverage-v8": "^1.1.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/parser": "^6.17.0",
    "@typescript-eslint/eslint-plugin": "^6.17.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Entry Point (src/index.tsx)

```typescript
#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './App.js';

// Render the app
render(<App />);
```

Make executable:
```bash
chmod +x dist/index.js
```

---

## Migration Roadmap

### Phase 1: Foundation (Week 1-2)

**Goals:** Set up project structure, basic TypeScript types, and database connections

**Tasks:**
- [x] Initialize Node.js project with TypeScript <!-- completed -->
- [x] Set up project structure (src/, components/, database/, etc.) <!-- completed -->
- [x] Install core dependencies (Ink, React, database drivers) <!-- completed -->
- [x] Create TypeScript types for state, database, and views <!-- completed -->
- [x] Implement database connection abstraction (src/database/connection.ts) <!-- completed -->
- [x] Implement basic PostgreSQL, MySQL, SQLite adapters <!-- completed -->
- [x] Write unit tests for database layer <!-- completed -->

**Deliverables:**
- Working TypeScript build
- Database connection layer with multi-driver support
- Type definitions for all core entities

---

### Phase 2: State Management (Week 2-3)

**Goals:** Implement React Context + reducer for global state

**Tasks:**
- [x] Create state reducer with all action types <!-- completed -->
- [x] Implement React Context provider <!-- completed -->
- [x] Create async operation functions (equivalent to tea.Cmd) <!-- completed -->
- [x] Implement state persistence (connections.json, query_history.json) <!-- completed -->
- [x] Add error handling and loading states <!-- completed -->
- [x] Write unit tests for reducer <!-- completed -->

**Deliverables:**
- Working state management system
- Async operations for database queries
- Persistent storage for connections and history

---

### Phase 3: Core UI Components (Week 3-5)

**Goals:** Build all view components with Ink

**Tasks:**
- [x] Create ViewBuilder component for consistent layout
- [x] Implement DBTypeView (database selection) <!-- completed -->
- [x] Implement ConnectionView (connection string input) <!-- completed -->
- [x] Implement SavedConnectionsView (manage saved connections) <!-- completed -->
- [x] Implement TablesView (list tables and views) <!-- completed -->
- [x] Implement ColumnsView (show table columns) <!-- completed -->
- [ ] Add keyboard shortcuts and navigation *(basic shortcuts added; expand coverage)*
- [ ] Style components with chalk

**Deliverables:**
- All basic views working
- Navigation between views
- Keyboard shortcuts

---

### Phase 4: Data Preview & Querying (Week 5-7)

**Goals:** Implement data browsing, filtering, sorting, and query execution

**Tasks:**
1. Implement DataPreviewView with pagination
2. Add sorting functionality (column headers)
3. Add filtering across all columns
4. Implement horizontal scrolling for wide tables
5. Implement RowDetailView (individual row inspection)
6. Implement QueryView (SQL query editor)
7. Implement QueryHistoryView
8. Add CSV/JSON export functionality

**Deliverables:**
- Full data browsing capabilities
- Query execution with history
- Export features

---

### Phase 5: Advanced Features (Week 7-8)

**Goals:** Add metadata views and field editing

**Tasks:**
1. Implement RelationshipsView (foreign keys)
2. Implement IndexesView (indexes and constraints)
3. Add field editing in RowDetailView
4. Add clipboard integration
5. Optimize performance (caching, virtual scrolling)
6. Add comprehensive help text

**Deliverables:**
- Complete feature parity with Go version
- Performance optimizations
- Full help documentation

---

### Phase 6: Testing & Polish (Week 8-9)

**Goals:** Comprehensive testing and bug fixes

**Tasks:**
1. Write integration tests for all views
2. Test with real PostgreSQL, MySQL, SQLite databases
3. Fix bugs and edge cases
4. Optimize bundle size
5. Add error recovery mechanisms
6. Performance profiling and optimization

**Deliverables:**
- >80% test coverage
- Stable, bug-free application
- Optimized performance

---

### Phase 7: Documentation & Release (Week 9-10)

**Goals:** Documentation and deployment

**Tasks:**
1. Write comprehensive README.md
2. Add inline code documentation
3. Create migration guide for users
4. Set up CI/CD pipeline
5. Create release builds for multiple platforms
6. Publish to npm (optional)

**Deliverables:**
- Complete documentation
- Release-ready builds
- npm package (optional)

---

## Risk Assessment

### High-Risk Areas

#### 1. **SQLite Synchronous API**

**Risk:** better-sqlite3 is synchronous, could block event loop

**Mitigation:**
- Wrap SQLite operations in worker threads for large queries
- Use async wrappers: `util.promisify` or custom async abstraction
- Consider alternative: `sql.js` (async but WASM-based)

```typescript
// src/database/adapters/sqlite.ts
import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';

// Run in worker thread for heavy queries
if (parentPort) {
  const db = new Database(workerData.path);
  parentPort.on('message', ({ sql, params }) => {
    const result = db.prepare(sql).all(params);
    parentPort.postMessage(result);
  });
}
```

#### 2. **Memory Usage with Large Datasets**

**Risk:** Loading entire result sets into memory (Node.js has lower memory limits than Go)

**Mitigation:**
- Implement streaming for large queries
- Use pagination aggressively (smaller page sizes)
- Implement virtual scrolling (only render visible rows)
- Monitor memory usage with `process.memoryUsage()`

```typescript
// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
    console.warn('High memory usage detected');
    // Trigger garbage collection or clear caches
  }
}, 10000);
```

#### 3. **Ink Re-rendering Performance**

**Risk:** Frequent re-renders slow down UI (React reconciliation overhead)

**Mitigation:**
- Use React.memo for expensive components
- Optimize useEffect dependencies
- Batch state updates with useReducer
- Use useMemo for expensive computations

```typescript
// Memoized component
export const DataPreviewView = React.memo(() => {
  const { state } = useAppState();

  const visibleData = useMemo(() => {
    return paginate(
      filter(state.dataPreviewAllRows, state.filterValue),
      state.currentPage,
      state.itemsPerPage
    );
  }, [state.dataPreviewAllRows, state.filterValue, state.currentPage]);

  return <DataTable data={visibleData} />;
});
```

#### 4. **TypeScript Type Safety with Dynamic SQL**

**Risk:** Losing type safety when building SQL dynamically

**Mitigation:**
- Use template literal types for SQL builders
- Consider query builders (Kysely, Drizzle) for type-safe SQL
- Runtime validation with Zod schemas

```typescript
// Type-safe query builder
type TableName = 'users' | 'orders' | 'products';
type ColumnName<T extends TableName> =
  T extends 'users' ? 'id' | 'name' | 'email' :
  T extends 'orders' ? 'id' | 'user_id' | 'total' :
  'id' | 'name' | 'price';

function selectFrom<T extends TableName>(
  table: T,
  columns: ColumnName<T>[]
): string {
  return `SELECT ${columns.join(', ')} FROM ${table}`;
}

// Type-safe usage
const sql = selectFrom('users', ['id', 'name']); // ✓
const bad = selectFrom('users', ['total']); // ✗ Type error
```

### Medium-Risk Areas

#### 5. **Cross-Platform Terminal Compatibility**

**Risk:** Ink rendering issues on Windows (ANSI escape codes)

**Mitigation:**
- Test on Windows, macOS, Linux
- Use Ink's built-in cross-platform support
- Fallback to simple rendering if needed
- Document minimum terminal requirements

#### 6. **Database Driver Compatibility**

**Risk:** Driver-specific bugs or missing features

**Mitigation:**
- Extensive testing with real databases
- Version lock dependencies initially
- Implement feature detection (e.g., check if database supports CTEs)
- Graceful degradation for unsupported features

### Low-Risk Areas

#### 7. **Configuration File Corruption**

**Risk:** JSON files get corrupted, app won't start

**Mitigation:**
- Validate JSON with Zod before parsing
- Create backups before writing
- Gracefully handle missing/corrupt config (reset to defaults)

```typescript
export async function loadSavedConnections(): Promise<SavedConnection[]> {
  try {
    const data = await readFile(connectionsPath, 'utf-8');
    return z.array(SavedConnectionSchema).parse(JSON.parse(data));
  } catch (error) {
    console.warn('Failed to load connections, using defaults');
    return [];
  }
}
```

---

## Summary & Recommendations

### Key Advantages of Node.js Migration

1. **Ecosystem:** Massive npm ecosystem for utilities
2. **Developer Experience:** Familiar to web developers, hot reload with tsx
3. **Component Model:** React's component model is more intuitive than string building
4. **Async:** Native async/await is cleaner than Go channels for I/O-bound tasks
5. **TypeScript:** Strong typing similar to Go, with better IDE support

### Key Challenges

1. **Performance:** Single-threaded event loop requires careful optimization
2. **Memory:** Lower memory limits than Go (need aggressive pagination)
3. **SQLite:** Synchronous API requires workarounds
4. **Testing:** More complex due to async nature and React components

### Recommended Approach

1. **Start with Phase 1-2** (foundation + state management) to validate approach
2. **Build incrementally** - get each view working before moving to next
3. **Test frequently** with real databases to catch driver issues early
4. **Optimize later** - get it working first, then optimize performance
5. **Keep Go version** running during migration for comparison

### Expected Outcomes

- **Bundle Size:** ~5-10MB (including all dependencies)
- **Startup Time:** <500ms (comparable to Go)
- **Memory Usage:** 50-150MB for typical usage (Go: 20-50MB)
- **Development Time:** 8-10 weeks for full migration
- **Lines of Code:** ~7,000-8,000 (similar to Go, but more verbose due to JSX)

---

## Next Steps

1. **Review this document** with your team
2. **Set up initial project** structure (Phase 1)
3. **Spike on database layer** to validate approach
4. **Choose state management** strategy (Context + reducer vs Redux)
5. **Build proof of concept** with one complete flow (DB selection → connection → table list)
6. **Evaluate** performance and developer experience
7. **Decide** whether to proceed with full migration

---

## Additional Resources

### Learning Resources
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [React Hooks Guide](https://react.dev/reference/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [PostgreSQL Node.js Guide](https://node-postgres.com/)

### Reference Projects
- [Prisma CLI](https://github.com/prisma/prisma) - Complex TUI with Ink
- [Backstage CLI](https://github.com/backstage/backstage) - CLI with good patterns
- [Hasura Console](https://github.com/hasura/graphql-engine) - Database TUI reference

### Tools
- [tsx](https://github.com/esbuild-kit/tsx) - Fast TypeScript runner
- [vitest](https://vitest.dev/) - Fast unit testing
- [esbuild](https://esbuild.github.io/) - Fast bundler

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Author:** Claude Code Migration Assistant

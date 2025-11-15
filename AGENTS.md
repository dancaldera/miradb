# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mirador** is a terminal-based database explorer application rewritten from Go to Node.js/TypeScript. It provides a text-based user interface (TUI) for exploring and querying PostgreSQL, MySQL, and SQLite databases using Ink (React for CLIs).

## Development Commands

```bash
# Development
bun dev              # Start development server with hot-reload using tsx
bun run build            # Build production bundle with esbuild
bun start            # Run built application
bun test             # Run tests with Bun test runner
bun test:coverage    # Run tests with coverage
bun lint             # Run Biome linter checks
bun format           # Format code with Biome
bun type-check       # Run TypeScript type checking
```

## Release & Versioning

- Follow semantic versioning when updating `package.json`: increment the patch version for fixes and internal improvements, the minor version for backward-compatible features, and the major version for breaking changes.
- Always bump the version before committing user-facing changes or adjustments that impact delivered functionality.

## Architecture Overview

### Technology Stack

- **Runtime**: Node.js 18+ with ES Modules
- **Language**: TypeScript 5.3+ with strict typing
- **UI Framework**: Ink (React for terminal applications)
- **State Management**: React Context + useReducer with Immer for immutability
- **Database Drivers**: `pg` (PostgreSQL), `mysql2` (MySQL), `bun:sqlite` (SQLite)
- **Build Tool**: esbuild for fast compilation
- **Testing**: Vitest for unit testing
- **Validation**: Zod for runtime type validation

### Project Structure

```
src/
├── index.tsx              # Main entry point (CLI executable)
├── App.tsx                # Main React application component
├── components/            # UI components (views)
│   ├── DBTypeView.tsx     # Database type selection
│   ├── ConnectionView.tsx # Database connection input
│   ├── TablesView.tsx     # Database tables listing
│   ├── ColumnsView.tsx    # Table schema view
│   ├── DataPreviewView.tsx # Table data browser
│   └── SavedConnectionsView.tsx # Manage saved connections
├── database/             # Database abstraction layer
│   ├── types.ts          # Database interfaces
│   ├── connection.ts     # Connection management
│   ├── postgres.ts       # PostgreSQL driver
│   ├── mysql.ts          # MySQL driver
│   ├── sqlite.ts         # SQLite driver
│   └── pool.ts           # Connection pooling
├── state/                # Application state management
│   ├── context.tsx       # React Context providers
│   ├── reducer.ts        # Immer-based state reducer
│   ├── actions.ts        # Action types and creators
│   ├── effects.ts        # Side effects (async operations)
│   └── cache.ts          # Table data caching
├── types/                # TypeScript type definitions
│   └── state.ts          # Application state types
└── utils/                # Utility functions
    └── persistence.ts    # Local data persistence
```

### State Management Architecture

The application uses a **Redux-like pattern** with React Context + useReducer:

- **AppContext**: Global state provider using React Context
- **useReducer**: Manages state transitions with Immer for immutable updates
- **Effects**: Async operations (equivalent to tea.Cmd in the original Go version)
- **Actions**: Type-safe action creators for state mutations

Key state patterns:

- **ViewState enum**: Defines all application views (DBType, Connection, Tables, etc.)
- **ConnectionInfo**: Database connection metadata with local storage persistence
- **TableInfo**: Table schema information with caching
- **Notifications**: Auto-dismissing user notifications with 4-second timeout

### Database Layer Architecture

**Abstract Interface Pattern** with driver-specific implementations:

- **DatabaseConnection interface**: Common API across all database types
- **Driver adapters**: PostgreSQL, MySQL, and SQLite specific implementations
- **Connection pooling**: Optimized for performance with configurable pools
- **Query parameterization**: Handles different placeholder styles ($1 vs ?)
- **Error handling**: Consistent error types across drivers

### UI Component Architecture

**React-based Terminal UI** using Ink components:

- **View-based navigation**: State-driven view switching
- **Component composition**: Reusable UI components with consistent patterns
- **Keyboard navigation**: Global shortcuts (Esc to go home, ? for help)
- **Status management**: Loading states, error messages, and notifications

## Key Implementation Details

### ES Modules Configuration

- Project uses ES module syntax (`import`/`export`)
- TypeScript configured with `"module": "ESNext"` and `"moduleResolution": "bundler"`
- Entry point uses shebang `#!/usr/bin/env node` for direct execution

### Database Connection Management

- Connections are stored in `~/.mirador/connections.json`
- Query history persisted in `~/.mirador/query_history.json`
- Connection pooling implemented for PostgreSQL and MySQL
- SQLite uses Bun's built-in `bun:sqlite` driver with async wrapper

### State Persistence

- Saved connections and query history persisted to local filesystem
- Uses Zod schemas for runtime validation of loaded data
- Graceful fallback to empty state for corrupted/missing config

### Error Handling Patterns

- Database errors wrapped in consistent error types
- User notifications with levels (info, warning, error)
- Auto-dismissing notifications with 4-second timeout
- Global error state displayed in UI

### Performance Considerations

- Table data caching with pagination for large datasets
- Connection pooling to minimize connection overhead
- Debounced input handling for search/filter operations
- Memoized React components to prevent unnecessary re-renders

## Development Guidelines

### Code Organization

- **Strict TypeScript**: All code must pass strict type checking
- **ESLint**: TypeScript-focused linting with recommended rules
- **Component structure**: Clear separation of state, UI, and data layers
- **Error boundaries**: Consistent error handling with user feedback

### State Management Patterns

- Use `useAppState()` hook to access global state
- Dispatch actions through `useAppDispatch()` hook
- Async operations should be handled in `effects.ts`
- State updates must be immutable (handled by Immer)

### Database Operations

- Always use parameterized queries to prevent SQL injection
- Handle connection errors gracefully with user feedback
- Implement proper connection cleanup on component unmount
- Use connection pooling for better performance

### UI Development

- Follow Ink component patterns (Box, Text, etc.)
- Implement proper keyboard navigation
- Use chalk for terminal styling
- Test UI components with different terminal sizes

### Testing

- Unit tests for database operations and state management
- Integration tests for complete user flows
- Mock database drivers for reliable testing
- Coverage target: >80%

## AI Agent Integration

Mirador includes comprehensive AI agent support for programmatic database interaction. AI assistants can use multiple interfaces to interact with databases safely and efficiently.

**Important**: If asked to run a command of mirador, first use `mirador -h` and `mirador --agent-help` to gain context about available options and usage.

### Agent Interfaces

#### 1. Programmatic Agent API (`src/agent-api.ts`)

**Primary Interface for AI Agents:**

```typescript
import { createAgent } from "mirador/agent-api";

const agent = createAgent();

// Safe connection with automatic guardrails
await agent.connect({
  type: "postgresql",
  host: "localhost",
  database: "mydb",
  user: "myuser",
  password: "mypassword"
});

// Safe queries with automatic LIMIT warnings
const result = await agent.query("SELECT * FROM users LIMIT 10");
console.log(`Found ${result.rowCount} users`);

// Safe user sampling (max 50 users)
const users = await agent.getUsersSample(10);

// Safe table browsing (max 1000 rows)
const data = await agent.getTableData("users", {
  limit: 100,
  where: "active = true",
  orderBy: "created_at DESC"
});

await agent.disconnect();
```

#### 2. API Mode (Interactive JSON Protocol)

**For interactive AI agent control:**

```bash
mirador --api
```

**JSON Commands via stdin:**
```json
{"type": "connect", "payload": {"type": "postgresql", "connectionString": "postgresql://user:pass@host/db"}}
{"type": "query", "payload": {"sql": "SELECT * FROM users LIMIT 5"}}
{"type": "get_schema"}
{"type": "exit"}
```

#### 3. Headless Mode (Direct CLI Execution)

**For one-off operations:**

```bash
# Safe execution with automatic limits
mirador --headless --db-type postgresql --connect "postgresql://user:pass@host/db" --query "SELECT * FROM users LIMIT 10" --output json
```

### Safety Guardrails

Mirador includes automatic safety measures to prevent data exhaustion:

- **Query Limits**: Warns about queries without LIMIT clauses
- **Result Size Warnings**: Alerts when queries return >1000 rows
- **Dangerous Operations**: Warns about DROP, DELETE, TRUNCATE, UPDATE without WHERE
- **Safe Methods**: `getUsersSample()` and `getTableData()` have automatic limits
- **Override Options**: `{ skipLimitWarning: true }` for intentional large queries

### Database Support

- **PostgreSQL**: Full support with connection pooling
- **MySQL**: Full support with connection pooling
- **SQLite**: Full support with Bun's native driver

### TypeScript Integration

**Complete type safety for AI agents:**

```typescript
import type {
  MiradorAgentInterface,
  AgentDatabaseConfig,
  AgentQueryResult,
  AgentSchemaInfo,
  AgentQueryOptions
} from "mirador/types/agent";
```

### Usage Guidelines for AI Agents

1. **Always use LIMIT clauses** in SELECT queries
2. **Use safe methods** like `getUsersSample()` for exploration
3. **Check warnings** before executing potentially expensive queries
4. **Close connections** after use
5. **Handle errors** appropriately
6. **Use parameterized queries** when possible to prevent SQL injection

### Available Methods

- `connect(config)` - Connect to database
- `disconnect()` - Close connection
- `query(sql, options?)` - Execute SQL with safety guardrails
- `getSchema()` - Get database schema information
- `getTableData(tableName, options)` - Safe table browsing
- `getUsersSample(limit?)` - Safe user sampling
- `transaction(queries)` - Execute multiple queries as transaction
- `isConnected()` - Check connection status

### Error Handling

All methods throw descriptive errors for:
- Connection failures
- Invalid queries
- Permission issues
- Network timeouts

```typescript
try {
  await agent.connect(config);
  const result = await agent.query("SELECT * FROM users LIMIT 10");
} catch (error) {
  console.error("Database operation failed:", error.message);
}
```



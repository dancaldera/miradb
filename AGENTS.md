# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mirador** is a terminal-based database explorer application rewritten from Go to Node.js/TypeScript. It provides a text-based user interface (TUI) for exploring and querying PostgreSQL, MySQL, and SQLite databases using Ink (React for CLIs).

## Development Commands

```bash
# Development
bun run dev          # Start development server with hot-reload using tsx
bun run build        # Build production bundle with esbuild
bun run start        # Run built application
bun run test         # Run tests with Vitest
bun run test:coverage # Run tests with coverage
bun run lint         # Run Biome linter checks
bun run format       # Format code with Biome
bun run type-check   # Run TypeScript type checking
```

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

## Migration Context

This is a **migration from Go to Node.js/TypeScript**. The original Go version used:

- **bubbletea** for TUI → **Ink** (React for CLIs)
- **Update/View pattern** → **React hooks + state management**
- **Goroutines/channels** → **async/await with Promises**
- **sql.DB** → **Driver-specific connection pooling**

The migration preserves all functionality while leveraging the Node.js ecosystem and React's component model for better developer experience.

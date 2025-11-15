import { parseArgs } from "node:util";

export interface CliArgs {
	/** Run in API mode for programmatic control */
	api?: boolean;
	/** Database type (postgresql, mysql, sqlite) */
	dbType?: string;
	/** Connection string or file path for SQLite */
	connect?: string;
	/** SQL query to execute */
	query?: string;
	/** Output format (json, table) */
	output?: "json" | "table";
	/** Run in headless mode (no TUI) */
	headless?: boolean;
	/** Show help */
	help?: boolean;
	/** Show AI agent instructions */
	agentHelp?: boolean;
	/** Host for database connection */
	host?: string;
	/** Port for database connection */
	port?: number;
	/** Database name */
	database?: string;
	/** Username for database connection */
	user?: string;
	/** Password for database connection */
	password?: string;
}

export const parseCliArgs = (): CliArgs => {
	try {
		const { values } = parseArgs({
			args: process.argv.slice(2),
			options: {
				api: { type: "boolean", short: "a" },
				"db-type": { type: "string" },
				connect: { type: "string", short: "c" },
				query: { type: "string", short: "q" },
				output: { type: "string", default: "table" },
				headless: { type: "boolean", short: "h" },
				help: { type: "boolean" },
				"agent-help": { type: "boolean" },
				host: { type: "string" },
				port: { type: "string" },
				database: { type: "string", short: "d" },
				user: { type: "string", short: "u" },
				password: { type: "string", short: "p" },
			},
			allowPositionals: false,
		});

		return {
			api: values.api as boolean,
			dbType: values["db-type"] as string,
			connect: values.connect as string,
			query: values.query as string,
			output: (values.output as "json" | "table") || "table",
			headless: values.headless as boolean,
			help: values.help as boolean,
			agentHelp: values["agent-help"] as boolean,
			host: values.host as string,
			port: values.port ? parseInt(values.port as string, 10) : undefined,
			database: values.database as string,
			user: values.user as string,
			password: values.password as string,
		};
	} catch (error) {
		console.error("Error parsing command line arguments:", error);
		return { help: true };
	}
};

export const showHelp = () => {
	console.log(`
Mirador - Terminal Database Explorer

USAGE:
  mirador [OPTIONS]

MODES:
  --api, -a                    Run in API mode for programmatic control
  --headless, -h               Run in headless mode (no TUI)

CONNECTION OPTIONS:
  --db-type <type>             Database type: postgresql, mysql, sqlite
  --connect, -c <string>       Connection string or SQLite file path
  --host <host>                Database host
  --port <port>                Database port
  --database, -d <name>        Database name
  --user, -u <username>        Database username
  --password, -p <password>    Database password

QUERY OPTIONS:
  --query, -q <sql>            SQL query to execute
  --output <format>            Output format: json, table (default: table)

OTHER:
  --help                       Show this help message
  --agent-help                 Show AI agent instructions (if you're an agent READ THIS)

EXAMPLES:
  # Interactive mode (default)
  mirador

  # Connect to PostgreSQL and run a query
  mirador --db-type postgresql --host localhost --database mydb --user myuser --query "SELECT * FROM users"

  # Connect to SQLite file
  mirador --db-type sqlite --connect /path/to/db.sqlite --query "SELECT * FROM table1"

  # API mode for programmatic control
  mirador --api

  # Headless mode with JSON output
  mirador --headless --db-type postgresql --connect "postgresql://user:pass@host/db" --query "SELECT * FROM users" --output json
`);
};

export const showAgentHelp = () => {
	console.log(`
# Mirador Agent API

This document explains how AI agents can programmatically interact with Mirador, the terminal-based database explorer.

## Overview

Mirador now supports multiple modes of operation designed for AI agents and automation:

1. **Agent API** - Programmatic TypeScript/JavaScript interface
2. **API Mode** - JSON-based stdin/stdout protocol
3. **Headless Mode** - Command-line execution with JSON output
4. **Export Functions** - Data and schema export utilities

## Quick Start

### Using the Agent API

\`\`\`typescript
import { createAgent } from "mirador/agent-api";

const agent = createAgent();

await agent.connect({
  type: "postgresql",
  host: "localhost",
  database: "mydb",
  user: "myuser",
  password: "mypassword"
});

const result = await agent.query("SELECT * FROM users LIMIT 10");
console.log(\`Found \${result.rowCount} users\`);
console.log(result.rows);

await agent.disconnect();
\`\`\`

### API Mode

Run Mirador in API mode for interactive JSON-based control:

\`\`\`bash
mirador --api
\`\`\`

Then send commands via stdin:

\`\`\`json
{"type": "connect", "payload": {"type": "postgresql", "connectionString": "postgresql://user:pass@host/db"}}
{"type": "query", "payload": {"sql": "SELECT * FROM users"}}
{"type": "exit"}
\`\`\`

### Headless Mode

Execute queries directly from command line:

\`\`\`bash
mirador --headless --db-type postgresql --connect "postgresql://user:pass@host/db" --query "SELECT * FROM users" --output json
\`\`\`

## Agent API Reference

### Connection

\`\`\`typescript
interface DatabaseConfig {
  type: "postgresql" | "mysql" | "sqlite";
  connectionString?: string;  // Full connection string
  host?: string;             // Individual parameters
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

await agent.connect(config);
await agent.disconnect();
agent.isConnected(); // boolean
\`\`\`

### Query Execution

\`\`\`typescript
// Simple query
const result = await agent.query("SELECT * FROM users");

// Transaction
const results = await agent.transaction([
  "INSERT INTO users (name) VALUES ('John')",
  "UPDATE stats SET count = count + 1"
]);
\`\`\`

### Schema Introspection

\`\`\`typescript
const schema = await agent.getSchema();
// Returns: { tables: TableInfo[], columns: Record<string, ColumnInfo[]> }
\`\`\`

### Table Data Access

\`\`\`typescript
const data = await agent.getTableData("users", {
  limit: 100,
  offset: 0,
  where: "active = true",
  orderBy: "created_at DESC"
});
\`\`\`

## API Mode Protocol

API mode accepts JSON commands via stdin and returns JSON responses via stdout.

### Commands

#### Connect
\`\`\`json
{
  "type": "connect",
  "payload": {
    "type": "postgresql",
    "host": "localhost",
    "database": "mydb",
    "user": "myuser",
    "password": "mypassword"
  }
}
\`\`\`

#### Query
\`\`\`json
{
  "type": "query",
  "payload": {
    "sql": "SELECT * FROM users WHERE active = true"
  }
}
\`\`\`

#### Get Schema
\`\`\`json
{
  "type": "get_schema"
}
\`\`\`

#### Get State
\`\`\`json
{
  "type": "get_state"
}
\`\`\`

#### Dispatch Action
\`\`\`json
{
  "type": "dispatch",
  "payload": {
    "type": "SetView",
    "view": "TABLES"
  }
}
\`\`\`

#### Exit
\`\`\`json
{
  "type": "exit"
}
\`\`\`

### Responses

All responses follow this format:

\`\`\`json
{
  "success": true,
  "data": { /* result data */ },
  "error": "error message (if failed)",
  "requestId": "optional request tracking ID"
}
\`\`\`

## Headless Mode

Execute one-off operations without the TUI:

\`\`\`bash
# PostgreSQL query
mirador --headless --db-type postgresql --host localhost --database mydb --user myuser --password mypass --query "SELECT * FROM users" --output json

# SQLite query
mirador --headless --db-type sqlite --connect /path/to/db.sqlite --query "SELECT * FROM table1" --output json

# Connection string
mirador --headless --db-type postgresql --connect "postgresql://user:pass@host/db" --query "SELECT 1" --output json
\`\`\`

## Export Functions

### JSON Export

\`\`\`typescript
import { exportToJsonString, exportSchema } from "mirador/utils/export";

// Export query results to JSON string
const jsonString = exportToJsonString(result.rows, columns, true);

// Export schema to file
const filepath = await exportSchema(tables, columns);
\`\`\`

### Streaming Export

For large datasets:

\`\`\`typescript
import { streamToJson } from "mirador/utils/export";

for await (const chunk of streamToJson(largeDataset, columns)) {
  process.stdout.write(chunk);
}
\`\`\`

## Error Handling

All functions throw errors for connection issues, invalid queries, etc.

\`\`\`typescript
try {
  await agent.connect(config);
  const result = await agent.query(sql);
} catch (error) {
  console.error("Operation failed:", error.message);
}
\`\`\`

## TypeScript Support

Full TypeScript definitions are available:

\`\`\`typescript
import type {
  MiradorAgentInterface,
  AgentDatabaseConfig,
  AgentQueryResult,
  AgentSchemaInfo
} from "mirador/types/agent";
\`\`\`

## Examples

See \`examples/agent-usage.ts\` for comprehensive examples of all functionality.

## Safety Guardrails & Best Practices

Mirador includes automatic safety measures to prevent data exhaustion and protect against dangerous operations.

### Automatic Safety Warnings

#### Query Limits Protection
\`\`\`typescript
// ⚠️ This will show a warning:
await agent.query("SELECT * FROM users");
// Warning: Query may return unlimited results. Consider adding LIMIT clause.

// ✅ This is safe:
await agent.query("SELECT * FROM users LIMIT 100");
\`\`\`

#### Dangerous Operations Detection
\`\`\`typescript
// ⚠️ This will show a warning:
await agent.query("DELETE FROM users");
// Warning: This appears to be a potentially destructive operation.

// ✅ Always include WHERE clauses:
await agent.query("DELETE FROM users WHERE inactive = true");
\`\`\`

#### Large Result Set Warnings
\`\`\`typescript
// Automatic warning if query returns >1000 rows
const result = await agent.query("SELECT * FROM large_table LIMIT 2000");
// Warning: Query returned 2000 rows. This may impact performance.
\`\`\`

### Safe Methods for Common Operations

#### User Data Access (Recommended)
\`\`\`typescript
// ✅ Safe sampling - automatically limited to 50 users max
const users = await agent.getUsersSample(10); // Gets 10 users safely

// ✅ Safe table browsing - automatically limited to 1000 rows max
const data = await agent.getTableData("users", {
  limit: 100,
  where: "active = true",
  orderBy: "created_at DESC"
});
\`\`\`

#### Schema Exploration (Safe)
\`\`\`typescript
// ✅ Safe schema introspection
const schema = await agent.getSchema();
console.log(\`Database has \${schema.tables.length} tables\`);
\`\`\`

### Best Practices

#### 1. Always Use LIMIT Clauses
\`\`\`typescript
// ❌ Avoid
await agent.query("SELECT * FROM users");

// ✅ Do
await agent.query("SELECT * FROM users LIMIT 100");
\`\`\`

#### 2. Use Safe Methods for Exploration
\`\`\`typescript
// ❌ Avoid large queries during exploration
await agent.query("SELECT * FROM users WHERE last_login > '2024-01-01'");

// ✅ Use safe methods
const recentUsers = await agent.getTableData("users", {
  where: "last_login > '2024-01-01'",
  limit: 50
});
\`\`\`

#### 3. Handle Errors Properly
\`\`\`typescript
try {
  await agent.connect(config);
  const result = await agent.query("SELECT * FROM users LIMIT 10");
  console.log(\`Found \${result.rowCount} users\`);
} catch (error) {
  console.error("Database operation failed:", error.message);
  // Handle specific error types
  if (error.message.includes("connection")) {
    // Retry logic
  }
} finally {
  await agent.disconnect();
}
\`\`\`

#### 4. Use Parameterized Queries
\`\`\`typescript
// PostgreSQL
const users = await agent.query("SELECT * FROM users WHERE role = $1 AND active = $2", ["admin", true]);

// SQLite
const users = await agent.query("SELECT * FROM users WHERE role = ? AND active = ?", ["admin", true]);
\`\`\`

#### 5. Skip Warnings When Appropriate
\`\`\`typescript
// For intentional large queries
const allUsers = await agent.query("SELECT id, name FROM users ORDER BY name", {
  skipLimitWarning: true // Override the LIMIT warning
});
\`\`\`

### Performance Considerations

#### Choose the Right Interface
\`\`\`typescript
// 🐌 API Mode - Interactive, good for exploration
// Use when: Building interactive tools, debugging, manual operations

// ⚡ Headless Mode - Direct execution, good for automation
// Use when: CI/CD, scripts, one-off operations

// 🚀 Programmatic API - Full control, best performance
// Use when: Complex applications, batch operations, custom logic
\`\`\`

#### Connection Management
\`\`\`typescript
// ✅ Reuse connections for multiple operations
const agent = createAgent();
await agent.connect(config);

// Perform multiple operations
const users = await agent.query("SELECT * FROM users LIMIT 10");
const products = await agent.query("SELECT * FROM products LIMIT 10");

await agent.disconnect();

// ❌ Don't create new connections for each query
\`\`\`

#### Batch Operations
\`\`\`typescript
// ✅ Use transactions for related operations
await agent.transaction([
  "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')",
  "INSERT INTO user_profiles (user_id, bio) VALUES (LASTVAL(), 'Hello world')"
]);
\`\`\`

### Error Handling Patterns

#### Connection Errors
\`\`\`typescript
try {
  await agent.connect(config);
} catch (error) {
  if (error.message.includes("ECONNREFUSED")) {
    console.error("Database server is not running");
  } else if (error.message.includes("authentication")) {
    console.error("Invalid credentials");
  }
}
\`\`\`

#### Query Errors
\`\`\`typescript
try {
  const result = await agent.query("SELECT * FROM nonexistent_table");
} catch (error) {
  if (error.message.includes("does not exist")) {
    console.error("Table not found");
  } else {
    console.error("Query failed:", error.message);
  }
}
\`\`\`

## Security Notes

- Never log or expose database passwords
- Use parameterized queries when possible
- Validate all inputs to prevent SQL injection
- Close connections when done
- Be aware of automatic safety warnings for destructive operations
`);
};

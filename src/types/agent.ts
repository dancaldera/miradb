import type { DBType } from "../types/state.js";

/**
 * Core interfaces for AI agent integration with Mirador
 */

// Database connection configuration
export interface AgentDatabaseConfig {
	/** Database type */
	type: DBType;
	/** Full connection string (optional if using individual parameters) */
	connectionString?: string;
	/** Database host */
	host?: string;
	/** Database port */
	port?: number;
	/** Database name */
	database?: string;
	/** Username */
	user?: string;
	/** Password */
	password?: string;
}

// Query execution result
export interface AgentQueryResult {
	/** Query result rows */
	rows: Record<string, any>[];
	/** Number of rows returned */
	rowCount: number;
	/** Column information (if available) */
	columns?: Array<{
		name: string;
		type: string;
	}>;
	/** Query execution time in milliseconds */
	duration: number;
}

// Database schema information
export interface AgentSchemaInfo {
	/** List of tables/views */
	tables: Array<{
		name: string;
		schema?: string;
		type: "table" | "view" | "materialized-view";
	}>;
	/** Column information keyed by table name */
	columns: Record<
		string,
		Array<{
			name: string;
			dataType: string;
			nullable: boolean;
			isPrimaryKey?: boolean;
			isForeignKey?: boolean;
			defaultValue?: string;
		}>
	>;
}

// Table data query options
export interface AgentTableQueryOptions {
	/** Maximum number of rows to return */
	limit?: number;
	/** Number of rows to skip */
	offset?: number;
	/** WHERE clause (without the WHERE keyword) */
	where?: string;
	/** ORDER BY clause (without the ORDER BY keyword) */
	orderBy?: string;
	/** Columns to select (defaults to *) */
	columns?: string[];
}

// API command for programmatic control
export interface AgentApiCommand {
	/** Command type */
	type:
		| "connect"
		| "disconnect"
		| "query"
		| "get_schema"
		| "get_table_data"
		| "transaction"
		| "get_status";
	/** Command payload */
	payload?: any;
	/** Request ID for tracking responses */
	requestId?: string;
}

// API response
export interface AgentApiResponse {
	/** Whether the command succeeded */
	success: boolean;
	/** Response data */
	data?: any;
	/** Error message if failed */
	error?: string;
	/** Request ID for tracking */
	requestId?: string;
}

// Agent capabilities and status
export interface AgentCapabilities {
	/** Supported database types */
	supportedDatabases: DBType[];
	/** Supported output formats */
	supportedFormats: string[];
	/** Whether transactions are supported */
	transactions: boolean;
	/** Whether schema introspection is supported */
	schemaIntrospection: boolean;
}

// Agent status
export interface AgentStatus {
	/** Whether connected to a database */
	connected: boolean;
	/** Current database configuration (without sensitive data) */
	config?: {
		type: DBType;
		host?: string;
		port?: number;
		database?: string;
		user?: string;
	};
	/** Connection timestamp */
	connectedAt?: string;
	/** Last activity timestamp */
	lastActivity?: string;
}

/**
 * Query options for safety guardrails
 */
export interface AgentQueryOptions {
	/** Skip the LIMIT warning for queries that intentionally return many results */
	skipLimitWarning?: boolean;
}

/**
 * Main agent interface that AI systems can implement
 */
export interface MiradorAgentInterface {
	/**
	 * Connect to a database
	 */
	connect(config: AgentDatabaseConfig): Promise<void>;

	/**
	 * Disconnect from the database
	 */
	disconnect(): Promise<void>;

	/**
	 * Execute a SQL query with safety guardrails
	 */
	query(sql: string, options?: AgentQueryOptions): Promise<AgentQueryResult>;

	/**
	 * Get database schema information
	 */
	getSchema(): Promise<AgentSchemaInfo>;

	/**
	 * Safely get a sample of users (limited to prevent exhaustion)
	 */
	getUsersSample(limit?: number): Promise<AgentQueryResult>;

	/**
	 * Get table data with optional filtering
	 */
	getTableData(
		tableName: string,
		options?: AgentTableQueryOptions,
	): Promise<AgentQueryResult>;

	/**
	 * Execute multiple queries in a transaction
	 */
	transaction(queries: string[]): Promise<AgentQueryResult[]>;

	/**
	 * Get agent capabilities
	 */
	getCapabilities(): AgentCapabilities;

	/**
	 * Get current status
	 */
	getStatus(): AgentStatus;

	/**
	 * Check if connected
	 */
	isConnected(): boolean;
}

/**
 * Event types that agents can listen to
 */
export type AgentEventType =
	| "connected"
	| "disconnected"
	| "query_executed"
	| "error"
	| "status_changed";

export interface AgentEvent {
	type: AgentEventType;
	timestamp: string;
	data?: any;
}

/**
 * Event listener for agent events
 */
export type AgentEventListener = (event: AgentEvent) => void;

/**
 * Extended agent interface with event support
 */
export interface MiradorAgentInterfaceExtended extends MiradorAgentInterface {
	/**
	 * Add event listener
	 */
	addEventListener(listener: AgentEventListener): void;

	/**
	 * Remove event listener
	 */
	removeEventListener(listener: AgentEventListener): void;

	/**
	 * Get table data with safety limits
	 */
	getTableData(
		tableName: string,
		options?: {
			limit?: number;
			offset?: number;
			where?: string;
			orderBy?: string;
		},
	): Promise<AgentQueryResult>;
}

/**
 * Factory function type for creating agents
 */
export type AgentFactory = () => MiradorAgentInterface;

/**
 * Configuration for agent initialization
 */
export interface AgentConfig {
	/** Agent implementation to use */
	factory?: AgentFactory;
	/** Auto-connect on initialization */
	autoConnect?: boolean;
	/** Connection config for auto-connect */
	connectionConfig?: AgentDatabaseConfig;
	/** Enable event logging */
	enableLogging?: boolean;
}

/**
 * Utility types for working with agent results
 */
export type AgentResult<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: string;
	  };

export type OptionalAgentResult<T> = AgentResult<T | null>;

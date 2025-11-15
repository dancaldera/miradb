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

import { render } from "ink";
import React from "react";
import { createDatabaseConnection } from "./database/connection.js";
import { ActionType } from "./state/actions.js";
import { AppProvider, useAppDispatch, useAppState } from "./state/context.js";
import { initializeApp } from "./state/effects.js";
import { type DBType, ViewState } from "./types/state.js";
import type { CliArgs } from "./utils/cli-args.js";

const HeadlessApp: React.FC<{ args: CliArgs }> = ({ args }) => {
	const dispatch = useAppDispatch();
	const state = useAppState();
	const [initialized, setInitialized] = React.useState(false);
	const [result, setResult] = React.useState<any>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		const run = async () => {
			try {
				await initializeApp(dispatch);
				setInitialized(true);

				// Handle connection
				if (args.connect && args.dbType) {
					const connection = createDatabaseConnection({
						type: args.dbType as DBType,
						connectionString: args.connect,
					});
					await connection.connect();
					dispatch({
						type: ActionType.SetActiveConnection,
						connection: {
							id: "headless-connection",
							name: "Headless Connection",
							type: args.dbType as DBType,
							connectionString: args.connect,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
					});
					dispatch({
						type: ActionType.SetDBType,
						dbType: args.dbType as DBType,
					});
				}

				// Handle query
				if (args.query && state.activeConnection) {
					const connection = createDatabaseConnection({
						type: state.activeConnection.type,
						connectionString: state.activeConnection.connectionString,
					});
					await connection.connect();
					const queryResult = await connection.query(args.query);
					setResult(queryResult);
				} else if (args.query && !state.activeConnection) {
					setError("No database connection available for query");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		};

		void run();
	}, [dispatch, args, state.activeConnection]);

	React.useEffect(() => {
		if (initialized && (result !== null || error !== null)) {
			// Output result and exit
			if (error) {
				console.error("Error:", error);
				process.exit(1);
			} else if (result !== null) {
				if (args.output === "json") {
					console.log(JSON.stringify(result, null, 2));
				} else {
					// Simple table output
					console.table(result);
				}
				process.exit(0);
			}
		}
	}, [initialized, result, error, args.output]);

	return null; // No UI in headless mode
};

export const runHeadlessMode = async (args: CliArgs): Promise<void> => {
	// Render the app context without UI
	const instance = render(
		<AppProvider>
			<HeadlessApp args={args} />
		</AppProvider>,
	);

	// Wait for the app to complete
	return new Promise((resolve) => {
		const checkInterval = setInterval(() => {
			// The component will call process.exit when done
			if (instance) {
				clearInterval(checkInterval);
				resolve();
			}
		}, 100);
	});
};

import type React from "react";
import { useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useAppDispatch, useAppState } from "../state/context.js";
import { fetchColumns, fetchTables } from "../state/effects.js";
import { ActionType } from "../state/actions.js";
import { ViewState } from "../types/state.js";
import type { TableInfo } from "../types/state.js";

const buildLabel = (table: TableInfo) => {
	const schema = table.schema ? `${table.schema}.` : "";
	return `${schema}${table.name}`;
};

export const TablesView: React.FC = () => {
	const dispatch = useAppDispatch();
	const state = useAppState();

	useInput((input, key) => {
		if (input === "q" && state.activeConnection) {
			dispatch({ type: ActionType.SetView, view: ViewState.Query });
		}
		if (input === "h" && (state.queryHistory?.length ?? 0) > 0) {
			dispatch({ type: ActionType.SetView, view: ViewState.QueryHistory });
		}
		if (input === "s") {
			dispatch({ type: ActionType.SetView, view: ViewState.SavedConnections });
		}
	});

	useEffect(() => {
		if (!state.activeConnection || !state.dbType) {
			dispatch({ type: ActionType.SetView, view: ViewState.Connection });
			return;
		}

		if (state.tables.length === 0 && !state.loading) {
			void fetchTables(dispatch, {
				type: state.dbType,
				connectionString: state.activeConnection.connectionString,
			});
		}
	}, [
		dispatch,
		state.activeConnection,
		state.dbType,
		state.tables.length,
		state.loading,
	]);

	const items = useMemo(() => {
		return state.tables.map((table) => ({
			label: buildLabel(table),
			value: `${table.schema ?? "default"}:${table.name}`,
			table,
		}));
	}, [state.tables]);

	const handleSelect = (table: TableInfo) => {
		dispatch({ type: ActionType.SetSelectedTable, table });
		const nextState = {
			...state,
			selectedTable: table,
		};
		if (state.activeConnection && state.dbType) {
			void fetchColumns(
				dispatch,
				nextState,
				{
					type: state.dbType,
					connectionString: state.activeConnection.connectionString,
				},
				table,
			);
		}
		dispatch({ type: ActionType.SetView, view: ViewState.Columns });
		dispatch({
			type: ActionType.SetInfo,
			message: `Selected table ${buildLabel(table)}`,
		});
	};

	if (!state.activeConnection) {
		return (
			<Box>
				<Text color="red">No active connection. Press Esc to go back.</Text>
			</Box>
		);
	}

	if (state.tables.length === 0 && state.loading) {
		return (
			<Box>
				<Text dimColor>Loading tables…</Text>
			</Box>
		);
	}

	if (state.tables.length === 0) {
		return (
			<Box flexDirection="column">
				<Text>No tables found.</Text>
				<Text dimColor>
					Check permissions or schema filters once implemented.
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text>
				Connected to <Text color="cyan">{state.activeConnection.name}</Text>
			</Text>
			<Text>Select a table to preview data:</Text>
			<Box marginTop={1}>
				<SelectInput
					items={items}
					onSelect={(item) => {
						const found = items.find((entry) => entry.value === item.value);
						if (found) {
							handleSelect(found.table);
						}
					}}
				/>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>
					Enter: Open column details | q: SQL Query | h: Query History | s:
					Saved Connections | Esc: Back
				</Text>
			</Box>
		</Box>
	);
};

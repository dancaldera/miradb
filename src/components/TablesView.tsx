import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { fetchColumns, fetchTables } from "../state/effects.js";
import type { TableInfo } from "../types/state.js";
import { ViewState } from "../types/state.js";
import {
	getSelectionBackground,
	getSelectionIndicator,
	getSelectionTextColor,
	isSelectionBold,
	isSelectionDimmed,
} from "../utils/selection-theme.js";

const buildLabel = (table: TableInfo) => {
	const schema = table.schema ? `${table.schema}.` : "";
	return `${schema}${table.name}`;
};

export const TablesView: React.FC = () => {
	const dispatch = useAppDispatch();
	const state = useAppState();
	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput((input, key) => {
		// Shortcuts
		if (input === "q" && state.activeConnection) {
			dispatch({ type: ActionType.SetView, view: ViewState.Query });
			return;
		}
		if (input === "h" && (state.queryHistory?.length ?? 0) > 0) {
			dispatch({ type: ActionType.SetView, view: ViewState.QueryHistory });
			return;
		}

		// Navigation
		if (key.upArrow && state.tables.length > 0) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
			return;
		}
		if (key.downArrow && state.tables.length > 0) {
			setSelectedIndex((prev) => Math.min(state.tables.length - 1, prev + 1));
			return;
		}

		// Selection
		if (key.return && state.tables.length > 0) {
			handleSelect(state.tables[selectedIndex]);
			return;
		}

		// Exit
		if (key.escape) {
			dispatch({ type: ActionType.ClearActiveConnection });
			dispatch({ type: ActionType.SetView, view: ViewState.Connection });
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

	// Reset selection when tables change
	useEffect(() => {
		if (selectedIndex >= state.tables.length && state.tables.length > 0) {
			setSelectedIndex(state.tables.length - 1);
		}
	}, [state.tables.length, selectedIndex]);

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

	const getTableIcon = (type: TableInfo["type"]) => {
		switch (type) {
			case "view":
				return "👁️  ";
			case "materialized-view":
				return "📊 ";
			case "table":
			default:
				return "📋 ";
		}
	};

	return (
		<Box flexDirection="column">
			<Text>
				Connected to <Text color="cyan">{state.activeConnection.name}</Text>
			</Text>
			<Text>Select a table to preview data:</Text>
			<Box marginTop={1} flexDirection="column">
				{state.tables.map((table, index) => {
					const isSelected = index === selectedIndex;
					const indicator = getSelectionIndicator(isSelected);
					const textColor = getSelectionTextColor(isSelected);
					const bold = isSelectionBold(isSelected);
					const dimColor = isSelectionDimmed(isSelected);
					const backgroundColor = getSelectionBackground(isSelected);
					const label = buildLabel(table);

					return (
						<Box key={label}>
							<Text color={indicator.color} backgroundColor={backgroundColor}>
								{indicator.symbol}{" "}
							</Text>
							<Text backgroundColor={backgroundColor}>
								{getTableIcon(table.type)}
							</Text>
							<Text
								color={textColor}
								bold={bold}
								dimColor={dimColor}
								backgroundColor={backgroundColor}
							>
								{label}
							</Text>
						</Box>
					);
				})}
			</Box>
			<Box marginTop={1}>
				<Text dimColor>
					Enter: Open column details | q: SQL Query | h: Query History | Esc:
					Disconnect
				</Text>
			</Box>
		</Box>
	);
};

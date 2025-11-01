import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { fetchColumns } from "../state/effects.js";
import { ViewState } from "../types/state.js";
import { ViewBuilder } from "./ViewBuilder.js";

export const ColumnsView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const table = state.selectedTable;

	useEffect(() => {
		if (!table || !state.activeConnection || !state.dbType) {
			dispatch({ type: ActionType.SetView, view: ViewState.Tables });
			return;
		}

		if (state.columns.length === 0) {
			void fetchColumns(
				dispatch,
				state,
				{
					type: state.dbType,
					connectionString: state.activeConnection.connectionString,
				},
				table,
			);
		}
	}, [dispatch, state, table]);

	useInput((input, key) => {
		if (key.escape) {
			dispatch({ type: ActionType.SetView, view: ViewState.Tables });
			return;
		}

		if (key.return || input === "o") {
			dispatch({ type: ActionType.SetView, view: ViewState.DataPreview });
		}

		if (input === "r") {
			dispatch({ type: ActionType.SetView, view: ViewState.Relationships });
		}

		if (input === "i") {
			dispatch({ type: ActionType.SetView, view: ViewState.Indexes });
		}

		if (input === "q") {
			dispatch({ type: ActionType.SetView, view: ViewState.Query });
		}
	});

	if (!table) {
		return (
			<ViewBuilder title="Columns" footer="Esc back">
				<Text dimColor>No table selected.</Text>
			</ViewBuilder>
		);
	}

	return (
		<ViewBuilder
			title={`Columns • ${table.schema ? `${table.schema}.` : ""}${table.name}`}
			subtitle={state.loading ? "Loading columns…" : undefined}
			footer="Enter/o: Data preview | r: Relationships | i: Indexes | q: Query • Esc back"
		>
			{state.columns.length === 0 && !state.loading ? (
				<Text dimColor>No column metadata available.</Text>
			) : (
				state.columns.map((column) => (
					<Box key={column.name}>
						<Text color={column.isPrimaryKey ? "yellow" : undefined}>
							{column.name} ({column.dataType})
							{column.nullable ? "" : " NOT NULL"}
							{column.isPrimaryKey ? " [PK]" : ""}
							{column.isForeignKey &&
							column.foreignTable &&
							column.foreignColumn
								? ` [FK → ${column.foreignTable}.${column.foreignColumn}]`
								: ""}
						</Text>
					</Box>
				))
			)}
		</ViewBuilder>
	);
};

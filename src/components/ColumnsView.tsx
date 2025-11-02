import { Box, Text, useInput, useStdout } from "ink";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { fetchColumns } from "../state/effects.js";
import { ViewState } from "../types/state.js";
import { ViewBuilder } from "./ViewBuilder.js";

export const ColumnsView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const table = state.selectedTable;
	const { stdout } = useStdout();
	const [terminalWidth, setTerminalWidth] = useState<number | undefined>(
		stdout?.columns,
	);

	useEffect(() => {
		if (!stdout) {
			return;
		}

		const handleResize = () => {
			setTerminalWidth(stdout.columns);
		};

		handleResize();
		stdout.on("resize", handleResize);
		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

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

		if (input === "s") {
			dispatch({ type: ActionType.SetView, view: ViewState.Search });
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
			footer="Enter/o: Data preview | r: Relationships | i: Indexes | q: Query | s: Search • Esc back"
		>
			{state.columns.length === 0 && !state.loading ? (
				<Text dimColor>No column metadata available.</Text>
			) : (
				<ColumnsGrid
					columns={state.columns.map((column) => ({
						name: column.name,
						dataType: column.dataType,
						nullable: column.nullable,
						isPrimaryKey: column.isPrimaryKey,
						isForeignKey: column.isForeignKey,
						foreignTable: column.foreignTable,
						foreignColumn: column.foreignColumn,
					}))}
					terminalWidth={terminalWidth}
				/>
			)}
		</ViewBuilder>
	);
};

interface ColumnInfoLite {
	name: string;
	dataType: string;
	nullable: boolean;
	isPrimaryKey?: boolean;
	isForeignKey?: boolean;
	foreignTable?: string | null;
	foreignColumn?: string | null;
}

interface ColumnsGridProps {
	columns: ColumnInfoLite[];
	terminalWidth?: number;
}

const ColumnsGrid: React.FC<ColumnsGridProps> = ({
	columns,
	terminalWidth,
}) => {
	const columnsPerRow = useMemo(() => {
		if (!terminalWidth) {
			return 2;
		}
		if (terminalWidth >= 150) return 4;
		if (terminalWidth >= 120) return 3;
		if (terminalWidth >= 90) return 2;
		return 1;
	}, [terminalWidth]);

	const gridRows = useMemo(() => {
		if (columnsPerRow <= 1) {
			return columns.map((column) => [column]);
		}

		const rows: ColumnInfoLite[][] = [];
		for (let index = 0; index < columns.length; index += columnsPerRow) {
			rows.push(columns.slice(index, index + columnsPerRow));
		}
		return rows;
	}, [columns, columnsPerRow]);

	return (
		<Box flexDirection="column">
			{gridRows.map((row, rowIndex) => (
				<Text key={`row-${rowIndex}`}>
					{row.map((column) => formatColumnSummary(column)).join("   ")}
				</Text>
			))}
		</Box>
	);
};

function formatColumnSummary(column: ColumnInfoLite): string {
	const parts: string[] = [`${column.name} (${column.dataType})`];
	if (!column.nullable) {
		parts.push("NOT NULL");
	}
	if (column.isPrimaryKey) {
		parts.push("[PK]");
	}
	if (column.isForeignKey && column.foreignTable && column.foreignColumn) {
		parts.push(`[FK → ${column.foreignTable}.${column.foreignColumn}]`);
	}
	return parts.join(" ");
}

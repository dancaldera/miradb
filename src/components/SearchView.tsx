import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { searchTableRows } from "../state/effects.js";
import type { DataRow } from "../types/state.js";
import { ViewState } from "../types/state.js";
import { ViewBuilder } from "./ViewBuilder.js";

const SEARCH_PAGE_SIZE = 25;
const MAX_VALUE_LENGTH = 24;

export const SearchView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const table = state.selectedTable;
	const { stdout } = useStdout();
	const [inputValue, setInputValue] = useState(state.searchTerm ?? "");
	const [navigationMode, setNavigationMode] = useState(false);

	useEffect(() => {
		setInputValue(state.searchTerm ?? "");
	}, [state.searchTerm]);

	useEffect(() => {
		setNavigationMode(false);
	}, [table?.name, table?.schema]);

	const terminalWidth = stdout?.columns ?? 80;
	const summaryWidth = Math.max(40, terminalWidth - 8);

	const selectedRow = useMemo<DataRow | null>(() => {
		if (
			state.searchSelectedIndex === null ||
			state.searchSelectedIndex < 0 ||
			state.searchSelectedIndex >= state.searchResults.length
		) {
			return null;
		}
		return state.searchResults[state.searchSelectedIndex] ?? null;
	}, [state.searchResults, state.searchSelectedIndex]);

	const rowsLabel = useMemo(() => {
		if (state.searchResults.length === 0) {
			return "No results";
		}
		const start = state.searchOffset + 1;
		const end = state.searchOffset + state.searchResults.length;
		return `Showing ${start}-${end} of ${state.searchTotalCount}`;
	}, [state.searchOffset, state.searchResults.length, state.searchTotalCount]);

	const handleSearch = useCallback(
		(offset: number = 0) => {
			if (!table || !state.activeConnection || !state.dbType) {
				dispatch({
					type: ActionType.SetError,
					error: "No table selected or connection unavailable.",
				});
				return;
			}
			const term = navigationMode ? state.searchTerm : inputValue;
			void searchTableRows(
				dispatch,
				state,
				{
					type: state.dbType,
					connectionString: state.activeConnection.connectionString,
				},
				table,
				state.columns,
				{ term, offset, limit: SEARCH_PAGE_SIZE },
			);
		},
		[
			dispatch,
			navigationMode,
			inputValue,
			state,
			state.columns,
			state.dbType,
			state.searchTerm,
			table,
		],
	);

	useInput((input, key) => {
		if (key.escape) {
			if (navigationMode) {
				setNavigationMode(false);
				return;
			}
			dispatch({ type: ActionType.SetView, view: ViewState.Columns });
			return;
		}

		if (key.tab) {
			setNavigationMode((prev) => !prev);
			return;
		}

		if (!navigationMode) {
			return;
		}

		const resultsCount = state.searchResults.length;
		if (resultsCount === 0) {
			return;
		}

		if (key.upArrow) {
			const nextIndex =
				state.searchSelectedIndex === null || state.searchSelectedIndex <= 0
					? resultsCount - 1
					: (state.searchSelectedIndex ?? 0) - 1;
			dispatch({ type: ActionType.SetSearchSelectedIndex, index: nextIndex });
			return;
		}

		if (key.downArrow) {
			const nextIndex =
				state.searchSelectedIndex === null ||
				state.searchSelectedIndex >= resultsCount - 1
					? 0
					: (state.searchSelectedIndex ?? 0) + 1;
			dispatch({ type: ActionType.SetSearchSelectedIndex, index: nextIndex });
			return;
		}

		if ((input === "n" || key.pageDown) && state.searchHasMore) {
			const nextOffset = state.searchOffset + SEARCH_PAGE_SIZE;
			handleSearch(nextOffset);
			return;
		}

		if ((input === "p" || key.pageUp) && state.searchOffset > 0) {
			const nextOffset = Math.max(0, state.searchOffset - SEARCH_PAGE_SIZE);
			handleSearch(nextOffset);
			return;
		}

		if ((key.return || input === "d") && selectedRow) {
			dispatch({ type: ActionType.SetExpandedRow, row: selectedRow });
			dispatch({ type: ActionType.SetView, view: ViewState.RowDetail });
		}
	});

	if (!table) {
		return (
			<ViewBuilder title="Table Search" footer="Esc back">
				<Text dimColor>No table selected.</Text>
			</ViewBuilder>
		);
	}

	const footer = navigationMode
		? "Tab: Edit term • ↑/↓ Select • n/p or PgUp/PgDn Page • Enter/d Row detail • Esc Back"
		: "Tab: Results mode • Enter: Search • Esc Back";

	return (
		<ViewBuilder
			title="Search Table"
			subtitle={`${renderTableName(table)} • ${rowsLabel}`}
			footer={footer}
		>
			<Box flexDirection="column">
				<Box flexDirection="column" marginBottom={1}>
					<Text color="cyan">Search term:</Text>
					<Text color="gray" dimColor>
						{navigationMode
							? "Navigation mode active. Press Tab to edit search."
							: "Press Enter to search. Tab switches to results navigation."}
					</Text>
				</Box>
				<TextInput
					value={inputValue}
					onChange={setInputValue}
					onSubmit={() => {
						handleSearch(0);
						setNavigationMode(true);
					}}
					placeholder="Type to search across all columns..."
					disabled={navigationMode}
					focus={!navigationMode}
				/>
				<Box marginY={1} flexDirection="column">
					<Text color="gray" dimColor>
						{state.searchResults.length > 0
							? "Use Tab to switch between editing and navigating results."
							: "Results will appear below after executing a search."}
					</Text>
				</Box>
				<Box flexDirection="column">
					{state.searchResults.length === 0 ? (
						<Text dimColor>No results yet.</Text>
					) : (
						state.searchResults.map((row, index) => {
							const isSelected = index === state.searchSelectedIndex;
							const label = formatRowSummary(row, state.columns, summaryWidth);
							return (
								<Box
									key={index}
									flexDirection="row"
									borderStyle={isSelected ? "single" : undefined}
									borderColor={isSelected ? "cyan" : undefined}
									paddingX={1}
									paddingY={0}
									marginBottom={1}
								>
									<Text color={isSelected ? "cyan" : "gray"}>
										{formatRowIndex(state.searchOffset, index)}
									</Text>
									<Text color={isSelected ? "white" : undefined}>{label}</Text>
								</Box>
							);
						})
					)}
				</Box>
				{state.searchResults.length > 0 && (
					<Box marginTop={1} flexDirection="row" justifyContent="space-between">
						<Text color="gray" dimColor>
							{rowsLabel}
						</Text>
						<Text color="gray" dimColor>
							{state.searchHasMore ? "n: Next page" : "End of results"}
						</Text>
					</Box>
				)}
			</Box>
		</ViewBuilder>
	);
};

function renderTableName(table: { schema?: string; name: string }): string {
	return table.schema ? `${table.schema}.${table.name}` : table.name;
}

function formatRowIndex(offset: number, index: number): string {
	const value = offset + index + 1;
	return `${value.toString().padStart(4, " ")}: `;
}

function formatRowSummary(
	row: DataRow,
	columns: Array<{ name: string }>,
	maxWidth: number,
): string {
	if (columns.length === 0) {
		return JSON.stringify(row);
	}
	const parts: string[] = [];
	for (const column of columns.slice(0, 6)) {
		const rawValue = row[column.name];
		const formatted = truncateValue(summarizeValue(rawValue), MAX_VALUE_LENGTH);
		parts.push(`${column.name}=${formatted}`);
	}
	const summary = parts.join(" | ");
	return truncateValue(summary, maxWidth);
}

function summarizeValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "object") {
		try {
			return JSON.stringify(value);
		} catch {
			return "[object]";
		}
	}
	return String(value);
}

function truncateValue(value: string, width: number): string {
	if (value.length <= width) {
		return value;
	}
	if (width <= 3) {
		return value.slice(0, width);
	}
	return `${value.slice(0, width - 3)}...`;
}

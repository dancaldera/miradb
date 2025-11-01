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
	const {
		selectedTable: table,
		activeConnection,
		dbType,
		columns,
		searchTerm,
		searchResults,
		searchOffset,
		searchTotalCount,
		searchHasMore,
		searchSelectedIndex,
	} = state;
	const { stdout } = useStdout();
	const [inputValue, setInputValue] = useState(searchTerm ?? "");
	const [navigationMode, setNavigationMode] = useState(false);

	useEffect(() => {
		setInputValue(searchTerm ?? "");
	}, [searchTerm]);

	useEffect(() => {
		setNavigationMode(false);
	}, [table?.name, table?.schema]);

	const terminalWidth = stdout?.columns ?? 80;
	const summaryWidth = Math.max(40, terminalWidth - 8);

	const selectedRow = useMemo<DataRow | null>(() => {
		if (
			searchSelectedIndex === null ||
			searchSelectedIndex < 0 ||
			searchSelectedIndex >= searchResults.length
		) {
			return null;
		}
		return searchResults[searchSelectedIndex] ?? null;
	}, [searchResults, searchSelectedIndex]);

	const rowsLabel = useMemo(() => {
		if (searchResults.length === 0) {
			return "No results";
		}
		const start = searchOffset + 1;
		const end = searchOffset + searchResults.length;
		return `Showing ${start}-${end} of ${searchTotalCount}`;
	}, [searchOffset, searchResults.length, searchTotalCount]);

	const handleSearch = useCallback(
		(offset: number = 0) => {
			if (!table || !activeConnection || !dbType) {
				dispatch({
					type: ActionType.SetError,
					error: "No table selected or connection unavailable.",
				});
				return;
			}
			const term = navigationMode ? searchTerm : inputValue;
			void searchTableRows(
				dispatch,
				state,
				{
					type: dbType,
					connectionString: activeConnection.connectionString,
				},
				table,
				columns,
				{ term, offset, limit: SEARCH_PAGE_SIZE },
			);
		},
		[
			dispatch,
			navigationMode,
			inputValue,
			state,
			columns,
			dbType,
			searchTerm,
			table,
			activeConnection,
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

		const resultsCount = searchResults.length;
		if (resultsCount === 0) {
			return;
		}

		if (key.upArrow) {
			const nextIndex =
				searchSelectedIndex === null || searchSelectedIndex <= 0
					? resultsCount - 1
					: (searchSelectedIndex ?? 0) - 1;
			dispatch({ type: ActionType.SetSearchSelectedIndex, index: nextIndex });
			return;
		}

		if (key.downArrow) {
			const nextIndex =
				searchSelectedIndex === null || searchSelectedIndex >= resultsCount - 1
					? 0
					: (searchSelectedIndex ?? 0) + 1;
			dispatch({ type: ActionType.SetSearchSelectedIndex, index: nextIndex });
			return;
		}

		if ((input === "n" || key.pageDown) && searchHasMore) {
			const nextOffset = searchOffset + SEARCH_PAGE_SIZE;
			handleSearch(nextOffset);
			return;
		}

		if ((input === "p" || key.pageUp) && searchOffset > 0) {
			const nextOffset = Math.max(0, searchOffset - SEARCH_PAGE_SIZE);
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
					onChange={(value) => {
						if (!navigationMode) {
							setInputValue(value);
						}
					}}
					onSubmit={() => {
						if (!navigationMode) {
							handleSearch(0);
							setNavigationMode(true);
						}
					}}
					placeholder="Type to search across all columns..."
					focus={!navigationMode}
				/>
				<Box marginY={1} flexDirection="column">
					<Text color="gray" dimColor>
						{searchResults.length > 0
							? "Use Tab to switch between editing and navigating results."
							: "Results will appear below after executing a search."}
					</Text>
				</Box>
				<Box flexDirection="column">
					{searchResults.length === 0 ? (
						<Text dimColor>No results yet.</Text>
					) : (
						searchResults.map((row, index) => {
							const isSelected = index === searchSelectedIndex;
							const label = formatRowSummary(row, columns, summaryWidth);
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
										{formatRowIndex(searchOffset, index)}
									</Text>
									<Text color={isSelected ? "white" : undefined}>{label}</Text>
								</Box>
							);
						})
					)}
				</Box>
				{searchResults.length > 0 && (
					<Box marginTop={1} flexDirection="row" justifyContent="space-between">
						<Text color="gray" dimColor>
							{rowsLabel}
						</Text>
						<Text color="gray" dimColor>
							{searchHasMore ? "n: Next page" : "End of results"}
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

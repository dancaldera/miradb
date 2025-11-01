import { Box, Text, useInput, useStdout } from "ink";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import type { ColumnInfo, DataRow, TableInfo } from "../types/state.js";
import { ViewState } from "../types/state.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { getColorForDataType } from "../utils/color-mapping.js";
import { ViewBuilder } from "./ViewBuilder.js";

const FIELDS_PER_PAGE = 10;
const MIN_PREVIEW_WIDTH = 24;
const PREVIEW_WIDTH_OFFSET = 32;
const PAGINATION_WINDOW = 7;

export const RowDetailView: React.FC = () => {
	const dispatch = useAppDispatch();
	const state = useAppState();
	const { stdout } = useStdout();
	const terminalWidth = stdout?.columns ?? 80;
	const terminalHeight = stdout?.rows ?? 24;
	const previewWidth = Math.max(
		MIN_PREVIEW_WIDTH,
		terminalWidth - PREVIEW_WIDTH_OFFSET,
	);

	const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);
	const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(
		null,
	);
	const [valueViewerOpen, setValueViewerOpen] = useState(false);
	const [valueViewerScrollOffset, setValueViewerScrollOffset] = useState(0);

	const currentRow = useMemo<DataRow | null>(() => {
		if (state.expandedRow) return state.expandedRow;
		if (
			state.selectedRowIndex !== null &&
			state.dataRows[state.selectedRowIndex]
		) {
			return state.dataRows[state.selectedRowIndex];
		}
		return state.dataRows[0] ?? null;
	}, [state.dataRows, state.expandedRow, state.selectedRowIndex]);

	const fields = useMemo(() => {
		return state.columns.map((column) => ({
			column,
			value: currentRow ? currentRow[column.name] : null,
		}));
	}, [state.columns, currentRow]);

	useEffect(() => {
		if (fields.length === 0) {
			setSelectedFieldIndex(0);
			setExpandedFieldIndex(null);
			return;
		}

		if (selectedFieldIndex >= fields.length) {
			setSelectedFieldIndex(fields.length - 1);
		}

		if (
			expandedFieldIndex !== null &&
			(expandedFieldIndex >= fields.length || expandedFieldIndex < 0)
		) {
			setExpandedFieldIndex(null);
		}
	}, [fields.length, selectedFieldIndex, expandedFieldIndex]);
	const selectedField = fields[selectedFieldIndex] ?? null;
	const valueViewerLines = selectedField
		? formatFullValue(selectedField.value)
		: [];
	const valueViewerVisibleLineCount = Math.max(4, terminalHeight - 8);
	const valueViewerMaxScroll = Math.max(
		0,
		valueViewerLines.length - valueViewerVisibleLineCount,
	);

	const totalPages = Math.max(1, Math.ceil(fields.length / FIELDS_PER_PAGE));
	const currentPage = Math.floor(selectedFieldIndex / FIELDS_PER_PAGE);
	const pageStart = currentPage * FIELDS_PER_PAGE;
	const pageEnd = Math.min(pageStart + FIELDS_PER_PAGE, fields.length);
	const visibleFields = fields.slice(pageStart, pageEnd);

	const expandedField =
		expandedFieldIndex !== null ? (fields[expandedFieldIndex] ?? null) : null;

	useEffect(() => {
		if (!valueViewerOpen) {
			return;
		}
		setValueViewerScrollOffset((prev) => Math.min(prev, valueViewerMaxScroll));
	}, [valueViewerOpen, valueViewerMaxScroll]);

	useInput((input, key) => {
		if (valueViewerOpen) {
			if (key.escape || input === "q" || input === "b") {
				setValueViewerOpen(false);
				setValueViewerScrollOffset(0);
				return;
			}

			if (!selectedField) {
				return;
			}

			if (key.upArrow) {
				setValueViewerScrollOffset((prev) => Math.max(0, prev - 1));
				return;
			}

			if (key.downArrow) {
				setValueViewerScrollOffset((prev) =>
					Math.min(valueViewerMaxScroll, prev + 1),
				);
				return;
			}

			if (key.pageUp) {
				setValueViewerScrollOffset((prev) =>
					Math.max(0, prev - valueViewerVisibleLineCount),
				);
				return;
			}

			if (key.pageDown) {
				setValueViewerScrollOffset((prev) =>
					Math.min(valueViewerMaxScroll, prev + valueViewerVisibleLineCount),
				);
				return;
			}

			if ("home" in key && (key as Record<string, unknown>).home) {
				setValueViewerScrollOffset(0);
				return;
			}

			if ("end" in key && (key as Record<string, unknown>).end) {
				setValueViewerScrollOffset(valueViewerMaxScroll);
				return;
			}

			if (input === "c") {
				const fullValue = stringifyValue(selectedField.value, true);
				void copyToClipboard(fullValue).then((success) => {
					if (success) {
						dispatch({
							type: ActionType.SetInfo,
							message: `Copied ${selectedField.column.name} value to clipboard`,
						});
					} else {
						dispatch({
							type: ActionType.SetError,
							error: `Unable to copy ${selectedField.column.name} value`,
						});
					}
				});
				return;
			}

			return;
		}

		if (key.escape || input === "q" || input === "b") {
			dispatch({ type: ActionType.SetExpandedRow, row: null });
			dispatch({ type: ActionType.SetView, view: ViewState.DataPreview });
			return;
		}

		if (fields.length === 0) {
			return;
		}

		if (key.upArrow) {
			setSelectedFieldIndex((prev) =>
				prev <= 0 ? fields.length - 1 : prev - 1,
			);
			return;
		}

		if (key.downArrow) {
			setSelectedFieldIndex((prev) =>
				prev >= fields.length - 1 ? 0 : prev + 1,
			);
			return;
		}

		if (key.leftArrow) {
			setSelectedFieldIndex((prev) => Math.max(0, prev - FIELDS_PER_PAGE));
			return;
		}

		if (key.rightArrow) {
			setSelectedFieldIndex((prev) =>
				Math.min(fields.length - 1, prev + FIELDS_PER_PAGE),
			);
			return;
		}

		if (key.pageUp && currentPage > 0) {
			const previousPageStart = Math.max(0, pageStart - FIELDS_PER_PAGE);
			setSelectedFieldIndex(previousPageStart);
			return;
		}

		if (key.pageDown && currentPage < totalPages - 1) {
			const nextPageStart = Math.min(
				fields.length - 1,
				pageStart + FIELDS_PER_PAGE,
			);
			setSelectedFieldIndex(nextPageStart);
			return;
		}

		if ("home" in key && (key as Record<string, unknown>).home) {
			setSelectedFieldIndex(0);
			return;
		}

		if (
			"end" in key &&
			(key as Record<string, unknown>).end &&
			fields.length > 0
		) {
			setSelectedFieldIndex(fields.length - 1);
			return;
		}

		if (input === "[" && currentPage > 0) {
			const previousPageStart = Math.max(0, pageStart - FIELDS_PER_PAGE);
			setSelectedFieldIndex(previousPageStart);
			return;
		}

		if (input === "]" && currentPage < totalPages - 1) {
			const nextPageStart = Math.min(
				fields.length - 1,
				pageStart + FIELDS_PER_PAGE,
			);
			setSelectedFieldIndex(nextPageStart);
			return;
		}

		if (key.return || input === " ") {
			setExpandedFieldIndex((prev) =>
				prev === selectedFieldIndex ? null : selectedFieldIndex,
			);
			return;
		}

		if ((input === "v" || input === "V") && selectedField) {
			setValueViewerOpen(true);
			setValueViewerScrollOffset(0);
			setExpandedFieldIndex(selectedFieldIndex);
			return;
		}

		if (input === "c" && selectedField) {
			const fullValue = stringifyValue(selectedField.value, true);
			void copyToClipboard(fullValue).then((success) => {
				if (success) {
					dispatch({
						type: ActionType.SetInfo,
						message: `Copied ${selectedField.column.name} value to clipboard`,
					});
				} else {
					dispatch({
						type: ActionType.SetError,
						error: `Unable to copy ${selectedField.column.name} value`,
					});
				}
			});
			return;
		}

		if (input === "C" && currentRow) {
			const fullRow = JSON.stringify(currentRow, null, 2);
			void copyToClipboard(fullRow).then((success) => {
				if (success) {
					dispatch({
						type: ActionType.SetInfo,
						message: "Copied entire row to clipboard",
					});
				} else {
					dispatch({
						type: ActionType.SetError,
						error: "Unable to copy row to clipboard",
					});
				}
			});
		}
	});

	if (!state.columns.length || !currentRow) {
		return (
			<ViewBuilder
				title="Row Details"
				subtitle="No row selected"
				footer="Esc Back"
			>
				<Text color="gray" dimColor>
					Select a row from the data preview to see its details.
				</Text>
			</ViewBuilder>
		);
	}

	const subtitleParts: string[] = [];
	if (state.selectedTable) {
		subtitleParts.push(renderTableName(state.selectedTable));
	}
	if (state.selectedRowIndex !== null) {
		subtitleParts.push(`Row ${state.selectedRowIndex + 1}`);
	}
	if (fields.length > 0) {
		subtitleParts.push(`${fields.length} fields`);
		subtitleParts.push(`Fields ${pageStart + 1}-${pageEnd}`);
	}
	subtitleParts.push(`Page ${currentPage + 1}/${totalPages}`);

	const labelWidth = computeLabelWidth(state.columns);

	if (valueViewerOpen && selectedField) {
		const visibleLines = valueViewerLines.slice(
			valueViewerScrollOffset,
			valueViewerScrollOffset + valueViewerVisibleLineCount,
		);
		return (
			<ViewBuilder
				title="Field Value"
				subtitle={[
					state.selectedTable ? renderTableName(state.selectedTable) : null,
					`${selectedField.column.name} (${selectedField.column.dataType})`,
					`Field ${selectedFieldIndex + 1}/${fields.length || 1}`,
					valueViewerLines.length > valueViewerVisibleLineCount
						? `Lines ${valueViewerScrollOffset + 1}-${Math.min(
								valueViewerScrollOffset + valueViewerVisibleLineCount,
								valueViewerLines.length,
							)}/${valueViewerLines.length}`
						: `${valueViewerLines.length} lines`,
				]
					.filter(Boolean)
					.join(" • ")}
				footer="↑/↓ Scroll • PgUp/PgDn Faster • c Copy • Esc Close"
			>
				<Box flexDirection="column">
					{visibleLines.map((line, idx) => (
						<Text key={idx} color="white">
							{line}
						</Text>
					))}
					{valueViewerLines.length === 0 && (
						<Text color="gray" dimColor>
							No value available.
						</Text>
					)}
					{valueViewerLines.length > valueViewerVisibleLineCount && (
						<Box marginTop={1}>
							<Text color="gray" dimColor>
								Scroll {valueViewerScrollOffset + 1} of{" "}
								{valueViewerMaxScroll + 1}
							</Text>
						</Box>
					)}
				</Box>
			</ViewBuilder>
		);
	}

	return (
		<ViewBuilder
			title="Row Details"
			subtitle={subtitleParts.join(" • ")}
			footer="↑/↓ Field • ←/→ Page • PgUp/PgDn Jump • Enter Expand • v Value view • c Copy value • C Copy row • Esc Back"
		>
			<Box flexDirection="column">
				<Box
					flexDirection="row"
					justifyContent="space-between"
					marginBottom={1}
				>
					<Text color="gray" dimColor>
						{fields.length > 0
							? `Fields ${pageStart + 1}–${pageEnd} of ${fields.length}`
							: "No fields"}
					</Text>
					<Text color="gray" dimColor>
						{renderPaginationLabel(currentPage, totalPages)}
					</Text>
				</Box>
				{visibleFields.map(({ column, value }, index) => {
					const globalIndex = pageStart + index;
					const isSelected = globalIndex === selectedFieldIndex;
					const isExpanded = globalIndex === expandedFieldIndex;
					const valueColor = getValueColor(column, value, isSelected);
					const preview = formatPreviewValue(value, previewWidth);

					return (
						<Box
							key={column.name}
							flexDirection="column"
							paddingX={1}
							paddingY={0}
							marginBottom={1}
							borderStyle={isSelected ? "single" : undefined}
							borderColor={isSelected ? "cyan" : undefined}
						>
							<Box flexDirection="row">
								<Text color={isSelected ? "white" : "cyan"} bold>
									{isSelected ? "▶ " : "  "}
								</Text>
								<Text color={isSelected ? "white" : "cyan"} bold={isSelected}>
									{formatLabel(column, labelWidth)}
								</Text>
								<Text color={isSelected ? "white" : "gray"} dimColor>
									{` ${column.dataType}`}
									{column.isPrimaryKey ? " • PK" : ""}
									{column.nullable ? " • nullable" : ""}
								</Text>
							</Box>

							<Box marginLeft={isSelected ? 2 : 4}>
								<Text color={valueColor}>{preview}</Text>
								{isExpanded && (
									<Text color="gray" dimColor>
										{" "}
										(full value below)
									</Text>
								)}
							</Box>
						</Box>
					);
				})}

				{expandedField && (
					<Box
						flexDirection="column"
						borderStyle="round"
						borderColor="gray"
						paddingX={1}
						paddingY={0}
					>
						<Text color="cyan" bold>
							{expandedField.column.name} — full value
						</Text>
						<Box marginTop={1} flexDirection="column">
							{formatFullValue(expandedField.value).map((line, idx) => (
								<Text key={idx} color="white">
									{line}
								</Text>
							))}
						</Box>
						<Box marginTop={1}>
							<Text color="gray" dimColor>
								Enter/Space collapse • v view value • c copy value • Esc back
							</Text>
						</Box>
					</Box>
				)}

				{totalPages > 1 && (
					<Box marginTop={1}>
						<Text color="gray" dimColor>
							{renderPaginationIndicators(currentPage, totalPages)}
						</Text>
					</Box>
				)}
			</Box>
		</ViewBuilder>
	);
};

function renderTableName(table: TableInfo): string {
	return table.schema ? `${table.schema}.${table.name}` : table.name;
}

function computeLabelWidth(columns: ColumnInfo[]): number {
	const longestName = columns.reduce(
		(max, column) => Math.max(max, column.name.length),
		0,
	);
	return Math.min(Math.max(longestName + 2, 12), 28);
}

function formatLabel(column: ColumnInfo, width: number): string {
	const indicator = column.isPrimaryKey ? "🔑 " : "";
	const base = `${indicator}${column.name}`;
	return base.length >= width ? base : base.padEnd(width, " ");
}

function stringifyValue(value: unknown, pretty: boolean = false): string {
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
			const space = pretty ? 2 : undefined;
			return JSON.stringify(value, null, space);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function truncateWithEllipsis(text: string, width: number): string {
	if (width <= 0) return "";
	if (text.length <= width) {
		return text;
	}
	if (width <= 3) {
		return text.substring(0, width);
	}
	return `${text.substring(0, width - 3)}...`;
}

function formatPreviewValue(value: unknown, width: number): string {
	const base = stringifyValue(value);
	const singleLine = normalizeWhitespace(base);
	return truncateWithEllipsis(singleLine, width);
}

function formatFullValue(value: unknown): string[] {
	const full = stringifyValue(value, true);
	return full.split("\n");
}

function getValueColor(
	column: ColumnInfo,
	value: unknown,
	isSelected: boolean,
): string | undefined {
	if (value === null || value === undefined) {
		return isSelected ? "white" : "gray";
	}
	const base = getColorForDataType(column.dataType, value);
	if (isSelected && !base) {
		return "white";
	}
	return base;
}

function renderPaginationLabel(
	currentPage: number,
	totalPages: number,
): string {
	if (totalPages <= 1) {
		return "Page 1/1";
	}
	return `Page ${currentPage + 1}/${totalPages}`;
}

function renderPaginationIndicators(
	currentPage: number,
	totalPages: number,
): string {
	if (totalPages <= 1) {
		return "";
	}
	const pages = getPaginationWindow(currentPage, totalPages, PAGINATION_WINDOW);
	const parts: string[] = [];
	parts.push(currentPage === 0 ? "⟨⟨" : "«");
	parts.push(currentPage === 0 ? "⟨" : "‹");
	pages.forEach((page) => {
		if (page === currentPage) {
			parts.push(`[${page + 1}]`);
		} else {
			parts.push(String(page + 1));
		}
	});
	parts.push(currentPage === totalPages - 1 ? "⟩" : "›");
	parts.push(currentPage === totalPages - 1 ? "⟩⟩" : "»");
	return parts.join(" ");
}

function getPaginationWindow(
	currentPage: number,
	totalPages: number,
	windowSize: number,
): number[] {
	if (totalPages <= windowSize) {
		return Array.from({ length: totalPages }, (_, idx) => idx);
	}
	const halfWindow = Math.floor(windowSize / 2);
	let start = currentPage - halfWindow;
	let end = currentPage + halfWindow;
	if (windowSize % 2 === 0) {
		end -= 1;
	}
	if (start < 0) {
		end += -start;
		start = 0;
	}
	if (end >= totalPages) {
		const overshoot = end - (totalPages - 1);
		start = Math.max(0, start - overshoot);
		end = totalPages - 1;
	}
	const pages: number[] = [];
	for (let page = start; page <= end; page += 1) {
		pages.push(page);
	}
	return pages;
}

import { Box, Text, useInput, useStdout } from "ink";
import React, { useEffect, useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { updateTableFieldValue } from "../state/effects.js";
import type { ColumnInfo, DataRow, TableInfo } from "../types/state.js";
import { ViewState } from "../types/state.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { getColorForDataType } from "../utils/color-mapping.js";
import {
	getSelectionBackground,
	getSelectionIndicator,
} from "../utils/selection-theme.js";
import { ViewBuilder } from "./ViewBuilder.js";

const FIELDS_PER_PAGE = 10;
const MIN_PREVIEW_WIDTH = 24;
const PREVIEW_WIDTH_OFFSET = 32;
const PAGINATION_WINDOW = 7;

const RowDetailViewComponent: React.FC = () => {
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
	const [valueViewerOpen, setValueViewerOpen] = useState(false);
	const [valueViewerScrollOffset, setValueViewerScrollOffset] = useState(0);
	const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
		null,
	);
	const [editBuffer, setEditBuffer] = useState("");
	const [editCursor, setEditCursor] = useState(0);
	const [editScrollOffset, setEditScrollOffset] = useState(0);
	const [isSavingEdit, setIsSavingEdit] = useState(false);

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
	const selectedField = fields[selectedFieldIndex] ?? null;
	const valueViewerLines = selectedField
		? formatFullValue(selectedField.value)
		: [];
	const valueViewerVisibleLineCount = Math.max(4, terminalHeight - 8);
	const valueViewerMaxScroll = Math.max(
		0,
		valueViewerLines.length - valueViewerVisibleLineCount,
	);
	const editingField =
		editingFieldIndex !== null ? (fields[editingFieldIndex] ?? null) : null;
	const editLines = useMemo(() => splitBuffer(editBuffer), [editBuffer]);
	const editCursorLocation = useMemo(
		() => indexToLineColumn(editBuffer, editCursor),
		[editBuffer, editCursor],
	);
	const editCursorLine = editCursorLocation.line;
	const editCursorColumn = editCursorLocation.column;

	useEffect(() => {
		if (fields.length === 0) {
			setSelectedFieldIndex(0);
			return;
		}

		if (selectedFieldIndex >= fields.length) {
			setSelectedFieldIndex(fields.length - 1);
		}
	}, [fields.length, selectedFieldIndex]);

	useEffect(() => {
		if (editingFieldIndex === null) {
			return;
		}
		if (editingFieldIndex >= fields.length) {
			setEditingFieldIndex(null);
		}
	}, [editingFieldIndex, fields.length]);

	useEffect(() => {
		if (editingFieldIndex === null) {
			return;
		}
		setEditCursor((cursor) => Math.min(cursor, editBuffer.length));
	}, [editingFieldIndex, editBuffer.length]);

	useEffect(() => {
		if (editingFieldIndex === null) {
			return;
		}
		const totalLines = editLines.length;
		setEditScrollOffset((offset) => {
			const maxOffset = Math.max(0, totalLines - valueViewerVisibleLineCount);
			return Math.min(offset, maxOffset);
		});
	}, [editingFieldIndex, editLines.length, valueViewerVisibleLineCount]);

	useEffect(() => {
		if (editingFieldIndex === null) {
			return;
		}
		setEditScrollOffset((offset) =>
			clampScrollOffset(
				offset,
				editCursorLine,
				valueViewerVisibleLineCount,
				editLines.length,
			),
		);
	}, [
		editingFieldIndex,
		editCursorLine,
		editLines.length,
		valueViewerVisibleLineCount,
	]);

	const totalPages = Math.max(1, Math.ceil(fields.length / FIELDS_PER_PAGE));
	const currentPage = Math.floor(selectedFieldIndex / FIELDS_PER_PAGE);
	const pageStart = currentPage * FIELDS_PER_PAGE;
	const pageEnd = Math.min(pageStart + FIELDS_PER_PAGE, fields.length);
	const visibleFields = fields.slice(pageStart, pageEnd);

	useEffect(() => {
		if (!valueViewerOpen) {
			return;
		}
		setValueViewerScrollOffset((prev) => Math.min(prev, valueViewerMaxScroll));
	}, [valueViewerOpen, valueViewerMaxScroll]);

	const applyEdit = (buffer: string, cursorPosition: number) => {
		const clampedCursor = Math.max(0, Math.min(cursorPosition, buffer.length));
		const lines = splitBuffer(buffer);
		const cursorLocation = indexToLineColumn(buffer, clampedCursor);
		const adjustedOffset = clampScrollOffset(
			editScrollOffset,
			cursorLocation.line,
			valueViewerVisibleLineCount,
			lines.length,
		);
		setEditBuffer(buffer);
		setEditCursor(clampedCursor);
		setEditScrollOffset(adjustedOffset);
	};

	const moveCursor = (nextPosition: number) => {
		const clampedCursor = Math.max(
			0,
			Math.min(nextPosition, editBuffer.length),
		);
		const adjustedOffset = clampScrollOffset(
			editScrollOffset,
			indexToLineColumn(editBuffer, clampedCursor).line,
			valueViewerVisibleLineCount,
			editLines.length,
		);
		setEditCursor(clampedCursor);
		setEditScrollOffset(adjustedOffset);
	};

	const handleEditSave = async () => {
		if (editingFieldIndex === null || !editingField || !currentRow) {
			return;
		}
		setIsSavingEdit(true);
		const success = await updateTableFieldValue(
			dispatch,
			state,
			state.selectedTable ?? null,
			editingField.column,
			state.selectedRowIndex,
			currentRow,
			editBuffer,
		);
		setIsSavingEdit(false);
		if (success) {
			setEditingFieldIndex(null);
		}
	};

	const beginEditing = () => {
		if (!selectedField) {
			return;
		}
		const rawValue = stringifyValue(selectedField.value, true);
		const initialBuffer = rawValue === "NULL" ? "" : rawValue;
		const initialCursor = initialBuffer.length;
		const lines = splitBuffer(initialBuffer);
		const initialOffset = clampScrollOffset(
			0,
			indexToLineColumn(initialBuffer, initialCursor).line,
			valueViewerVisibleLineCount,
			lines.length,
		);
		setEditingFieldIndex(selectedFieldIndex);
		setEditBuffer(initialBuffer);
		setEditCursor(initialCursor);
		setEditScrollOffset(initialOffset);
		setValueViewerOpen(false);
	};

	useInput((input, key) => {
		if (editingFieldIndex !== null) {
			if (isSavingEdit) {
				return;
			}

			if (key.escape) {
				setEditingFieldIndex(null);
				return;
			}

			if (key.ctrl && input.toLowerCase() === "l") {
				setEditBuffer("");
				setEditCursor(0);
				setEditScrollOffset(0);
				return;
			}

			if (
				(key.ctrl && key.return) ||
				(key.ctrl && input.toLowerCase() === "s")
			) {
				void handleEditSave();
				return;
			}

			if (key.return) {
				applyEdit(
					`${editBuffer.slice(0, editCursor)}\n${editBuffer.slice(editCursor)}`,
					editCursor + 1,
				);
				return;
			}

			const isBackspaceKey = key.backspace || input === "\u007f";
			const isDeleteKey =
				((key as Record<string, unknown>).delete as boolean | undefined) ===
					true || input === "\u001b[3~";

			// Backspace deletes to the right →
			if (isBackspaceKey && !isDeleteKey) {
				if (editCursor >= editBuffer.length) {
					return;
				}
				applyEdit(
					`${editBuffer.slice(0, editCursor)}${editBuffer.slice(editCursor + 1)}`,
					editCursor,
				);
				return;
			}

			// Delete key deletes to the left ←
			if (isDeleteKey && !isBackspaceKey) {
				if (editCursor === 0) {
					return;
				}
				applyEdit(
					`${editBuffer.slice(0, editCursor - 1)}${editBuffer.slice(editCursor)}`,
					editCursor - 1,
				);
				return;
			}

			if (key.leftArrow) {
				moveCursor(editCursor - 1);
				return;
			}

			if (key.rightArrow) {
				moveCursor(editCursor + 1);
				return;
			}

			if (key.ctrl && input.toLowerCase() === "a") {
				const lineStartIndex = lineColumnToIndex(editLines, editCursorLine, 0);
				moveCursor(lineStartIndex);
				return;
			}

			if (key.ctrl && input.toLowerCase() === "e") {
				const lineLength = editLines[editCursorLine]?.length ?? 0;
				moveCursor(lineColumnToIndex(editLines, editCursorLine, lineLength));
				return;
			}

			if (key.ctrl && input.toLowerCase() === "u") {
				const lineStartIndex = lineColumnToIndex(editLines, editCursorLine, 0);
				const linePrefixLength = editCursor - lineStartIndex;
				if (linePrefixLength > 0) {
					applyEdit(
						`${editBuffer.slice(0, lineStartIndex)}${editBuffer.slice(editCursor)}`,
						lineStartIndex,
					);
				}
				return;
			}

			if (key.upArrow) {
				const target = lineColumnToIndex(
					editLines,
					Math.max(0, editCursorLine - 1),
					editCursorColumn,
				);
				moveCursor(target);
				return;
			}

			if (key.downArrow) {
				const target = lineColumnToIndex(
					editLines,
					Math.min(editLines.length - 1, editCursorLine + 1),
					editCursorColumn,
				);
				moveCursor(target);
				return;
			}

			if (key.pageUp) {
				const targetLine = Math.max(
					0,
					editCursorLine - valueViewerVisibleLineCount,
				);
				moveCursor(lineColumnToIndex(editLines, targetLine, editCursorColumn));
				return;
			}

			if (key.pageDown) {
				const targetLine = Math.min(
					editLines.length - 1,
					editCursorLine + valueViewerVisibleLineCount,
				);
				moveCursor(lineColumnToIndex(editLines, targetLine, editCursorColumn));
				return;
			}

			if ("home" in key && (key as Record<string, unknown>).home) {
				moveCursor(lineColumnToIndex(editLines, editCursorLine, 0));
				return;
			}

			if ("end" in key && (key as Record<string, unknown>).end) {
				const lineLength = editLines[editCursorLine]?.length ?? 0;
				moveCursor(lineColumnToIndex(editLines, editCursorLine, lineLength));
				return;
			}

			if (!key.ctrl && !key.meta && input === "\t") {
				applyEdit(
					`${editBuffer.slice(0, editCursor)}\t${editBuffer.slice(editCursor)}`,
					editCursor + 1,
				);
				return;
			}

			if (!key.ctrl && !key.meta && input.length === 1 && input >= " ") {
				applyEdit(
					`${editBuffer.slice(0, editCursor)}${input}${editBuffer.slice(editCursor)}`,
					editCursor + 1,
				);
			}
			return;
		}

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

			if ((input === "e" || input === "E") && selectedField) {
				beginEditing();
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

		if ((input === "v" || input === "V") && selectedField) {
			setValueViewerOpen(true);
			setValueViewerScrollOffset(0);
			return;
		}

		if ((input === "e" || input === "E") && selectedField) {
			beginEditing();
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
	}
	if (totalPages > 1) {
		subtitleParts.push(`Page ${currentPage + 1}/${totalPages}`);
	}

	const labelWidth = computeLabelWidth(state.columns);

	const editLineNumberWidth = Math.max(2, String(editLines.length).length);

	if (editingFieldIndex !== null && editingField) {
		const visibleLines = editLines.slice(
			editScrollOffset,
			editScrollOffset + valueViewerVisibleLineCount,
		);
		return (
			<ViewBuilder
				title="Edit Field"
				subtitle={[
					state.selectedTable ? renderTableName(state.selectedTable) : null,
					`${editingField.column.name} (${editingField.column.dataType})`,
					`Field ${editingFieldIndex + 1}/${fields.length || 1}`,
					`Line ${editCursorLine + 1}`,
					`Col ${editCursorColumn + 1}`,
				]
					.filter(Boolean)
					.join(" • ")}
				footer={
					isSavingEdit ? "Saving…" : "Enter New line • Ctrl+S Save • Esc Cancel"
				}
			>
				<Box flexDirection="column">
					{isSavingEdit && <Text color="yellow">Saving changes…</Text>}
					{visibleLines.map((line, index) => {
						const absoluteIndex = editScrollOffset + index;
						const isCursorLine = absoluteIndex === editCursorLine;
						const segments = splitLineAtColumn(line, editCursorColumn);
						return (
							<Box key={absoluteIndex} flexDirection="row">
								<Text color="gray" dimColor>
									{`${String(absoluteIndex + 1).padStart(
										editLineNumberWidth,
										" ",
									)} │ `}
								</Text>
								<Text color="white">
									{isCursorLine ? segments.before : line}
								</Text>
								{isCursorLine && (
									<>
										<Text color="cyan">│</Text>
										<Text color="white">{segments.after}</Text>
									</>
								)}
							</Box>
						);
					})}
					{visibleLines.length === 0 && (
						<Text color="gray" dimColor>
							Empty value. Type to insert content.
						</Text>
					)}
				</Box>
				<Box marginTop={1} flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="cyan">
							Editing:
						</Text>
						<Text dimColor>• Type to insert text at cursor position</Text>
						<Text dimColor>
							• Type <Text color="yellow">NULL</Text> (any case) to store SQL
							NULL
						</Text>
						<Text dimColor>
							• Changes save to database immediately after Ctrl+S
						</Text>
					</Box>
					<Box flexDirection="column">
						<Text bold color="cyan">
							Navigation:
						</Text>
						<Text dimColor>
							• Arrow keys move cursor • Ctrl+A/E jump to line start/end
						</Text>
					</Box>
					<Box flexDirection="column">
						<Text bold color="cyan">
							Deletion:
						</Text>
						<Text dimColor>• Backspace deletes character to the right</Text>
						<Text dimColor>
							• Delete (or Ctrl+Backspace on Mac) deletes character to the left
						</Text>
						<Text dimColor>
							• Ctrl+U clears from cursor to line start • Ctrl+L clears all
						</Text>
					</Box>
				</Box>
			</ViewBuilder>
		);
	}

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
				footer="↑/↓ Scroll • PgUp/PgDn Faster • c Copy • e Edit • Esc Close"
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
			footer="↑/↓ Navigate • ←/→ Page • v View • e Edit • c Copy • C Copy row • Esc Back"
		>
			<Box flexDirection="column">
				{visibleFields.map(({ column, value }, index) => {
					const globalIndex = pageStart + index;
					const isSelected = globalIndex === selectedFieldIndex;
					const valueColor = getValueColor(column, value, isSelected);
					const preview = formatPreviewValue(value, previewWidth);
					const metadata = [
						column.dataType,
						column.isPrimaryKey ? "PK" : null,
						column.nullable ? "null" : null,
					]
						.filter(Boolean)
						.join(" ");

					const indicator = getSelectionIndicator(isSelected);
					const backgroundColor = getSelectionBackground(isSelected);

					return (
						<Box key={column.name} flexDirection="row">
							<Text color={indicator.color} backgroundColor={backgroundColor}>
								{indicator.symbol}{" "}
							</Text>
							<Box flexDirection="column" flexGrow={1}>
								<Box flexDirection="row">
									<Text
										color={isSelected ? "white" : "cyan"}
										bold={isSelected}
										backgroundColor={backgroundColor}
									>
										{column.name}
									</Text>
									<Text color="gray" dimColor backgroundColor={backgroundColor}>
										{` (${metadata})`}
									</Text>
								</Box>
								<Box marginLeft={0}>
									<Text color={valueColor} backgroundColor={backgroundColor}>
										{preview}
									</Text>
								</Box>
							</Box>
						</Box>
					);
				})}
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

function splitBuffer(buffer: string): string[] {
	const lines = buffer.split("\n");
	return lines.length === 0 ? [""] : lines;
}

function indexToLineColumn(
	buffer: string,
	index: number,
): {
	line: number;
	column: number;
} {
	const lines = splitBuffer(buffer);
	let remaining = Math.max(0, Math.min(index, buffer.length));
	for (let line = 0; line < lines.length; line += 1) {
		const lineLength = lines[line].length;
		if (remaining <= lineLength) {
			return { line, column: remaining };
		}
		remaining -= lineLength + 1; // account for newline
	}
	const lastLineIndex = Math.max(0, lines.length - 1);
	return { line: lastLineIndex, column: lines[lastLineIndex]?.length ?? 0 };
}

function lineColumnToIndex(
	lines: string[],
	line: number,
	column: number,
): number {
	if (lines.length === 0) {
		return 0;
	}
	const safeLine = Math.max(0, Math.min(line, lines.length - 1));
	const lineLength = lines[safeLine]?.length ?? 0;
	const safeColumn = Math.max(0, Math.min(column, lineLength));
	let index = 0;
	for (let i = 0; i < safeLine; i += 1) {
		index += (lines[i]?.length ?? 0) + 1;
	}
	return index + safeColumn;
}

function clampScrollOffset(
	currentOffset: number,
	targetLine: number,
	visibleLines: number,
	totalLines: number,
): number {
	const maxOffset = Math.max(0, totalLines - visibleLines);
	let nextOffset = Math.max(0, Math.min(currentOffset, maxOffset));
	if (targetLine < nextOffset) {
		nextOffset = targetLine;
	} else if (targetLine >= nextOffset + visibleLines) {
		nextOffset = Math.min(targetLine - visibleLines + 1, maxOffset);
	}
	return Math.max(0, Math.min(nextOffset, maxOffset));
}

function splitLineAtColumn(
	line: string,
	column: number,
): {
	before: string;
	after: string;
} {
	const safeColumn = Math.max(0, Math.min(column, line.length));
	return {
		before: line.slice(0, safeColumn),
		after: line.slice(safeColumn),
	};
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

export const RowDetailView = React.memo(RowDetailViewComponent);

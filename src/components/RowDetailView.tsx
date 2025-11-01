import type React from "react";
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useAppDispatch, useAppState } from "../state/context.js";
import { ViewState } from "../types/state.js";
import { ActionType } from "../state/actions.js";
import { ViewBuilder } from "./ViewBuilder.js";

export const RowDetailView: React.FC = () => {
	const dispatch = useAppDispatch();
	const state = useAppState();
	const [selectedField, setSelectedField] = useState(0);
	const [editingField, setEditingField] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");

	const currentRow = state.dataRows?.[0] ?? null; // For now, just show the first row

	useInput((input, key) => {
		if (key.escape) {
			dispatch({ type: ActionType.SetView, view: ViewState.DataPreview });
		}

		if (editingField === null) {
			if (key.upArrow && selectedField > 0) {
				setSelectedField(selectedField - 1);
			}
			if (
				key.downArrow &&
				state.columns &&
				selectedField < state.columns.length - 1
			) {
				setSelectedField(selectedField + 1);
			}
			if (input === "e" && currentRow && state.columns) {
				const columnName = state.columns[selectedField]?.name;
				if (columnName) {
					setEditingField(selectedField);
					setEditValue(String(currentRow[columnName] || ""));
				}
			}
		} else {
			if (key.escape) {
				setEditingField(null);
				setEditValue("");
			}
		}
	});

	const handleEditSubmit = async () => {
		if (
			editingField === null ||
			!currentRow ||
			!state.activeConnection ||
			!state.dbType
		) {
			return;
		}

		const columnName = state.columns[editingField]?.name;
		if (!columnName) return;

		// TODO: Implement UPDATE query to save the changes
		// This would require constructing an UPDATE statement based on primary keys

		setEditingField(null);
		setEditValue("");
	};

	// Enhanced validation with more defensive checks
	if (
		!state ||
		!state.dataRows ||
		state.dataRows.length === 0 ||
		!state.columns ||
		state.columns.length === 0
	) {
		return (
			<ViewBuilder
				title="Row Details"
				content={
					<Box flexDirection="column">
						<Text color="gray">No row data available.</Text>
						<Text color="gray">
							Select a row from the data preview view first.
						</Text>
						{!state && <Text color="red">State is undefined</Text>}
						{state && !state.dataRows && (
							<Text color="red">DataRows is undefined</Text>
						)}
						{state && state.dataRows && state.dataRows.length === 0 && (
							<Text color="yellow">DataRows is empty</Text>
						)}
						{state && !state.columns && (
							<Text color="red">Columns is undefined</Text>
						)}
						{state && state.columns && state.columns.length === 0 && (
							<Text color="yellow">Columns is empty</Text>
						)}
					</Box>
				}
				helpText="Press Esc to go back to data preview."
			/>
		);
	}

	const renderValue = (value: any, columnName: string) => {
		if (value === null || value === undefined) {
			return (
				<Text color="gray" italic>
					NULL
				</Text>
			);
		}
		if (typeof value === "string") {
			return <Text>"{value}"</Text>;
		}
		if (value instanceof Date) {
			return <Text color="cyan">{value.toISOString()}</Text>;
		}
		if (typeof value === "number") {
			return <Text color="yellow">{value}</Text>;
		}
		if (typeof value === "boolean") {
			return <Text color={value ? "green" : "red"}>{String(value)}</Text>;
		}
		return <Text>{String(value)}</Text>;
	};

	return (
		<ViewBuilder
			title="Row Details"
			subtitle={`Table: ${state.selectedTable || "Unknown"}`}
			content={
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color="blue">Row Data ({state.columns.length} columns)</Text>
						<Text color="gray" dimColor>
							↑/↓: Navigate | 'e': Edit field | Esc: Back to data preview
						</Text>
					</Box>

					{state.columns?.map((column, index) => {
						const value = currentRow[column.name];
						const isSelected = index === selectedField;
						const isEditing = index === editingField;

						return (
							<Box
								key={column.name}
								flexDirection="column"
								marginBottom={1}
								backgroundColor={isSelected ? "blue" : undefined}
							>
								<Box
									flexDirection="row"
									justifyContent="space-between"
									paddingX={1}
								>
									<Box flexDirection="row">
										<Text
											color={isSelected ? "white" : "cyan"}
											bold={isSelected}
										>
											{column.name}
										</Text>
										<Text color="gray" dimColor>
											({column.dataType})
										</Text>
										{column.isPrimaryKey && (
											<Text color="yellow" bold>
												{" "}
												[PK]
											</Text>
										)}
										{column.nullable && <Text color="gray"> nullable</Text>}
									</Box>
								</Box>

								<Box paddingX={1}>
									{isEditing ? (
										<TextInput
											value={editValue}
											onChange={setEditValue}
											onSubmit={handleEditSubmit}
											placeholder={String(value || "")}
										/>
									) : (
										<Box flexDirection="row">
											{renderValue(value, column.name)}
											{isSelected && !column.isPrimaryKey && (
												<Text color="gray" dimColor>
													{" "}
													[Press 'e' to edit]
												</Text>
											)}
										</Box>
									)}
								</Box>

								{column.defaultValue !== null && !isEditing && (
									<Box paddingX={1}>
										<Text color="gray" dimColor>
											Default: {renderValue(column.defaultValue, column.name)}
										</Text>
									</Box>
								)}
							</Box>
						);
					})}

					<Box marginTop={1} flexDirection="column">
						<Text color="gray" dimColor>
							Total columns: {state.columns?.length || 0}
						</Text>
						<Text color="gray" dimColor>
							Selected field: {state.columns?.[selectedField]?.name || "None"}
						</Text>
					</Box>
				</Box>
			}
			helpText={`
Row Detail View Help:
• ↑/↓: Navigate between fields
• 'e': Edit selected field (except primary keys)
• Esc: Go back to data preview
• Shows all columns and their values for the selected row
• [PK] indicates primary key fields
• Data types are shown in parentheses
              `.trim()}
		/>
	);
};

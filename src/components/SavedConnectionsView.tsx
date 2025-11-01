import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { nanoid } from "nanoid";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import {
	connectToDatabase,
	removeSavedConnection,
	updateSavedConnection,
} from "../state/effects.js";
import type { NotificationLevel } from "../types/state.js";
import { DBType, ViewState } from "../types/state.js";

interface SelectItem {
	label: string;
	value: string;
}

export const SavedConnectionsView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [editMode, setEditMode] = useState<"name" | "connectionString" | null>(
		null,
	);
	const [inputValue, setInputValue] = useState("");

	const items = useMemo<SelectItem[]>(() => {
		return state.savedConnections.map((connection) => ({
			label: `${connection.name} • ${connection.type}${connection.id === state.activeConnection?.id ? " (current)" : ""}`,
			value: connection.id,
		}));
	}, [state.savedConnections, state.activeConnection]);

	useEffect(() => {
		if (selectedIndex >= items.length) {
			setSelectedIndex(Math.max(0, items.length - 1));
		}
	}, [items.length, selectedIndex]);

	const selectedConnection = items[selectedIndex]
		? (state.savedConnections.find(
				(connection) => connection.id === items[selectedIndex].value,
			) ?? null)
		: null;

	const notify = (message: string, level: NotificationLevel = "info") => {
		dispatch({
			type: ActionType.AddNotification,
			notification: {
				id: nanoid(),
				message,
				level,
				createdAt: Date.now(),
			},
		});
	};

	const cycleDbType = () => {
		if (!selectedConnection) return;
		const order = [DBType.PostgreSQL, DBType.MySQL, DBType.SQLite];
		const currentIndex = order.indexOf(selectedConnection.type);
		const nextType = order[(currentIndex + 1) % order.length];
		void updateSavedConnection(dispatch, state, selectedConnection.id, {
			type: nextType,
		});
	};

	useInput((input, key) => {
		if (editMode) {
			if (key.escape) {
				setEditMode(null);
				setInputValue("");
			}
			return;
		}

		if (key.escape) {
			dispatch({ type: ActionType.SetView, view: ViewState.Connection });
			return;
		}

		if (!selectedConnection) {
			return;
		}

		if (input === "d" || input === "D") {
			if (state.activeConnection?.id === selectedConnection.id) {
				notify("Disconnect before removing the active connection.", "warning");
				return;
			}
			void removeSavedConnection(dispatch, state, selectedConnection.id);
			return;
		}

		if (input === "r" || input === "R") {
			setEditMode("name");
			setInputValue(selectedConnection.name);
			return;
		}

		if (input === "e" || input === "E") {
			setEditMode("connectionString");
			setInputValue(selectedConnection.connectionString);
			return;
		}

		if (input === "t" || input === "T") {
			cycleDbType();
			return;
		}

		if (key.return || input === "o") {
			void connectToDatabase(dispatch, state, {
				type: selectedConnection.type,
				connectionString: selectedConnection.connectionString,
			});
		}
	});

	if (items.length === 0) {
		return (
			<Box flexDirection="column">
				<Text>No saved connections yet.</Text>
				<Text dimColor>Press Esc to go back.</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text>Select a saved connection:</Text>
			<Box marginTop={1}>
				{editMode && selectedConnection ? (
					<Box flexDirection="column">
						<Text>
							{editMode === "name"
								? "Rename connection:"
								: "Edit connection string:"}
						</Text>
						<TextInput
							value={inputValue}
							onChange={setInputValue}
							onSubmit={(value) => {
								const trimmed = value.trim();
								if (!trimmed) {
									notify("Value cannot be empty.", "warning");
									return;
								}
								setEditMode(null);
								setInputValue("");
								if (editMode === "name") {
									void updateSavedConnection(
										dispatch,
										state,
										selectedConnection.id,
										{ name: trimmed },
									);
								} else {
									void updateSavedConnection(
										dispatch,
										state,
										selectedConnection.id,
										{ connectionString: trimmed },
									);
								}
							}}
						/>
						<Text dimColor>Enter to save • Esc cancel</Text>
					</Box>
				) : (
					<SelectInput
						items={items}
						initialIndex={selectedIndex}
						onHighlight={(item) => {
							const idx = items.findIndex(
								(candidate) => candidate.value === item.value,
							);
							if (idx >= 0) {
								setSelectedIndex(idx);
							}
						}}
						onSelect={(item) => {
							const connection = state.savedConnections.find(
								(conn) => conn.id === item.value,
							);
							if (!connection) return;
							void connectToDatabase(dispatch, state, {
								type: connection.type,
								connectionString: connection.connectionString,
							});
						}}
					/>
				)}
			</Box>
			<Box marginTop={1}>
				<Text dimColor>
					Enter/o open • d delete • r rename • e edit string • t cycle DB type •
					Esc back
				</Text>
			</Box>
		</Box>
	);
};

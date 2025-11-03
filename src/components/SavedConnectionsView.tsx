import { Box, Text, useInput } from "ink";
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
import type { ConnectionInfo, NotificationLevel } from "../types/state.js";
import { DBType, ViewState } from "../types/state.js";
import {
	getSelectionBackground,
	getSelectionIndicator,
	getSelectionTextColor,
	isSelectionBold,
} from "../utils/selection-theme.js";

const ITEMS_PER_PAGE = 15;

// Parse connection string to extract display info
const parseConnectionString = (connStr: string, type: DBType) => {
	try {
		if (type === DBType.SQLite) {
			return {
				host: "local",
				port: "",
				database: connStr.split("/").pop() || connStr,
			};
		}
		const url = new URL(connStr);
		return {
			host: url.hostname,
			port: url.port,
			database: url.pathname.replace(/^\//, "") || "",
		};
	} catch {
		return { host: "", port: "", database: "" };
	}
};

export const SavedConnectionsView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [editMode, setEditMode] = useState<"name" | "connectionString" | null>(
		null,
	);
	const [inputValue, setInputValue] = useState("");
	const [searchMode, setSearchMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(0);

	// Filter connections based on search query
	const filteredConnections = useMemo(() => {
		if (!searchQuery.trim()) {
			return state.savedConnections;
		}
		const query = searchQuery.toLowerCase();
		return state.savedConnections.filter((conn) => {
			const info = parseConnectionString(conn.connectionString, conn.type);
			return (
				conn.name.toLowerCase().includes(query) ||
				conn.type.toLowerCase().includes(query) ||
				info.host.toLowerCase().includes(query) ||
				info.database.toLowerCase().includes(query) ||
				conn.connectionString.toLowerCase().includes(query)
			);
		});
	}, [state.savedConnections, searchQuery]);

	const totalPages = Math.ceil(filteredConnections.length / ITEMS_PER_PAGE);
	const startIndex = currentPage * ITEMS_PER_PAGE;
	const endIndex = Math.min(
		startIndex + ITEMS_PER_PAGE,
		filteredConnections.length,
	);
	const visibleConnections = filteredConnections.slice(startIndex, endIndex);

	// Reset to first page when search changes
	useEffect(() => {
		setCurrentPage(0);
		setSelectedIndex(0);
	}, [searchQuery]);

	// Ensure selectedIndex is valid
	useEffect(() => {
		if (
			selectedIndex >= filteredConnections.length &&
			filteredConnections.length > 0
		) {
			setSelectedIndex(Math.max(0, filteredConnections.length - 1));
		}
	}, [filteredConnections.length, selectedIndex]);

	// Auto-adjust page when selection changes
	useEffect(() => {
		const targetPage = Math.floor(selectedIndex / ITEMS_PER_PAGE);
		if (targetPage !== currentPage) {
			setCurrentPage(targetPage);
		}
	}, [selectedIndex, currentPage]);

	const selectedConnection = filteredConnections[selectedIndex] ?? null;

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
		// Handle edit mode
		if (editMode) {
			if (key.escape) {
				setEditMode(null);
				setInputValue("");
			}
			return;
		}

		// Handle search mode
		if (searchMode) {
			if (key.escape) {
				setSearchMode(false);
				setSearchQuery("");
			}
			return;
		}

		// Start search mode (but not if Ctrl+S is pressed, as that's for saved connections navigation)
		if ((input === "/" || (input === "s" && !key.ctrl)) && !searchMode) {
			setSearchMode(true);
			return;
		}

		// Clear search
		if (key.escape && searchQuery) {
			setSearchQuery("");
			return;
		}

		// Navigation - up/down
		if (key.upArrow && filteredConnections.length > 0) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
			return;
		}

		if (key.downArrow && filteredConnections.length > 0) {
			setSelectedIndex((prev) =>
				Math.min(filteredConnections.length - 1, prev + 1),
			);
			return;
		}

		// Page navigation
		if ((key.leftArrow || input === "p") && currentPage > 0) {
			setCurrentPage((prev) => prev - 1);
			setSelectedIndex(Math.max(0, selectedIndex - ITEMS_PER_PAGE));
			return;
		}

		if ((key.rightArrow || input === "n") && currentPage < totalPages - 1) {
			setCurrentPage((prev) => prev + 1);
			setSelectedIndex(
				Math.min(
					filteredConnections.length - 1,
					selectedIndex + ITEMS_PER_PAGE,
				),
			);
			return;
		}

		// Go home
		if (input === "g") {
			setSelectedIndex(0);
			setCurrentPage(0);
			return;
		}

		// Go to end
		if (input === "G") {
			setSelectedIndex(filteredConnections.length - 1);
			setCurrentPage(totalPages - 1);
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

	if (state.savedConnections.length === 0) {
		return (
			<Box flexDirection="column">
				<Text>No saved connections yet.</Text>
				<Text dimColor>Press Esc to go back.</Text>
			</Box>
		);
	}

	const getDBTypeIcon = (type: DBType) => {
		switch (type) {
			case DBType.PostgreSQL:
				return "🐘";
			case DBType.MySQL:
				return "🐬";
			case DBType.SQLite:
				return "📁";
			default:
				return "🗄️";
		}
	};

	return (
		<Box flexDirection="column">
			{/* Header with count and search indicator */}
			<Box>
				<Text>
					Saved connections ({filteredConnections.length}
					{searchQuery && ` filtered from ${state.savedConnections.length}`})
				</Text>
				{totalPages > 1 && (
					<Text dimColor>
						{" "}
						• Page {currentPage + 1}/{totalPages}
					</Text>
				)}
			</Box>

			{/* Search input */}
			{searchMode && (
				<Box marginTop={1} flexDirection="column">
					<Text>Search:</Text>
					<TextInput
						value={searchQuery}
						onChange={setSearchQuery}
						onSubmit={() => setSearchMode(false)}
					/>
					<Text dimColor>Enter to close • Esc cancel</Text>
				</Box>
			)}

			{/* Active search indicator */}
			{!searchMode && searchQuery && (
				<Box marginTop={1}>
					<Text>
						<Text color="cyan">🔍 Filtering: </Text>
						<Text color="yellow">{searchQuery}</Text>
						<Text dimColor> (Esc to clear)</Text>
					</Text>
				</Box>
			)}

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
				) : filteredConnections.length === 0 ? (
					<Box flexDirection="column">
						<Text color="yellow">No connections match your search.</Text>
						<Text dimColor>
							Press Esc to clear search or / to search again.
						</Text>
					</Box>
				) : (
					<Box flexDirection="column">
						{visibleConnections.map((connection, pageIndex) => {
							const globalIndex = startIndex + pageIndex;
							const isSelected = globalIndex === selectedIndex;
							const isCurrent = connection.id === state.activeConnection?.id;
							const indicator = getSelectionIndicator(isSelected);
							const textColor = getSelectionTextColor(isSelected);
							const bold = isSelectionBold(isSelected);
							const backgroundColor = getSelectionBackground(isSelected);
							const info = parseConnectionString(
								connection.connectionString,
								connection.type,
							);

							return (
								<Box key={connection.id} flexDirection="column">
									<Box>
										<Text
											color={indicator.color}
											backgroundColor={backgroundColor}
										>
											{indicator.symbol}{" "}
										</Text>
										<Text backgroundColor={backgroundColor}>
											{getDBTypeIcon(connection.type)}{" "}
										</Text>
										<Text
											color={textColor}
											bold={bold}
											backgroundColor={backgroundColor}
										>
											{connection.name}
										</Text>
										{isCurrent && (
											<Text color="green" backgroundColor={backgroundColor}>
												{" "}
												✓
											</Text>
										)}
									</Box>
									{isSelected && (
										<Box marginLeft={4}>
											<Text dimColor>
												{connection.type}
												{info.host && ` • ${info.host}`}
												{info.port && `:${info.port}`}
												{info.database && ` • ${info.database}`}
											</Text>
										</Box>
									)}
								</Box>
							);
						})}
					</Box>
				)}
			</Box>

			{/* Navigation hints */}
			<Box marginTop={1} flexDirection="column">
				{!editMode && !searchMode && (
					<>
						<Text dimColor>
							Enter/o open • d delete • r rename • e edit • t cycle type • / or
							s search
						</Text>
						{totalPages > 1 && (
							<Text dimColor>
								←→/p/n page • g/G first/last • ↑↓ navigate • Esc back
							</Text>
						)}
						{totalPages <= 1 && <Text dimColor>↑↓ navigate • Esc back</Text>}
					</>
				)}
			</Box>
		</Box>
	);
};

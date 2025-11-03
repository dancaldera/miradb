import { Box, Text, useApp, useInput } from "ink";
import type React from "react";
import { useMemo, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { DBType, ViewState } from "../types/state.js";
import { historyHelpers } from "../utils/history.js";
import {
	getSelectionBackground,
	getSelectionIndicator,
	getSelectionTextColor,
	isSelectionBold,
	isSelectionDimmed,
} from "../utils/selection-theme.js";

interface DBTypeItem {
	label: string;
	value: DBType;
}

export const DBTypeView: React.FC = () => {
	const dispatch = useAppDispatch();
	const state = useAppState();
	const { exit } = useApp();
	const [selectedIndex, setSelectedIndex] = useState(0);

	const items = useMemo<DBTypeItem[]>(() => {
		return Object.values(DBType).map((value) => ({
			label: value.toUpperCase(),
			value,
		}));
	}, []);

	const handleSelect = (item: DBTypeItem) => {
		// Add history entry
		dispatch({
			type: ActionType.AddViewHistoryEntry,
			entry: historyHelpers.dbTypeSelected(item.value),
		});
		// Reset breadcrumbs to selected database type
		dispatch({
			type: ActionType.SetBreadcrumbs,
			breadcrumbs: [
				{ label: item.value.toUpperCase(), view: ViewState.DBType },
			],
		});
		// Navigate to connection view
		dispatch({ type: ActionType.SelectDBType, dbType: item.value });
	};

	useInput((input, key) => {
		// Handle navigation
		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
			return;
		}

		if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
			return;
		}

		// Handle selection
		if (key.return) {
			handleSelect(items[selectedIndex]);
			return;
		}

		// Handle exit
		if (key.escape) {
			exit();
			setImmediate(() => {
				process.exit(0);
			});
		}
	});

	const shortcutsLabel = `Shortcuts: Ctrl+S saved connections${
		state.savedConnections.length === 0 ? " (none yet)" : ""
	} • Esc quit`;

	if (state.loading) {
		return null;
	}

	return (
		<Box flexDirection="column">
			<Text>Select a database engine:</Text>
			<Box marginY={1} flexDirection="column">
				{items.map((item, index) => {
					const isSelected = index === selectedIndex;
					const indicator = getSelectionIndicator(isSelected);
					const textColor = getSelectionTextColor(isSelected);
					const bold = isSelectionBold(isSelected);
					const dimColor = isSelectionDimmed(isSelected);
					const backgroundColor = getSelectionBackground(isSelected);

					return (
						<Box key={item.value}>
							<Text color={indicator.color} backgroundColor={backgroundColor}>
								{indicator.symbol}{" "}
							</Text>
							<Text
								color={textColor}
								bold={bold}
								dimColor={dimColor}
								backgroundColor={backgroundColor}
							>
								{item.label}
							</Text>
						</Box>
					);
				})}
			</Box>
			<Text dimColor>{shortcutsLabel}</Text>
		</Box>
	);
};

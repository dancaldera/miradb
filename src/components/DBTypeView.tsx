import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import type React from "react";
import { useMemo } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { DBType, ViewState } from "../types/state.js";

interface DBTypeItem {
	label: string;
	value: DBType;
}

export const DBTypeView: React.FC = () => {
	const dispatch = useAppDispatch();
	const state = useAppState();
	const { exit } = useApp();

	const items = useMemo<DBTypeItem[]>(() => {
		return Object.values(DBType).map((value) => ({
			label: value.toUpperCase(),
			value,
		}));
	}, []);

	const handleSelect = (item: { value: DBType }) => {
		dispatch({ type: ActionType.SelectDBType, dbType: item.value });
	};

	useInput((input, key) => {
		const isSavedConnectionsShortcut =
			state.savedConnections.length > 0 &&
			((key.ctrl && input.toLowerCase() === "s") ||
				(!key.ctrl && key.meta && input.toLowerCase() === "s"));

		if (isSavedConnectionsShortcut) {
			dispatch({ type: ActionType.SetView, view: ViewState.SavedConnections });
			return;
		}

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
			<Box marginY={1}>
				<SelectInput items={items} onSelect={handleSelect} />
			</Box>
			<Text dimColor>{shortcutsLabel}</Text>
		</Box>
	);
};

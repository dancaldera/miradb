import { Box, Text } from "ink";
import type React from "react";
import { useMemo } from "react";
import { useAppState } from "../state/context.js";
import { ContextHeader } from "./ContextHeader.js";
import { ScrollableHistory } from "./ScrollableHistory.js";

export const ContextOverviewView: React.FC = () => {
	const state = useAppState();

	const recentCommands = useMemo(
		() => state.viewHistory.slice(-5).map((entry) => entry.summary),
		[state.viewHistory],
	);

	const hasContext =
		!!state.dbType ||
		!!state.activeConnection ||
		state.breadcrumbs.length > 0 ||
		recentCommands.length > 0;

	return (
		<Box flexDirection="column">
			<Text color="green">Session overview</Text>
			<Text dimColor>
				Esc or Ctrl+I to return to your previous view. History entries
				auto-clear when you reset or exit.
			</Text>

			<Box marginTop={1}>
				{hasContext ? (
					<ContextHeader
						activeConnection={state.activeConnection}
						dbType={state.dbType}
						breadcrumbs={state.breadcrumbs}
						recentCommands={recentCommands}
					/>
				) : (
					<Text dimColor>No active context yet.</Text>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text color="cyan">History</Text>
				{state.viewHistory.length > 0 ? (
					<ScrollableHistory entries={state.viewHistory} />
				) : (
					<Text dimColor>No actions recorded yet.</Text>
				)}
			</Box>
		</Box>
	);
};

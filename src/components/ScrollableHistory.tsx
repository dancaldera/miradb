import { Box } from "ink";
import React from "react";
import type { ViewHistoryEntry } from "../types/state.js";
import { ViewSummary } from "./ViewSummary.js";

interface ScrollableHistoryProps {
	entries: ViewHistoryEntry[];
}

export function ScrollableHistory({ entries }: ScrollableHistoryProps) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<Box flexDirection="column" marginBottom={1}>
			{entries.map((entry) => (
				<ViewSummary key={entry.id} entry={entry} />
			))}
		</Box>
	);
}

import { Box, Text } from "ink";
import React from "react";
import type { ViewHistoryEntry } from "../types/state.js";
import { ViewState } from "../types/state.js";

interface ViewSummaryProps {
	entry: ViewHistoryEntry;
}

export function ViewSummary({ entry }: ViewSummaryProps) {
	const renderIcon = () => {
		switch (entry.view) {
			case ViewState.DBType:
				return "🗄️ ";
			case ViewState.Connection:
				return "🔌";
			case ViewState.SavedConnections:
				return "💾";
			case ViewState.Tables:
				return "📋";
			case ViewState.Columns:
				return "📊";
			case ViewState.DataPreview:
				return "👁️ ";
			case ViewState.Query:
				return "⚡";
			case ViewState.QueryHistory:
				return "📜";
			case ViewState.Search:
				return "🔍";
			case ViewState.RowDetail:
				return "🔬";
			case ViewState.Relationships:
				return "🔗";
			case ViewState.Indexes:
				return "📇";
			case ViewState.Context:
				return "🧭";
			default:
				return "▸";
		}
	};

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};

	return (
		<Box marginY={0} paddingLeft={1}>
			<Text color="gray" dimColor>
				[{formatTime(entry.timestamp)}]
			</Text>
			<Text> </Text>
			<Text color="green">{renderIcon()}</Text>
			<Text color="white"> {entry.summary}</Text>
			{entry.data?.tableName && (
				<Text color="cyan"> ({entry.data.tableName})</Text>
			)}
			{entry.data?.query && (
				<Text color="magenta"> "{entry.data.query.substring(0, 50)}..."</Text>
			)}
		</Box>
	);
}

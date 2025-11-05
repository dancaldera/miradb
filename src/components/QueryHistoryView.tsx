import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import { ViewState } from "../types/state.js";
import { ViewBuilder } from "./ViewBuilder.js";

export const QueryHistoryView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);

	const PAGE_SIZE = 5; // Show 5 queries per page for better readability

	const rawHistory = state?.queryHistory || [];

	// More permissive filtering - only filter out items that are truly invalid
	const validHistory = rawHistory.filter((item) => {
		return (
			item &&
			typeof item === "object" &&
			typeof item.query === "string" &&
			item.query.length > 0
		);
	});
	const totalPages = Math.ceil(validHistory.length / PAGE_SIZE);
	const startIndex = currentPage * PAGE_SIZE;
	const endIndex = Math.min(startIndex + PAGE_SIZE, validHistory.length);
	const currentPageHistory = validHistory.slice(startIndex, endIndex);
	const selectedQuery = currentPageHistory[selectedIndex];

	// Remove debug info for cleaner UI in production

	// Reset selection when page changes
	useEffect(() => {
		if (
			selectedIndex >= currentPageHistory.length &&
			currentPageHistory.length > 0
		) {
			setSelectedIndex(0);
		}
	}, [currentPage, currentPageHistory.length, selectedIndex]);

	useInput((input, key) => {
		if (key.escape) {
			dispatch({ type: ActionType.SetView, view: ViewState.Query });
		}

		// Navigation within current page
		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		}
		if (key.downArrow && selectedIndex < currentPageHistory.length - 1) {
			setSelectedIndex(selectedIndex + 1);
		}

		// Page navigation
		if (key.pageUp && currentPage > 0) {
			setCurrentPage(currentPage - 1);
			setSelectedIndex(0); // Reset selection to top of new page
		}
		if (key.pageDown && currentPage < totalPages - 1) {
			setCurrentPage(currentPage + 1);
			setSelectedIndex(0); // Reset selection to top of new page
		}

		// Keyboard shortcuts for page navigation
		if (key.ctrl && input === "n" && currentPage < totalPages - 1) {
			setCurrentPage(currentPage + 1);
			setSelectedIndex(0);
		}
		if (key.ctrl && input === "p" && currentPage > 0) {
			setCurrentPage(currentPage - 1);
			setSelectedIndex(0);
		}

		if (input === "r" && selectedQuery) {
			// Re-run the selected query
			dispatch({
				type: ActionType.SetPendingQueryText,
				query: selectedQuery.query,
			});
			dispatch({ type: ActionType.SetView, view: ViewState.Query });
		}
		if (input === "c" && selectedQuery) {
			// Copy query to clipboard
			void (async () => {
				const { copyToClipboard } = await import("../utils/clipboard.js");
				const success = await copyToClipboard(selectedQuery.query);
				if (success) {
					dispatch({
						type: ActionType.AddNotification,
						notification: {
							id: `copy-${Date.now()}`,
							message: "Query copied to clipboard",
							level: "info",
							createdAt: Date.now(),
						},
					});
				} else {
					dispatch({
						type: ActionType.AddNotification,
						notification: {
							id: `copy-error-${Date.now()}`,
							message: "Failed to copy query to clipboard",
							level: "error",
							createdAt: Date.now(),
						},
					});
				}
			})();
		}
	});

	const formatDuration = (ms: number) => {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleString();
	};

	return (
		<ViewBuilder
			title="Query History"
			subtitle={`${validHistory.length} quer${validHistory.length === 1 ? "y" : "ies"} in history`}
			footer="↑/↓: Navigate | PageUp/Down: Pages | r: Re-run | c: Copy | Esc: Back"
		>
			{validHistory.length === 0 ? (
				<Box flexDirection="column">
					<Text color="gray">No queries in history.</Text>
					<Text color="gray">Execute some SQL queries to see them here.</Text>
				</Box>
			) : (
				<Box flexDirection="column">
					{/* Header Section */}
					<Box marginBottom={1}>
						<Box marginBottom={1}>
							<Text color="blue" bold>
								Recent Queries:
							</Text>
						</Box>

						{/* Pagination Controls */}
						{totalPages > 1 && (
							<Box marginBottom={1}>
								<Text color="cyan">
									Page {currentPage + 1} of {totalPages} (Queries{" "}
									{startIndex + 1}-{endIndex} of {validHistory.length})
								</Text>
								<Text color="gray" dimColor>
									PgUp/PgDown or Ctrl+N/P: Navigate pages
								</Text>
							</Box>
						)}

						<Box marginBottom={1}>
							<Text color="gray" dimColor>
								↑/↓ Navigate • r Re-run • c Copy • Esc Back
							</Text>
						</Box>
					</Box>

					{/* Query List */}
					<Box flexDirection="column" marginBottom={1}>
						{currentPageHistory.map((item, index) => (
							<Box
								key={item.id}
								flexDirection="column"
								marginBottom={1}
								paddingX={1}
								borderStyle={index === selectedIndex ? "single" : undefined}
								borderColor={index === selectedIndex ? "cyan" : undefined}
							>
								{/* Header Row */}
								<Box flexDirection="row" justifyContent="space-between">
									<Box flexDirection="row">
										<Text
											color={
												index === selectedIndex
													? "cyan"
													: item.error
														? "red"
														: "green"
											}
										>
											{item.error ? "✗" : "✓"}
										</Text>
										<Text color={index === selectedIndex ? "white" : "gray"}>
											{" "}
											{formatDate(item.executedAt)}
										</Text>
									</Box>
									<Box flexDirection="row">
										<Text color={index === selectedIndex ? "white" : "gray"}>
											{formatDuration(item.durationMs)}
										</Text>
										<Text color={index === selectedIndex ? "cyan" : "gray"}>
											{" • "}
											{item.rowCount} rows
										</Text>
									</Box>
								</Box>

								{/* Query Text */}
								<Text
									color={index === selectedIndex ? "white" : "gray"}
									dimColor={index !== selectedIndex}
								>
									{item.query.length > 100
										? item.query.substring(0, 97) + "..."
										: item.query}
								</Text>

								{/* Error Message */}
								{item.error && (
									<Text color="red" dimColor>
										Error:{" "}
										{item.error.length > 60
											? item.error.substring(0, 57) + "..."
											: item.error}
									</Text>
								)}
							</Box>
						))}
					</Box>

					{/* Selected Query Details */}
					{selectedQuery && (
						<Box flexDirection="column">
							<Box marginBottom={1}>
								<Text color="cyan" bold>
									Selected Query Details:
								</Text>
							</Box>

							<Box
								flexDirection="column"
								paddingX={1}
								borderStyle="single"
								borderColor="cyan"
							>
								{/* Query Text */}
								<Box marginBottom={1}>
									<Text color="white" wrap="wrap">
										{selectedQuery.query}
									</Text>
								</Box>

								{/* Separator */}
								<Box marginBottom={1}>
									<Text color="gray" dimColor>
										{"─".repeat(50)}
									</Text>
								</Box>

								{/* Metadata */}
								<Box flexDirection="column">
									<Text color="gray">
										Executed: {formatDate(selectedQuery.executedAt)}
									</Text>
									<Text color="gray">
										Duration: {formatDuration(selectedQuery.durationMs)}
									</Text>
									<Text color="gray">
										Rows Affected: {selectedQuery.rowCount}
									</Text>
									{selectedQuery.error && (
										<Box marginTop={1}>
											<Text color="red">Error:</Text>
											<Text color="red" dimColor wrap="wrap">
												{selectedQuery.error}
											</Text>
										</Box>
									)}
								</Box>
							</Box>
						</Box>
					)}
				</Box>
			)}
		</ViewBuilder>
	);
};

import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { ColumnsView } from "./components/ColumnsView.js";
import { ConnectionView } from "./components/ConnectionView.js";
import { DataPreviewView } from "./components/DataPreviewView.js";
import { DBTypeView } from "./components/DBTypeView.js";
import { IndexesView } from "./components/IndexesView.js";
import { QueryHistoryView } from "./components/QueryHistoryView.js";
import { QueryView } from "./components/QueryView.js";
import { RelationshipsView } from "./components/RelationshipsView.js";
import { RowDetailView } from "./components/RowDetailView.js";
import { SavedConnectionsView } from "./components/SavedConnectionsView.js";
import { SearchView } from "./components/SearchView.js";
import { TablesView } from "./components/TablesView.js";
import { ActionType } from "./state/actions.js";
import { AppProvider, useAppDispatch, useAppState } from "./state/context.js";
import { initializeApp } from "./state/effects.js";
import { ViewState } from "./types/state.js";

const AppContent: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const scheduledNotifications = useRef(new Set<string>());

	useEffect(() => {
		void initializeApp(dispatch);
	}, [dispatch]);

	const handleGoHome = useCallback(() => {
		dispatch({ type: ActionType.ClearActiveConnection });
		dispatch({ type: ActionType.SetView, view: ViewState.DBType });
	}, [dispatch]);

	useInput((input, key) => {
		if (key.escape) {
			// Only go home from root level views, not from sub-navigation
			if (
				state.currentView === ViewState.Tables ||
				state.currentView === ViewState.SavedConnections ||
				state.currentView === ViewState.Connection ||
				state.currentView === ViewState.DBType
			) {
				handleGoHome();
			}
			// For other views, let the component's local useInput handle navigation
		}
		// Only handle 'h' for help when not in QueryView or TablesView
		// (QueryView handles 'h' for history in command mode, TablesView handles 'h' for history too)
		if (
			(input === "h" || input === "?") &&
			state.currentView !== ViewState.Query &&
			state.currentView !== ViewState.Tables &&
			state.currentView !== ViewState.Search
		) {
			dispatch({ type: ActionType.SetView, view: ViewState.Help });
		}
	});

	useEffect(() => {
		const timers: Array<{ id: string; timer: ReturnType<typeof setTimeout> }> =
			[];

		state.notifications.forEach((notification) => {
			if (scheduledNotifications.current.has(notification.id)) {
				return;
			}
			scheduledNotifications.current.add(notification.id);
			const timer = setTimeout(() => {
				dispatch({ type: ActionType.RemoveNotification, id: notification.id });
				scheduledNotifications.current.delete(notification.id);
			}, 4000);
			timers.push({ id: notification.id, timer });
		});

		return () => {
			timers.forEach(({ id, timer }) => {
				clearTimeout(timer);
				scheduledNotifications.current.delete(id);
			});
		};
	}, [dispatch, state.notifications]);

	const renderView = () => {
		switch (state.currentView) {
			case ViewState.DBType:
				return <DBTypeView />;
			case ViewState.Connection:
				return <ConnectionView />;
			case ViewState.SavedConnections:
				return <SavedConnectionsView />;
			case ViewState.Tables:
				return <TablesView />;
			case ViewState.Columns:
				return <ColumnsView />;
			case ViewState.DataPreview:
				return <DataPreviewView />;
			case ViewState.Query:
				return <QueryView />;
			case ViewState.Search:
				return <SearchView />;
			case ViewState.QueryHistory:
				return <QueryHistoryView />;
			case ViewState.RowDetail:
				return <RowDetailView />;
			case ViewState.Relationships:
				return <RelationshipsView />;
			case ViewState.Indexes:
				return <IndexesView />;
			case ViewState.Help:
				return (
					<Box flexDirection="column">
						<Text color="green">Help</Text>
						<Text>Press Esc to go back to database selection.</Text>
						<Text>
							Use arrow keys / Enter to select options. Type connection strings
							and press Enter to connect.
						</Text>
					</Box>
				);
			default:
				return (
					<Box>
						<Text color="red">Unknown view: {state.currentView}</Text>
					</Box>
				);
		}
	};

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Text color="cyan" bold>
				Mirador
			</Text>
			{state.loading && (
				<Box marginTop={1}>
					<Text color="yellow">
						<Spinner type="dots" /> Loading…
					</Text>
				</Box>
			)}
			<Box marginTop={1} flexDirection="column">
				{state.errorMessage && (
					<Text color="red">Error: {state.errorMessage}</Text>
				)}
				{state.infoMessage && (
					<Text color="green">Info: {state.infoMessage}</Text>
				)}
				{state.notifications.map((note) => (
					<Text
						key={note.id}
						color={
							note.level === "error"
								? "red"
								: note.level === "warning"
									? "yellow"
									: "cyan"
						}
					>
						{note.message}
					</Text>
				))}
				<Box marginTop={1}>{renderView()}</Box>
			</Box>
		</Box>
	);
};

export const App: React.FC = () => (
	<AppProvider>
		<AppContent />
	</AppProvider>
);

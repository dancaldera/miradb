import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { ColumnsView } from "./components/ColumnsView.js";
import { ConnectionView } from "./components/ConnectionView.js";
import { ContextOverviewView } from "./components/ContextOverviewView.js";
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
import { APP_VERSION } from "./version.js";

const AppContent: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const scheduledNotifications = useRef(new Set<string>());
	const previousViewRef = useRef<ViewState | null>(null);

	useEffect(() => {
		void initializeApp(dispatch);
	}, [dispatch]);

	const handleGoHome = useCallback(() => {
		previousViewRef.current = null;
		dispatch({ type: ActionType.ClearActiveConnection });
		dispatch({ type: ActionType.SetView, view: ViewState.DBType });
	}, [dispatch]);

	useInput((input, key) => {
		// Handle Ctrl+S to navigate to saved connections from any view
		if (
			((key.ctrl && input.toLowerCase() === "s") ||
				(!key.ctrl && key.meta && input.toLowerCase() === "s")) &&
			state.currentView !== ViewState.SavedConnections &&
			state.currentView !== ViewState.RowDetail
		) {
			previousViewRef.current = null;
			dispatch({ type: ActionType.SetView, view: ViewState.SavedConnections });
			return;
		}

		if (key.ctrl && input.toLowerCase() === "i") {
			if (state.currentView === ViewState.Context) {
				const target = previousViewRef.current ?? ViewState.DBType;
				previousViewRef.current = null;
				dispatch({ type: ActionType.SetView, view: target });
			} else {
				previousViewRef.current = state.currentView;
				dispatch({ type: ActionType.SetView, view: ViewState.Context });
			}
			return;
		}

		if (key.ctrl && input.toLowerCase() === "k") {
			dispatch({
				type: ActionType.SetShowCommandHints,
				show: !state.showCommandHints,
			});
			return;
		}

		if (key.escape) {
			if (state.currentView === ViewState.Context) {
				const target = previousViewRef.current ?? ViewState.DBType;
				previousViewRef.current = null;
				dispatch({ type: ActionType.SetView, view: target });
				return;
			}
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
	});

	useEffect(() => {
		if (state.currentView !== ViewState.Context) {
			return;
		}
		return () => {
			previousViewRef.current = null;
		};
	}, [state.currentView]);

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
			case ViewState.Context:
				return <ContextOverviewView />;
			default:
				return (
					<Box>
						<Text color="red">Unknown view: {state.currentView}</Text>
					</Box>
				);
		}
	};

	// Generate recent commands summary from view history
	const recentCommands = state.viewHistory
		.slice(-5)
		.map((entry) => entry.summary);

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Text color="cyan" bold>
				SeerDB v{APP_VERSION}
			</Text>
			{state.showCommandHints && (
				<Text color="gray" dimColor>
					Ctrl+I: Context overview • Ctrl+S: Saved connections • Ctrl+K: Toggle
					commands
				</Text>
			)}

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

				{/* Current Interactive View */}
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

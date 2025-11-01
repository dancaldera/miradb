import { produce } from "immer";
import { ViewState, type AppState, initialAppState } from "../types/state.js";
import { ActionType, type AppAction } from "./actions.js";
import { tableCacheKey } from "./cache.js";

export function appReducer(
	state: AppState = initialAppState,
	action: AppAction,
): AppState {
	return produce(state, (draft) => {
		switch (action.type) {
			case ActionType.SetView:
				draft.currentView = action.view;
				draft.infoMessage = null;
				draft.errorMessage = null;
				break;

			case ActionType.SelectDBType:
				draft.dbType = action.dbType;
				draft.currentView = ViewState.Connection;
				break;

			case ActionType.StartLoading:
				draft.loading = true;
				break;

			case ActionType.StopLoading:
				draft.loading = false;
				break;

			case ActionType.SetError:
				draft.errorMessage =
					typeof action.error === "string"
						? action.error
						: action.error.message;
				draft.loading = false;
				break;

			case ActionType.ClearError:
				draft.errorMessage = null;
				break;

			case ActionType.SetInfo:
				draft.infoMessage = action.message;
				break;

			case ActionType.ClearInfo:
				draft.infoMessage = null;
				break;

			case ActionType.SetActiveConnection:
				draft.activeConnection = action.connection;
				break;

			case ActionType.ClearActiveConnection:
				draft.activeConnection = null;
				draft.tables = [];
				draft.columns = [];
				draft.selectedTable = null;
				draft.dataRows = [];
				draft.hasMoreRows = false;
				draft.currentOffset = 0;
				draft.tableCache = {};
				draft.refreshingTableKey = null;
				draft.refreshTimestamps = {};
				draft.notifications = [];
				break;

			case ActionType.SetSavedConnections:
				draft.savedConnections = action.connections;
				break;

			case ActionType.AddSavedConnection:
				draft.savedConnections.push(action.connection);
				break;

			case ActionType.UpdateSavedConnection: {
				const index = draft.savedConnections.findIndex(
					(conn) => conn.id === action.connection.id,
				);
				if (index >= 0) {
					draft.savedConnections[index] = action.connection;
				}
				break;
			}

			case ActionType.RemoveSavedConnection:
				draft.savedConnections = draft.savedConnections.filter(
					(conn) => conn.id !== action.connectionId,
				);
				break;

			case ActionType.SetTables:
				draft.tables = action.tables;
				break;

			case ActionType.SetColumns:
				draft.columns = action.columns;
				{
					const key = tableCacheKey(draft.selectedTable);
					if (key) {
						const cache = draft.tableCache[key] ?? {
							columns: [],
							rows: draft.dataRows,
							hasMore: draft.hasMoreRows,
							offset: draft.currentOffset,
						};
						cache.columns = action.columns;
						draft.tableCache[key] = cache;
					}
				}
				break;

			case ActionType.SetTableCache:
				draft.tableCache = action.cache;
				draft.refreshingTableKey = null;
				break;

			case ActionType.RemoveTableCacheEntry:
				if (action.key in draft.tableCache) {
					delete draft.tableCache[action.key];
				}
				if (tableCacheKey(draft.selectedTable) === action.key) {
					draft.columns = [];
					draft.dataRows = [];
					draft.hasMoreRows = false;
					draft.currentOffset = 0;
					draft.refreshingTableKey = action.key;
				}
				break;

			case ActionType.SetSelectedTable:
				draft.selectedTable = action.table;
				{
					const key = tableCacheKey(action.table);
					const cache = key ? draft.tableCache[key] : undefined;
					if (cache) {
						draft.columns = cache.columns;
						draft.dataRows = cache.rows;
						draft.hasMoreRows = cache.hasMore;
						draft.currentOffset = cache.offset;
					} else {
						draft.columns = [];
						draft.dataRows = [];
						draft.hasMoreRows = false;
						draft.currentOffset = 0;
						if (key) {
							draft.tableCache[key] = {
								columns: [],
								rows: [],
								hasMore: false,
								offset: 0,
							};
						}
					}
					draft.refreshingTableKey = key ?? null;
				}
				break;

			case ActionType.ClearSelectedTable:
				draft.selectedTable = null;
				draft.dataRows = [];
				draft.hasMoreRows = false;
				draft.currentOffset = 0;
				draft.refreshingTableKey = null;
				break;

			case ActionType.SetDataRows:
				draft.dataRows = action.rows;
				{
					const key = tableCacheKey(draft.selectedTable);
					if (key) {
						const cache = draft.tableCache[key] ?? {
							columns: draft.columns,
							rows: [],
							hasMore: draft.hasMoreRows,
							offset: draft.currentOffset,
						};
						cache.rows = action.rows;
						draft.tableCache[key] = cache;
						if (draft.refreshingTableKey === key) {
							draft.refreshingTableKey = null;
						}
					}
				}
				break;

			case ActionType.SetRefreshingTable:
				draft.refreshingTableKey = action.key;
				break;

			case ActionType.SetHasMoreRows:
				draft.hasMoreRows = action.hasMore;
				{
					const key = tableCacheKey(draft.selectedTable);
					if (key) {
						const cache = draft.tableCache[key] ?? {
							columns: draft.columns,
							rows: draft.dataRows,
							hasMore: false,
							offset: draft.currentOffset,
						};
						cache.hasMore = action.hasMore;
						draft.tableCache[key] = cache;
						if (draft.refreshingTableKey === key && !draft.loading) {
							draft.refreshingTableKey = null;
						}
					}
				}
				break;

			case ActionType.SetCurrentOffset:
				draft.currentOffset = action.offset;
				draft.selectedRowIndex = null;
				draft.expandedRow = null;
				{
					const key = tableCacheKey(draft.selectedTable);
					if (key) {
						const cache = draft.tableCache[key] ?? {
							columns: draft.columns,
							rows: draft.dataRows,
							hasMore: draft.hasMoreRows,
							offset: 0,
						};
						cache.offset = action.offset;
						draft.tableCache[key] = cache;
					}
				}
				break;

			case ActionType.SetSelectedRowIndex:
				draft.selectedRowIndex = action.index;
				draft.expandedRow = null;
				break;

			case ActionType.SetExpandedRow:
				draft.expandedRow = action.row;
				break;

			case ActionType.SetColumnVisibilityMode:
				draft.columnVisibilityMode = action.mode;
				break;

			case ActionType.SetRefreshTimestamp:
				draft.refreshTimestamps[action.key] = action.timestamp;
				break;

			case ActionType.AddNotification:
				draft.notifications.push(action.notification);
				break;

			case ActionType.RemoveNotification:
				draft.notifications = draft.notifications.filter(
					(note) => note.id !== action.id,
				);
				break;

			case ActionType.SetQueryHistory:
				draft.queryHistory = action.history || [];
				break;

			case ActionType.AddQueryHistoryItem:
				draft.queryHistory.unshift(action.item);
				break;

			case ActionType.SetSortConfig:
				draft.sortConfig = action.sortConfig;
				break;

			case ActionType.SetFilterValue:
				draft.filterValue = action.filterValue;
				break;

			default:
				return state;
		}
	});
}

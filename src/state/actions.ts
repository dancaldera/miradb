import type { DatabaseError } from "../database/errors.js";
import type {
	BreadcrumbSegment,
	ColumnInfo,
	ColumnVisibilityMode,
	ConnectionInfo,
	DataRow,
	DBType,
	Notification,
	QueryHistoryItem,
	SortConfig,
	TableCacheEntry,
	TableInfo,
	ViewHistoryEntry,
	ViewState,
} from "../types/state.js";

export enum ActionType {
	SetView = "SET_VIEW",
	SelectDBType = "SELECT_DB_TYPE",
	SetDBType = "SET_DB_TYPE",
	StartLoading = "START_LOADING",
	StopLoading = "STOP_LOADING",
	SetError = "SET_ERROR",
	ClearError = "CLEAR_ERROR",
	SetInfo = "SET_INFO",
	ClearInfo = "CLEAR_INFO",
	SetActiveConnection = "SET_ACTIVE_CONNECTION",
	ClearActiveConnection = "CLEAR_ACTIVE_CONNECTION",
	SetSavedConnections = "SET_SAVED_CONNECTIONS",
	AddSavedConnection = "ADD_SAVED_CONNECTION",
	UpdateSavedConnection = "UPDATE_SAVED_CONNECTION",
	RemoveSavedConnection = "REMOVE_SAVED_CONNECTION",
	SetTables = "SET_TABLES",
	SetColumns = "SET_COLUMNS",
	SetSelectedTable = "SET_SELECTED_TABLE",
	ClearSelectedTable = "CLEAR_SELECTED_TABLE",
	SetDataRows = "SET_DATA_ROWS",
	SetHasMoreRows = "SET_HAS_MORE_ROWS",
	SetCurrentOffset = "SET_CURRENT_OFFSET",
	SetSelectedRowIndex = "SET_SELECTED_ROW_INDEX",
	SetExpandedRow = "SET_EXPANDED_ROW",
	SetColumnVisibilityMode = "SET_COLUMN_VISIBILITY_MODE",
	SetTableCache = "SET_TABLE_CACHE",
	RemoveTableCacheEntry = "REMOVE_TABLE_CACHE_ENTRY",
	SetRefreshingTable = "SET_REFRESHING_TABLE",
	SetRefreshTimestamp = "SET_REFRESH_TIMESTAMP",
	AddNotification = "ADD_NOTIFICATION",
	RemoveNotification = "REMOVE_NOTIFICATION",
	SetQueryHistory = "SET_QUERY_HISTORY",
	AddQueryHistoryItem = "ADD_QUERY_HISTORY_ITEM",
	SetSortConfig = "SET_SORT_CONFIG",
	SetFilterValue = "SET_FILTER_VALUE",
	ExportData = "EXPORT_DATA",
	SetSearchTerm = "SET_SEARCH_TERM",
	SetSearchResultsPage = "SET_SEARCH_RESULTS_PAGE",
	SetSearchSelectedIndex = "SET_SEARCH_SELECTED_INDEX",
	ClearSearch = "CLEAR_SEARCH",
	AddViewHistoryEntry = "ADD_VIEW_HISTORY_ENTRY",
	SetBreadcrumbs = "SET_BREADCRUMBS",
	AddBreadcrumb = "ADD_BREADCRUMB",
	ClearHistory = "CLEAR_HISTORY",
}

export type AppAction =
	| { type: ActionType.SetView; view: ViewState }
	| { type: ActionType.SelectDBType; dbType: DBType }
	| { type: ActionType.SetDBType; dbType: DBType }
	| { type: ActionType.StartLoading }
	| { type: ActionType.StopLoading }
	| { type: ActionType.SetError; error: string | DatabaseError }
	| { type: ActionType.ClearError }
	| { type: ActionType.SetInfo; message: string }
	| { type: ActionType.ClearInfo }
	| { type: ActionType.SetActiveConnection; connection: ConnectionInfo }
	| { type: ActionType.ClearActiveConnection }
	| { type: ActionType.SetSavedConnections; connections: ConnectionInfo[] }
	| { type: ActionType.AddSavedConnection; connection: ConnectionInfo }
	| { type: ActionType.UpdateSavedConnection; connection: ConnectionInfo }
	| { type: ActionType.RemoveSavedConnection; connectionId: string }
	| { type: ActionType.SetTables; tables: TableInfo[] }
	| { type: ActionType.SetColumns; columns: ColumnInfo[] }
	| { type: ActionType.SetSelectedTable; table: TableInfo }
	| { type: ActionType.ClearSelectedTable }
	| { type: ActionType.SetDataRows; rows: DataRow[] }
	| { type: ActionType.SetHasMoreRows; hasMore: boolean }
	| { type: ActionType.SetCurrentOffset; offset: number }
	| { type: ActionType.SetSelectedRowIndex; index: number | null }
	| { type: ActionType.SetExpandedRow; row: DataRow | null }
	| { type: ActionType.SetColumnVisibilityMode; mode: ColumnVisibilityMode }
	| { type: ActionType.SetTableCache; cache: Record<string, TableCacheEntry> }
	| { type: ActionType.RemoveTableCacheEntry; key: string }
	| { type: ActionType.SetRefreshingTable; key: string | null }
	| { type: ActionType.SetRefreshTimestamp; key: string; timestamp: number }
	| { type: ActionType.AddNotification; notification: Notification }
	| { type: ActionType.RemoveNotification; id: string }
	| { type: ActionType.SetQueryHistory; history: QueryHistoryItem[] }
	| { type: ActionType.AddQueryHistoryItem; item: QueryHistoryItem }
	| { type: ActionType.SetSortConfig; sortConfig: SortConfig }
	| { type: ActionType.SetFilterValue; filterValue: string }
	| {
			type: ActionType.ExportData;
			format: "csv" | "json";
			includeHeaders: boolean;
	  }
	| { type: ActionType.SetSearchTerm; term: string }
	| {
			type: ActionType.SetSearchResultsPage;
			rows: DataRow[];
			totalCount: number;
			offset: number;
			hasMore: boolean;
	  }
	| { type: ActionType.SetSearchSelectedIndex; index: number | null }
	| { type: ActionType.ClearSearch }
	| { type: ActionType.AddViewHistoryEntry; entry: ViewHistoryEntry }
	| { type: ActionType.SetBreadcrumbs; breadcrumbs: BreadcrumbSegment[] }
	| { type: ActionType.AddBreadcrumb; breadcrumb: BreadcrumbSegment }
	| { type: ActionType.ClearHistory };

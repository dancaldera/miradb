export enum ViewState {
  DBType = 'DB_TYPE',
  Connection = 'CONNECTION',
  SavedConnections = 'SAVED_CONNECTIONS',
  Tables = 'TABLES',
  Columns = 'COLUMNS',
  DataPreview = 'DATA_PREVIEW',
  Query = 'QUERY',
  QueryHistory = 'QUERY_HISTORY',
  RowDetail = 'ROW_DETAIL',
  Relationships = 'RELATIONSHIPS',
  Indexes = 'INDEXES',
  Help = 'HELP'
}

export enum DBType {
  PostgreSQL = 'postgresql',
  MySQL = 'mysql',
  SQLite = 'sqlite'
}

export interface ConnectionInfo {
  id: string;
  name: string;
  type: DBType;
  connectionString: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  query: string;
  executedAt: string;
  durationMs: number;
  rowCount: number;
  error?: string;
}

export interface TableInfo {
  schema?: string;
  name: string;
  type: 'table' | 'view' | 'materialized-view';
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignTable?: string;
  foreignColumn?: string;
}

export type DataRow = Record<string, unknown>;

export interface TableCacheEntry {
  columns: ColumnInfo[];
  rows: DataRow[];
  hasMore: boolean;
  offset: number;
}

export type NotificationLevel = 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  message: string;
  level: NotificationLevel;
  createdAt: number;
}

export interface AppState {
  currentView: ViewState;
  dbType: DBType | null;
  activeConnection: ConnectionInfo | null;
  savedConnections: ConnectionInfo[];
  tables: TableInfo[];
  columns: ColumnInfo[];
  selectedTable: TableInfo | null;
  dataRows: DataRow[];
  hasMoreRows: boolean;
  currentOffset: number;
  tableCache: Record<string, TableCacheEntry>;
  refreshingTableKey: string | null;
  refreshTimestamps: Record<string, number>;
  notifications: Notification[];
  queryHistory: QueryHistoryItem[];
  loading: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
}

export const initialAppState: AppState = {
  currentView: ViewState.DBType,
  dbType: null,
  activeConnection: null,
  savedConnections: [],
  tables: [],
  columns: [],
  selectedTable: null,
  dataRows: [],
  hasMoreRows: false,
  currentOffset: 0,
  tableCache: {},
  refreshingTableKey: null,
  refreshTimestamps: {},
  notifications: [],
  queryHistory: [],
  loading: false,
  errorMessage: null,
  infoMessage: null
};

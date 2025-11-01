import { Box, Text } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import { createDatabaseConnection } from "../database/connection.js";
import { ActionType } from "../state/actions.js";
import { useAppDispatch, useAppState } from "../state/context.js";
import type { TableInfo } from "../types/state.js";
import { DBType } from "../types/state.js";
import { ViewBuilder } from "./ViewBuilder.js";

interface Index {
	name: string;
	tableName: string;
	columns: string[];
	isUnique: boolean;
	isPrimary: boolean;
	type?: string;
}

export const IndexesView: React.FC = () => {
	const state = useAppState();
	const dispatch = useAppDispatch();
	const [indexes, setIndexes] = useState<Index[]>([]);
	const [loading, setLoading] = useState(false);

	const table = state.selectedTable;
	const activeConnection = state.activeConnection;
	const dbType = state.dbType;

	useEffect(() => {
		if (!activeConnection || !dbType || !table) {
			setIndexes([]);
			return;
		}

		let isMounted = true;

		const fetchIndexes = async () => {
			setLoading(true);
			let connection: ReturnType<typeof createDatabaseConnection> | null = null;
			try {
				connection = createDatabaseConnection({
					type: dbType,
					connectionString: activeConnection.connectionString,
				});
				await connection.connect();

				let query: string;
				const params: unknown[] = [];

				switch (dbType) {
					case DBType.PostgreSQL: {
						const schemaName = table.schema ?? "public";
						const tableName = table.name;
						query = `
              SELECT
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary,
                am.amname as index_type
              FROM pg_class t
              JOIN pg_index ix ON t.oid = ix.indrelid
              JOIN pg_class i ON i.oid = ix.indexrelid
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
              JOIN pg_am am ON i.relam = am.oid
              JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE t.relkind = 'r'
                AND t.relname = $1
                AND n.nspname = $2
              ORDER BY i.relname, a.attnum

            `;
						params.push(tableName, schemaName);
						break;
					}

					case DBType.MySQL:
						query = `
              SELECT
                INDEX_NAME as index_name,
                COLUMN_NAME as column_name,
                NON_UNIQUE = 0 as is_unique,
                INDEX_NAME = 'PRIMARY' as is_primary,
                INDEX_TYPE as index_type
              FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
              ORDER BY INDEX_NAME, SEQ_IN_INDEX

            `;
						params.push(table.name);
						break;

					case DBType.SQLite:
						query = `PRAGMA index_list(?)`;
						params.push(table.name);
						break;

					default:
						throw new Error(`Unsupported database type: ${dbType}`);
				}

				const result = await connection.query(query, params);

				let formattedIndexes: Index[] = [];

				if (dbType === DBType.SQLite) {
					// SQLite returns different format, need to get column info separately
					const indexList = result.rows as Array<Record<string, unknown>>;
					for (const indexRow of indexList) {
						const columnsQuery = `PRAGMA index_info(?)`;
						const columnsResult = await connection.query(columnsQuery, [
							indexRow.name,
						]);

						const columnNames = columnsResult.rows.map(
							(row: Record<string, unknown>) => String(row.name ?? ""),
						);
						formattedIndexes.push({
							name: String(indexRow.name ?? ""),
							tableName: renderTableName(table),
							columns: columnNames,
							isUnique: Boolean(indexRow.unique),
							isPrimary: String(indexRow.name ?? "").startsWith(
								`sqlite_autoindex_${table.name}`,
							),
						});
					}
				} else {
					// Group by index name and collect columns
					const indexMap = new Map<string, Index>();

					for (const row of result.rows as Array<Record<string, unknown>>) {
						const indexName = String(row.index_name ?? "");

						if (!indexMap.has(indexName)) {
							indexMap.set(indexName, {
								name: indexName,
								tableName: renderTableName(table),
								columns: [],
								isUnique: Boolean(row.is_unique),
								isPrimary: Boolean(row.is_primary),
								type: row.index_type ? String(row.index_type) : undefined,
							});
						}

						const index = indexMap.get(indexName)!;
						const columnName = String(row.column_name ?? "");
						if (columnName && !index.columns.includes(columnName)) {
							index.columns.push(columnName);
						}
					}

					formattedIndexes = Array.from(indexMap.values());
				}

				if (isMounted) {
					setIndexes(formattedIndexes);
				}
			} catch (error) {
				dispatch({
					type: ActionType.SetError,
					error:
						error instanceof Error ? error.message : "Failed to fetch indexes",
				});
			} finally {
				if (connection) {
					try {
						await connection.close();
					} catch {
						// ignore close errors
					}
				}
				if (isMounted) {
					setLoading(false);
				}
			}
		};

		void fetchIndexes();

		return () => {
			isMounted = false;
		};
	}, [activeConnection, dbType, table, dispatch]);

	const primaryKeys = indexes.filter((i) => i.isPrimary);
	const uniqueIndexes = indexes.filter((i) => i.isUnique && !i.isPrimary);
	const nonUniqueIndexes = indexes.filter((i) => !i.isUnique && !i.isPrimary);

	return (
		<ViewBuilder
			title="Table Indexes"
			subtitle={`Table: ${table ? renderTableName(table) : "Unknown"}`}
			footer="Esc: Back to table view"
		>
			{loading ? (
				<Text color="yellow">Loading indexes...</Text>
			) : (
				<Box flexDirection="column">
					{indexes.length === 0 ? (
						<Box flexDirection="column">
							<Text color="gray">No indexes found for this table.</Text>
							<Text color="gray">
								This table might not have any indexes defined.
							</Text>
						</Box>
					) : (
						<>
							{primaryKeys.length > 0 && (
								<Box flexDirection="column" marginBottom={2}>
									<Text color="green" bold>
										Primary Key Indexes ({primaryKeys.length}):
									</Text>
									{primaryKeys.map((index, indexIndex) => (
										<Box
											key={index.name || indexIndex}
											flexDirection="column"
											paddingX={1}
										>
											<Text color="green">{index.name}</Text>
											<Text color="white">
												Columns: {index.columns.join(", ")}
											</Text>
											{index.type && (
												<Text color="gray" dimColor>
													Type: {index.type}
												</Text>
											)}
										</Box>
									))}
								</Box>
							)}

							{uniqueIndexes.length > 0 && (
								<Box flexDirection="column" marginBottom={2}>
									<Text color="blue" bold>
										Unique Indexes ({uniqueIndexes.length}):
									</Text>
									{uniqueIndexes.map((index, indexIndex) => (
										<Box
											key={index.name || indexIndex}
											flexDirection="column"
											paddingX={1}
										>
											<Text color="blue">{index.name}</Text>
											<Text color="white">
												Columns: {index.columns.join(", ")}
											</Text>
											{index.type && (
												<Text color="gray" dimColor>
													Type: {index.type}
												</Text>
											)}
										</Box>
									))}
								</Box>
							)}

							{nonUniqueIndexes.length > 0 && (
								<Box flexDirection="column" marginBottom={2}>
									<Text color="yellow" bold>
										Non-Unique Indexes ({nonUniqueIndexes.length}):
									</Text>
									{nonUniqueIndexes.map((index, indexIndex) => (
										<Box
											key={index.name || indexIndex}
											flexDirection="column"
											paddingX={1}
										>
											<Text color="yellow">{index.name}</Text>
											<Text color="white">
												Columns: {index.columns.join(", ")}
											</Text>
											{index.type && (
												<Text color="gray" dimColor>
													Type: {index.type}
												</Text>
											)}
										</Box>
									))}
								</Box>
							)}
						</>
					)}

					<Box marginTop={1}>
						<Text color="gray" dimColor>
							Total indexes: {indexes.length}
						</Text>
						<Text color="gray" dimColor>
							Primary: {primaryKeys.length} • Unique: {uniqueIndexes.length} •
							Non-unique: {nonUniqueIndexes.length}
						</Text>
					</Box>
				</Box>
			)}
		</ViewBuilder>
	);
};

function renderTableName(table: TableInfo): string {
	return table.schema ? `${table.schema}.${table.name}` : table.name;
}

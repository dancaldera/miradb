import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type {
	ColumnInfo,
	ConnectionInfo,
	QueryHistoryItem,
	TableCacheEntry,
} from "../types/state.js";
import { DBType } from "../types/state.js";

const dataDir = path.join(os.homedir(), ".mirador");
const connectionsPath = path.join(dataDir, "connections.json");
const historyPath = path.join(dataDir, "query-history.json");
const tableCachePath = path.join(dataDir, "table-cache.json");

const connectionSchema: z.ZodType<ConnectionInfo> = z.object({
	id: z.string(),
	name: z.string(),
	type: z.nativeEnum(DBType),
	connectionString: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const queryHistoryItemSchema: z.ZodType<QueryHistoryItem> = z.object({
	id: z.string(),
	connectionId: z.string(),
	query: z.string(),
	executedAt: z.string(),
	durationMs: z.number(),
	rowCount: z.number(),
	error: z.string().optional(),
});

const columnSchema: z.ZodType<ColumnInfo> = z.object({
	name: z.string(),
	dataType: z.string(),
	nullable: z.boolean(),
	defaultValue: z.string().nullable().optional(),
	isPrimaryKey: z.boolean().optional(),
	isForeignKey: z.boolean().optional(),
	foreignTable: z.string().optional(),
	foreignColumn: z.string().optional(),
});

const tableCacheEntrySchema: z.ZodType<TableCacheEntry> = z.object({
	columns: z.array(columnSchema),
	rows: z.array(z.record(z.string(), z.unknown())),
	hasMore: z.boolean(),
	offset: z.number(),
});

async function ensureDataDirectory(): Promise<void> {
	try {
		await mkdir(dataDir, { recursive: true });
	} catch (error) {
		throw new Error(
			`Failed to ensure data directory: ${(error as Error).message}`,
		);
	}
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

export interface ConnectionsLoadResult {
	connections: ConnectionInfo[];
	normalized: number;
	skipped: number;
}

export async function loadConnections(): Promise<ConnectionsLoadResult> {
	await ensureDataDirectory();
	if (!(await fileExists(connectionsPath))) {
		return { connections: [], normalized: 0, skipped: 0 };
	}

	const content = await readFile(connectionsPath, "utf-8");
	if (!content.trim()) {
		return { connections: [], normalized: 0, skipped: 0 };
	}

	const data = JSON.parse(content);
	if (!Array.isArray(data)) {
		console.warn("Expected array while parsing connections, using empty list.");
		return {
			connections: [],
			normalized: 0,
			skipped: Array.isArray(data) ? 0 : 1,
		};
	}

	const connections: ConnectionInfo[] = [];
	let normalizedCount = 0;
	let skippedCount = 0;
	data.forEach((entry, index) => {
		const normalized = normalizeConnectionEntry(entry);
		if (normalized) {
			if (normalized._normalized) {
				normalizedCount += 1;
				delete normalized._normalized;
			}
			connections.push(normalized);
		} else {
			console.warn(`Skipping invalid connection entry at index ${index}.`);
			skippedCount += 1;
		}
	});

	return { connections, normalized: normalizedCount, skipped: skippedCount };
}

export async function saveConnections(
	connections: ConnectionInfo[],
): Promise<void> {
	await ensureDataDirectory();
	const data = JSON.stringify(connections, null, 2);
	await writeFile(connectionsPath, data, "utf-8");
}

export async function loadQueryHistory(): Promise<QueryHistoryItem[]> {
	await ensureDataDirectory();
	if (!(await fileExists(historyPath))) {
		return [];
	}

	const content = await readFile(historyPath, "utf-8");
	if (!content.trim()) {
		return [];
	}

	return parseArray(JSON.parse(content), queryHistoryItemSchema);
}

export async function saveQueryHistory(
	history: QueryHistoryItem[],
): Promise<void> {
	await ensureDataDirectory();
	const data = JSON.stringify(history, null, 2);
	await writeFile(historyPath, data, "utf-8");
}

async function readTableCacheFile(): Promise<
	Record<string, Record<string, TableCacheEntry>>
> {
	await ensureDataDirectory();

	if (!(await fileExists(tableCachePath))) {
		return {};
	}

	const content = await readFile(tableCachePath, "utf-8");
	if (!content.trim()) {
		return {};
	}

	const data = JSON.parse(content);
	if (typeof data !== "object" || data === null) {
		console.warn("Invalid table cache file, resetting.");
		return {};
	}

	const result: Record<string, Record<string, TableCacheEntry>> = {};

	for (const [connectionId, caches] of Object.entries(
		data as Record<string, unknown>,
	)) {
		if (typeof caches !== "object" || caches === null) {
			console.warn(
				`Skipping table cache for connection ${connectionId}: expected object.`,
			);
			continue;
		}

		const connectionCache: Record<string, TableCacheEntry> = {};
		for (const [tableKey, entry] of Object.entries(
			caches as Record<string, unknown>,
		)) {
			const parsed = safeParse(tableCacheEntrySchema, entry);
			if (parsed) {
				connectionCache[tableKey] = parsed;
			}
		}

		result[connectionId] = connectionCache;
	}

	return result;
}

export async function loadTableCache(
	connectionId: string,
): Promise<Record<string, TableCacheEntry>> {
	const file = await readTableCacheFile();
	return file[connectionId] ?? {};
}

export async function saveTableCache(
	connectionId: string,
	cache: Record<string, TableCacheEntry>,
): Promise<void> {
	const file = await readTableCacheFile();
	file[connectionId] = cache;
	await writeFile(tableCachePath, JSON.stringify(file, null, 2), "utf-8");
}

function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
	const result = schema.safeParse(data);
	if (result.success) {
		return result.data;
	}

	console.warn(
		"Failed to parse persisted data, using defaults:",
		result.error.flatten(),
	);
	return null;
}

function parseArray<T>(data: unknown, schema: z.ZodType<T>): T[] {
	if (!Array.isArray(data)) {
		console.warn(
			"Expected array while parsing persisted data, using empty list.",
		);
		return [];
	}

	const items: T[] = [];
	data.forEach((item, index) => {
		const parsed = safeParse(schema, item);
		if (parsed) {
			items.push(parsed);
		} else {
			console.warn(`Skipping invalid entry at index ${index}.`);
		}
	});
	return items;
}

type ConnectionWithMarker = ConnectionInfo & { _normalized?: boolean };

function normalizeConnectionEntry(entry: unknown): ConnectionWithMarker | null {
	const parsed = connectionSchema.safeParse(entry);
	if (parsed.success) {
		return parsed.data;
	}

	if (!entry || typeof entry !== "object") {
		console.warn("Connection entry is not an object.");
		return null;
	}

	const record = entry as Record<string, unknown>;
	const name =
		typeof record.name === "string" ? record.name : "Legacy connection";
	const driver = getLegacyString(record, ["driver", "type"]);
	const connectionString = getLegacyString(record, [
		"connection_str",
		"connectionString",
	]);

	if (!driver || !connectionString) {
		console.warn("Legacy connection missing driver or connection string.");
		return null;
	}

	const dbType = mapDriverToDBType(driver);
	if (!dbType) {
		console.warn(`Unsupported legacy driver value: ${driver}`);
		return null;
	}

	const timestamp = new Date().toISOString();
	const fallbackConnection = {
		id: createDeterministicId(`${name}:${connectionString}`),
		name,
		type: dbType,
		connectionString,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	const normalized = connectionSchema.safeParse(fallbackConnection);
	if (normalized.success) {
		return { ...normalized.data, _normalized: true };
	}

	console.warn("Unable to normalize legacy connection entry.");
	return null;
}

function getLegacyString(
	record: Record<string, unknown>,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return undefined;
}

function mapDriverToDBType(driver: string): DBType | null {
	const normalized = driver.toLowerCase();
	switch (normalized) {
		case "postgres":
		case "postgresql":
		case "pg":
			return DBType.PostgreSQL;
		case "mysql":
			return DBType.MySQL;
		case "sqlite":
		case "sqlite3":
			return DBType.SQLite;
		default:
			return null;
	}
}

function createDeterministicId(value: string): string {
	return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

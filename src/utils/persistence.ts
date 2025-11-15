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
import { DebouncedWriter } from "./debounced-writer.js";

let dataDir = process.env.SEERDB_DATA_DIR ?? path.join(os.homedir(), ".seerdb");

function resolveDataPath(filename: string): string {
	return path.join(dataDir, filename);
}

export function setPersistenceDataDirectory(dir: string): void {
	dataDir = dir;
}

// Debounced writers for cache operations (500ms delay, batched writes)
const tableCacheWriter = new DebouncedWriter<
	Record<string, Record<string, TableCacheEntry>>
>(async (data) => {
	await writeFile(
		resolveDataPath("table-cache.json"),
		JSON.stringify(data, null, 2),
		"utf-8",
	);
}, 500);

const connectionsWriter = new DebouncedWriter<ConnectionInfo[]>(
	async (data) => {
		await writeFile(
			resolveDataPath("connections.json"),
			JSON.stringify(data, null, 2),
			"utf-8",
		);
	},
	500,
);

const queryHistoryWriter = new DebouncedWriter<QueryHistoryItem[]>(
	async (data) => {
		await writeFile(
			resolveDataPath("query-history.json"),
			JSON.stringify(data, null, 2),
			"utf-8",
		);
	},
	500,
);

// Flush all pending writes on process exit
process.on("beforeExit", () => {
	void Promise.all([
		tableCacheWriter.flush(),
		connectionsWriter.flush(),
		queryHistoryWriter.flush(),
	]);
});

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
	const targetPath = resolveDataPath("connections.json");
	if (!(await fileExists(targetPath))) {
		return { connections: [], normalized: 0, skipped: 0 };
	}

	const content = await readFile(targetPath, "utf-8");
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

	const deduped: ConnectionInfo[] = [];
	const byKey = new Map<string, ConnectionInfo>();
	connections.forEach((connection) => {
		const key = `${connection.type}|${connection.connectionString}`;
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, connection);
			deduped.push(connection);
			return;
		}

		const existingTime = Date.parse(existing.updatedAt ?? "");
		const currentTime = Date.parse(connection.updatedAt ?? "");
		const shouldReplace =
			!Number.isNaN(currentTime) && currentTime > existingTime;
		if (shouldReplace) {
			const idx = deduped.indexOf(existing);
			if (idx !== -1) {
				deduped[idx] = connection;
			}
			byKey.set(key, connection);
		}
		skippedCount += 1;
	});

	return {
		connections: deduped,
		normalized: normalizedCount,
		skipped: skippedCount,
	};
}

export async function saveConnections(
	connections: ConnectionInfo[],
	flush = false,
): Promise<void> {
	await ensureDataDirectory();
	if (flush) {
		// For testing: write immediately to catch errors
		await writeFile(
			resolveDataPath("connections.json"),
			JSON.stringify(connections, null, 2),
			"utf-8",
		);
	} else {
		// Use debounced writer to batch connection saves
		connectionsWriter.write(connections);
	}
}

export async function loadQueryHistory(): Promise<QueryHistoryItem[]> {
	await ensureDataDirectory();
	const targetPath = resolveDataPath("query-history.json");
	if (!(await fileExists(targetPath))) {
		return [];
	}

	const content = await readFile(targetPath, "utf-8");
	if (!content.trim()) {
		return [];
	}

	return parseArray(JSON.parse(content), queryHistoryItemSchema);
}

export async function saveQueryHistory(
	history: QueryHistoryItem[],
	flush = false,
): Promise<void> {
	await ensureDataDirectory();
	if (flush) {
		// For testing: write immediately to catch errors
		await writeFile(
			resolveDataPath("query-history.json"),
			JSON.stringify(history, null, 2),
			"utf-8",
		);
	} else {
		// Use debounced writer to batch query history saves
		queryHistoryWriter.write(history);
	}
}

async function readTableCacheFile(): Promise<
	Record<string, Record<string, TableCacheEntry>>
> {
	await ensureDataDirectory();

	const targetPath = resolveDataPath("table-cache.json");

	if (!(await fileExists(targetPath))) {
		return {};
	}

	const content = await readFile(targetPath, "utf-8");
	if (!content.trim()) {
		return {};
	}

	let data: unknown;
	try {
		data = JSON.parse(content);
	} catch (error) {
		console.warn("Invalid table cache file, resetting.", error);
		return {};
	}
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
	flush = false,
): Promise<void> {
	const file = await readTableCacheFile();
	file[connectionId] = cache;
	if (flush) {
		// For testing: write immediately to catch errors
		await writeFile(
			resolveDataPath("table-cache.json"),
			JSON.stringify(file, null, 2),
			"utf-8",
		);
	} else {
		// Use debounced writer to batch multiple cache updates
		tableCacheWriter.write(file);
	}
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

export const __persistenceInternals = {
	normalizeConnectionEntry,
	connectionSchema,
} as const;

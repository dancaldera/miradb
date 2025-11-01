import type { TableInfo } from "../types/state.js";

export function tableCacheKey(
	table: TableInfo | null | undefined,
): string | null {
	if (!table) return null;
	return `${table.schema ?? "default"}|${table.name}`;
}

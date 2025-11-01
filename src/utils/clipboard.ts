import clipboardy from "clipboardy";

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await clipboardy.write(text);
		return true;
	} catch (error) {
		console.warn("Failed to copy to clipboard:", error);
		return false;
	}
}

export async function pasteFromClipboard(): Promise<string | null> {
	try {
		const text = await clipboardy.read();
		return text;
	} catch (error) {
		console.warn("Failed to paste from clipboard:", error);
		return null;
	}
}

export function formatRowForClipboard(
	row: Record<string, unknown>,
	columns: Array<{ name: string }>,
): string {
	const values = columns.map((col) => {
		const value = row[col.name];
		if (value === null || value === undefined) return "NULL";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	});
	return values.join("\t");
}

export function formatTableForClipboard(
	rows: Record<string, unknown>[],
	columns: Array<{ name: string }>,
	includeHeaders: boolean = true,
): string {
	const lines: string[] = [];

	if (includeHeaders) {
		lines.push(columns.map((col) => col.name).join("\t"));
	}

	for (const row of rows) {
		lines.push(formatRowForClipboard(row, columns));
	}

	return lines.join("\n");
}

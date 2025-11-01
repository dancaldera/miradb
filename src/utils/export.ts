import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { DataRow, ColumnInfo } from "../types/state.js";
import { formatValueForDisplay } from "./data-processing.js";

export interface ExportOptions {
	format: "csv" | "json";
	includeHeaders: boolean;
	filename?: string;
	outputDir?: string;
}

export async function exportData(
	data: DataRow[],
	columns: ColumnInfo[],
	options: ExportOptions,
): Promise<string> {
	const outputDir = options.outputDir || join(homedir(), ".mirador", "exports");
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const defaultFilename = `export-${timestamp}.${options.format}`;
	const filename = options.filename || defaultFilename;
	const filepath = join(outputDir, filename);

	// Ensure output directory exists
	await mkdir(outputDir, { recursive: true });

	let content: string;

	if (options.format === "csv") {
		content = generateCSV(data, columns, options.includeHeaders);
	} else {
		content = generateJSON(data, columns, options.includeHeaders);
	}

	await writeFile(filepath, content, "utf-8");
	return filepath;
}

function generateCSV(
	data: DataRow[],
	columns: ColumnInfo[],
	includeHeaders: boolean,
): string {
	const lines: string[] = [];

	if (includeHeaders) {
		const headers = columns
			.map((col) => `"${escapeCSVValue(col.name)}"`)
			.join(",");
		lines.push(headers);
	}

	for (const row of data) {
		const values = columns
			.map((col) => {
				const value = row[col.name];
				const formattedValue = formatValueForDisplay(value);
				return `"${escapeCSVValue(formattedValue)}"`;
			})
			.join(",");
		lines.push(values);
	}

	return lines.join("\n");
}

function generateJSON(
	data: DataRow[],
	columns: ColumnInfo[],
	includeHeaders: boolean,
): string {
	if (includeHeaders) {
		// Include metadata about columns
		const metadata = {
			exportedAt: new Date().toISOString(),
			columns: columns.map((col) => ({
				name: col.name,
				dataType: col.dataType,
				nullable: col.nullable,
				isPrimaryKey: col.isPrimaryKey,
				isForeignKey: col.isForeignKey,
			})),
			rowCount: data.length,
			data: data,
		};
		return JSON.stringify(metadata, null, 2);
	} else {
		return JSON.stringify(data, null, 2);
	}
}

function escapeCSVValue(value: string): string {
	// Escape double quotes by doubling them
	return value.replace(/"/g, '""');
}

export function formatExportSummary(
	filepath: string,
	rowCount: number,
	format: string,
	columns: number,
): string {
	const filename = filepath.split("/").pop() || filepath;
	return `Exported ${rowCount} rows, ${columns} columns to ${format.toUpperCase()}: ${filename}`;
}

export function validateExportOptions(
	options: Partial<ExportOptions>,
): ExportOptions {
	return {
		format: options.format || "csv",
		includeHeaders: options.includeHeaders !== false, // default to true
		filename: options.filename,
		outputDir: options.outputDir,
	};
}

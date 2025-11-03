import { afterAll, beforeEach, describe, expect, it, vi } from "bun:test";
import { DBType, ViewState } from "../../src/types/state.js";
import { createHistoryEntry, historyHelpers } from "../../src/utils/history.js";

describe("history utilities", () => {
	// Set up fake timers for all tests
	vi.useFakeTimers();
	let currentTime = 0;
	const dateNowSpy = vi.spyOn(Date, "now");
	beforeEach(() => {
		currentTime = 1672531200000;
		dateNowSpy.mockImplementation(() => currentTime);
	});
	afterAll(() => {
		dateNowSpy.mockRestore();
		vi.useRealTimers();
	});

	describe("createHistoryEntry", () => {
		it("creates a basic history entry", () => {
			const entry = createHistoryEntry(ViewState.Tables, "Test summary");

			expect(entry).toEqual({
				id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
				view: ViewState.Tables,
				timestamp: expect.any(Number),
				summary: "Test summary",
				data: undefined,
			});
		});

		it("creates history entry with data", () => {
			const data = {
				dbType: DBType.PostgreSQL,
				tableName: "users",
				connectionName: "Test DB",
			};

			const entry = createHistoryEntry(
				ViewState.DataPreview,
				"Preview data",
				data,
			);

			expect(entry).toEqual({
				id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
				view: ViewState.DataPreview,
				timestamp: expect.any(Number),
				summary: "Preview data",
				data,
			});
		});

		it("generates unique IDs for each entry", () => {
			const entry1 = createHistoryEntry(ViewState.Tables, "Entry 1");
			const entry2 = createHistoryEntry(ViewState.Tables, "Entry 2");

			expect(entry1.id).not.toBe(entry2.id);
			expect(entry1.id).toMatch(/^history-\d+-[a-z0-9]{7}$/);
			expect(entry2.id).toMatch(/^history-\d+-[a-z0-9]{7}$/);
		});

		it("handles different view states", () => {
			const views = [
				ViewState.DBType,
				ViewState.Connection,
				ViewState.Tables,
				ViewState.Columns,
				ViewState.DataPreview,
				ViewState.Query,
				ViewState.Search,
				ViewState.SavedConnections,
			];

			views.forEach((view) => {
				const entry = createHistoryEntry(view, `Test for ${view}`);
				expect(entry.view).toBe(view);
				expect(entry.summary).toBe(`Test for ${view}`);
			});
		});

		it("handles empty summary", () => {
			const entry = createHistoryEntry(ViewState.Tables, "");

			expect(entry.summary).toBe("");
		});

		it("handles complex data objects", () => {
			const complexData = {
				dbType: DBType.MySQL,
				tableName: "orders",
				query: "SELECT * FROM orders WHERE status = 'active'",
				metadata: {
					rowCount: 150,
					duration: 45,
					indexes: ["primary_key", "status_index"],
				},
				tags: ["production", "critical"],
			};

			const entry = createHistoryEntry(
				ViewState.Query,
				"Complex query",
				complexData,
			);

			expect(entry.data).toEqual(complexData);
		});
	});

	describe("historyHelpers", () => {
		describe("dbTypeSelected", () => {
			it("creates DB type selection entry", () => {
				const entry = historyHelpers.dbTypeSelected(DBType.PostgreSQL);

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.DBType,
					timestamp: expect.any(Number),
					summary: "Selected postgresql",
					data: { dbType: DBType.PostgreSQL },
				});
			});

			it("works for all DB types", () => {
				const dbTypes = [DBType.PostgreSQL, DBType.MySQL, DBType.SQLite];

				dbTypes.forEach((dbType) => {
					const entry = historyHelpers.dbTypeSelected(dbType);
					expect(entry.summary).toBe(`Selected ${dbType}`);
					expect(entry.data.dbType).toBe(dbType);
				});
			});
		});

		describe("connectionEstablished", () => {
			it("creates connection established entry", () => {
				const entry = historyHelpers.connectionEstablished(
					"Production DB",
					DBType.MySQL,
				);

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.Connection,
					timestamp: expect.any(Number),
					summary: "Connected to Production DB",
					data: {
						connectionName: "Production DB",
						dbType: DBType.MySQL,
					},
				});
			});

			it("handles special characters in connection name", () => {
				const entry = historyHelpers.connectionEstablished(
					"Test-DB_123",
					DBType.SQLite,
				);

				expect(entry.summary).toBe("Connected to Test-DB_123");
				expect(entry.data.connectionName).toBe("Test-DB_123");
			});
		});

		describe("tablesLoaded", () => {
			it("creates tables loaded entry", () => {
				const entry = historyHelpers.tablesLoaded(25);

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.Tables,
					timestamp: expect.any(Number),
					summary: "Loaded 25 tables",
					data: undefined,
				});
			});

			it("handles zero tables", () => {
				const entry = historyHelpers.tablesLoaded(0);

				expect(entry.summary).toBe("Loaded 0 tables");
			});

			it("handles singular table", () => {
				const entry = historyHelpers.tablesLoaded(1);

				expect(entry.summary).toBe("Loaded 1 tables");
			});

			it("handles large numbers", () => {
				const entry = historyHelpers.tablesLoaded(1000);

				expect(entry.summary).toBe("Loaded 1000 tables");
			});
		});

		describe("tableSelected", () => {
			it("creates table selected entry", () => {
				const entry = historyHelpers.tableSelected("users");

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.Tables,
					timestamp: expect.any(Number),
					summary: "Selected table: users",
					data: { tableName: "users" },
				});
			});

			it("handles table names with schema", () => {
				const entry = historyHelpers.tableSelected("public.users");

				expect(entry.summary).toBe("Selected table: public.users");
				expect(entry.data.tableName).toBe("public.users");
			});
		});

		describe("columnsViewed", () => {
			it("creates columns viewed entry", () => {
				const entry = historyHelpers.columnsViewed("users", 12);

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.Columns,
					timestamp: expect.any(Number),
					summary: "Viewing 12 columns in users",
					data: { tableName: "users" },
				});
			});

			it("handles single column", () => {
				const entry = historyHelpers.columnsViewed("settings", 1);

				expect(entry.summary).toBe("Viewing 1 columns in settings");
			});

			it("handles many columns", () => {
				const entry = historyHelpers.columnsViewed("audit_log", 150);

				expect(entry.summary).toBe("Viewing 150 columns in audit_log");
			});
		});

		describe("dataPreview", () => {
			it("creates data preview entry", () => {
				const entry = historyHelpers.dataPreview("products");

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.DataPreview,
					timestamp: expect.any(Number),
					summary: "Preview data from products",
					data: { tableName: "products" },
				});
			});

			it("handles complex table names", () => {
				const entry = historyHelpers.dataPreview("schema.table_name");

				expect(entry.summary).toBe("Preview data from schema.table_name");
				expect(entry.data.tableName).toBe("schema.table_name");
			});
		});

		describe("queryExecuted", () => {
			it("creates query executed entry", () => {
				const query = "SELECT * FROM users WHERE active = true";
				const entry = historyHelpers.queryExecuted(query);

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.Query,
					timestamp: expect.any(Number),
					summary: "Executed query",
					data: { query },
				});
			});

			it("handles complex queries", () => {
				const complexQuery = `
					SELECT u.name, COUNT(o.id) as order_count
					FROM users u
					LEFT JOIN orders o ON u.id = o.user_id
					WHERE u.created_at > '2023-01-01'
					GROUP BY u.id, u.name
					HAVING COUNT(o.id) > 5
					ORDER BY order_count DESC
				`;
				const entry = historyHelpers.queryExecuted(complexQuery.trim());

				expect(entry.data.query).toBe(complexQuery.trim());
			});

			it("handles empty query", () => {
				const entry = historyHelpers.queryExecuted("");

				expect(entry.data.query).toBe("");
			});
		});

		describe("searchPerformed", () => {
			it("creates search performed entry", () => {
				const entry = historyHelpers.searchPerformed("john doe");

				expect(entry).toEqual({
					id: expect.stringMatching(/^history-\d+-[a-z0-9]{7}$/),
					view: ViewState.Search,
					timestamp: expect.any(Number),
					summary: "Searched for: john doe",
					data: { query: "john doe" },
				});
			});

			it("handles special characters in search term", () => {
				const searchTerm = "user@example.com";
				const entry = historyHelpers.searchPerformed(searchTerm);

				expect(entry.summary).toBe("Searched for: user@example.com");
				expect(entry.data.query).toBe(searchTerm);
			});

			it("handles empty search term", () => {
				const entry = historyHelpers.searchPerformed("");

				expect(entry.summary).toBe("Searched for: ");
				expect(entry.data.query).toBe("");
			});

			it("handles long search terms", () => {
				const longTerm = "a".repeat(100);
				const entry = historyHelpers.searchPerformed(longTerm);

				expect(entry.summary).toBe(`Searched for: ${longTerm}`);
				expect(entry.data.query).toBe(longTerm);
			});
		});
	});

	describe("ID generation", () => {
		it("generates IDs with correct format", () => {
			const entry = createHistoryEntry(ViewState.Tables, "Test");

			expect(entry.id).toMatch(/^history-\d{13}-[a-z0-9]{7}$/);
		});

		it("includes timestamp in ID", () => {
			const timestamp = 1672531200000; // 2023-01-01 00:00:00 UTC
			currentTime = timestamp;

			const entry = createHistoryEntry(ViewState.Tables, "Test");

			expect(entry.id).toContain("1672531200000-");
		});

		it("generates different random components", () => {
			// const timestamp = Date.now();

			const entries = Array.from({ length: 10 }, () =>
				createHistoryEntry(ViewState.Tables, "Test"),
			);

			const randomParts = entries.map((entry) => entry.id.split("-")[2]);
			const uniqueRandomParts = new Set(randomParts);

			// With 10 entries, we should have very few if any collisions
			expect(uniqueRandomParts.size).toBeGreaterThan(7);
		});
	});

	describe("timestamp consistency", () => {
		it("uses current system time", () => {
			const entry = createHistoryEntry(ViewState.Tables, "Test");

			expect(entry.timestamp).toEqual(expect.any(Number));
		});

		it("creates entries with chronological timestamps", () => {
			const baseTime = Date.now();
			currentTime = baseTime;

			const entry1 = createHistoryEntry(ViewState.Tables, "First");
			currentTime += 1000;
			const entry2 = createHistoryEntry(ViewState.Tables, "Second");
			currentTime += 1000;
			const entry3 = createHistoryEntry(ViewState.Tables, "Third");

			expect(entry1.timestamp).toBe(baseTime);
			expect(entry2.timestamp).toBe(baseTime + 1000);
			expect(entry3.timestamp).toBe(baseTime + 2000);
		});
	});
});

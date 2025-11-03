import { describe, expect, it } from "bun:test";
import {
	ConnectionError,
	DatabaseError,
	QueryTimeoutError,
} from "../../src/database/errors.js";

describe("DatabaseError", () => {
	it("creates error with message only", () => {
		const error = new DatabaseError("Test error");

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(DatabaseError);
		expect(error.name).toBe("DatabaseError");
		expect(error.message).toBe("Test error");
		expect(error.code).toBeUndefined();
		expect(error.detail).toBeUndefined();
	});

	it("creates error with message and code", () => {
		const error = new DatabaseError("Test error", "ERROR_CODE");

		expect(error.message).toBe("Test error");
		expect(error.code).toBe("ERROR_CODE");
		expect(error.detail).toBeUndefined();
	});

	it("creates error with message, code, and detail", () => {
		const error = new DatabaseError(
			"Test error",
			"ERROR_CODE",
			"Detailed error information",
		);

		expect(error.message).toBe("Test error");
		expect(error.code).toBe("ERROR_CODE");
		expect(error.detail).toBe("Detailed error information");
	});

	it("maintains proper stack trace", () => {
		const error = new DatabaseError("Test error");

		expect(error.stack).toBeDefined();
		expect(typeof error.stack).toBe("string");
		expect(error.stack).toContain("DatabaseError");
	});

	it("can be caught as Error", () => {
		try {
			throw new DatabaseError("Test error");
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
			expect(e).toBeInstanceOf(DatabaseError);
			if (e instanceof Error) {
				expect(e.message).toBe("Test error");
			}
		}
	});

	it("can be serialized and deserialized", () => {
		const originalError = new DatabaseError("Test error", "CODE", "Detail");
		const serialized = JSON.stringify({
			message: originalError.message,
			name: originalError.name,
			code: originalError.code,
			detail: originalError.detail,
		});
		const deserialized = JSON.parse(serialized);

		expect(deserialized.message).toBe(originalError.message);
		expect(deserialized.name).toBe(originalError.name);
		expect(deserialized.code).toBe(originalError.code);
		expect(deserialized.detail).toBe(originalError.detail);
	});

	it("handles empty string code and detail", () => {
		const error = new DatabaseError("Test error", "", "");

		expect(error.code).toBe("");
		expect(error.detail).toBe("");
	});

	it("handles null and undefined values gracefully", () => {
		const error1 = new DatabaseError("Test error", null as any, null as any);
		const error2 = new DatabaseError(
			"Test error",
			undefined as any,
			undefined as any,
		);

		expect(error1.code).toBeNull();
		expect(error1.detail).toBeNull();
		expect(error2.code).toBeUndefined();
		expect(error2.detail).toBeUndefined();
	});
});

describe("ConnectionError", () => {
	it("creates connection error with message only", () => {
		const error = new ConnectionError("Connection failed");

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(DatabaseError);
		expect(error).toBeInstanceOf(ConnectionError);
		expect(error.name).toBe("ConnectionError");
		expect(error.message).toBe("Connection failed");
		expect(error.code).toBeUndefined();
		expect(error.detail).toBeUndefined();
	});

	it("creates connection error with message and code", () => {
		const error = new ConnectionError("Connection failed", "ECONNREFUSED");

		expect(error.name).toBe("ConnectionError");
		expect(error.message).toBe("Connection failed");
		expect(error.code).toBe("ECONNREFUSED");
	});

	it("creates connection error with all parameters", () => {
		const error = new ConnectionError(
			"Connection failed",
			"ETIMEDOUT",
			"Connection timeout after 30 seconds",
		);

		expect(error.name).toBe("ConnectionError");
		expect(error.message).toBe("Connection failed");
		expect(error.code).toBe("ETIMEDOUT");
		expect(error.detail).toBe("Connection timeout after 30 seconds");
	});

	it("is caught as DatabaseError", () => {
		try {
			throw new ConnectionError("Connection failed");
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
			expect(e).toBeInstanceOf(DatabaseError);
			expect(e).toBeInstanceOf(ConnectionError);
		}
	});

	it("inherits DatabaseError properties correctly", () => {
		const error = new ConnectionError(
			"Test message",
			"CONN_001",
			"Connection details",
		);

		expect(error.name).toBe("ConnectionError");
		expect(error.message).toBe("Test message");
		expect(error.code).toBe("CONN_001");
		expect(error.detail).toBe("Connection details");
	});
});

describe("QueryTimeoutError", () => {
	it("creates timeout error with default message", () => {
		const error = new QueryTimeoutError();

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(DatabaseError);
		expect(error).toBeInstanceOf(QueryTimeoutError);
		expect(error.name).toBe("QueryTimeoutError");
		expect(error.message).toBe("Query timed out.");
		expect(error.code).toBeUndefined();
		expect(error.detail).toBeUndefined();
	});

	it("creates timeout error with custom message", () => {
		const customMessage = "Query exceeded 30 second limit";
		const error = new QueryTimeoutError(customMessage);

		expect(error.name).toBe("QueryTimeoutError");
		expect(error.message).toBe(customMessage);
	});

	it("is caught as DatabaseError", () => {
		try {
			throw new QueryTimeoutError();
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
			expect(e).toBeInstanceOf(DatabaseError);
			expect(e).toBeInstanceOf(QueryTimeoutError);
		}
	});

	it("handles empty string message", () => {
		const error = new QueryTimeoutError("");

		expect(error.message).toBe("");
	});

	it("maintains proper inheritance chain", () => {
		const error = new QueryTimeoutError();

		expect(error instanceof QueryTimeoutError).toBe(true);
		expect(error instanceof DatabaseError).toBe(true);
		expect(error instanceof Error).toBe(true);
	});
});

describe("Error type relationships", () => {
	it("ConnectionError is a specialized DatabaseError", () => {
		const connError = new ConnectionError("Connection failed");
		const dbError = new DatabaseError("Database error");

		expect(connError instanceof DatabaseError).toBe(true);
		expect(dbError instanceof ConnectionError).toBe(false);
	});

	it("QueryTimeoutError is a specialized DatabaseError", () => {
		const timeoutError = new QueryTimeoutError();
		const dbError = new DatabaseError("Database error");

		expect(timeoutError instanceof DatabaseError).toBe(true);
		expect(dbError instanceof QueryTimeoutError).toBe(false);
	});

	it("All error types can be caught as Error", () => {
		const errors = [
			new DatabaseError("DB error"),
			new ConnectionError("Conn error"),
			new QueryTimeoutError("Timeout error"),
		];

		errors.forEach((error) => {
			expect(error instanceof Error).toBe(true);
			expect(typeof error.message).toBe("string");
			expect(typeof error.name).toBe("string");
		});
	});
});

describe("Error handling scenarios", () => {
	it("can be used in async/await error handling", async () => {
		const failingFunction = async (): Promise<void> => {
			throw new ConnectionError("Cannot connect to database", "ECONNREFUSED");
		};

		try {
			await failingFunction();
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeInstanceOf(ConnectionError);
			if (error instanceof ConnectionError) {
				expect(error.message).toBe("Cannot connect to database");
				expect(error.code).toBe("ECONNREFUSED");
			}
		}
	});

	it("can be differentiated by instanceof checks", () => {
		const errors = [
			new DatabaseError("Generic DB error"),
			new ConnectionError("Connection failed"),
			new QueryTimeoutError("Query timeout"),
		];

		const [dbError, connError, timeoutError] = errors;

		expect(dbError instanceof DatabaseError).toBe(true);
		expect(dbError instanceof ConnectionError).toBe(false);
		expect(dbError instanceof QueryTimeoutError).toBe(false);

		expect(connError instanceof DatabaseError).toBe(true);
		expect(connError instanceof ConnectionError).toBe(true);
		expect(connError instanceof QueryTimeoutError).toBe(false);

		expect(timeoutError instanceof DatabaseError).toBe(true);
		expect(timeoutError instanceof ConnectionError).toBe(false);
		expect(timeoutError instanceof QueryTimeoutError).toBe(true);
	});

	it("preserves error information through type casting", () => {
		const error = new ConnectionError("Connection failed", "CODE", "Detail");
		const asDatabaseError = error as DatabaseError;

		expect(asDatabaseError.name).toBe("ConnectionError");
		expect(asDatabaseError.code).toBe("CODE");
		expect(asDatabaseError.detail).toBe("Detail");
	});

	it("can be used in Promise rejection", () => {
		const rejectingPromise = Promise.reject(
			new DatabaseError("Promise failed", "PROMISE_REJECT"),
		);

		return rejectingPromise.catch((error) => {
			expect(error).toBeInstanceOf(DatabaseError);
			expect(error.message).toBe("Promise failed");
			expect(error.code).toBe("PROMISE_REJECT");
		});
	});
});

describe("Error message edge cases", () => {
	it("handles very long error messages", () => {
		const longMessage = "A".repeat(10000);
		const error = new DatabaseError(longMessage, "LONG_MESSAGE");

		expect(error.message).toBe(longMessage);
		expect(error.message.length).toBe(10000);
	});

	it("handles special characters in messages", () => {
		const specialMessage = "Error with special chars: \n\t\r\"'\\";
		const error = new ConnectionError(specialMessage);

		expect(error.message).toBe(specialMessage);
	});

	it("handles Unicode characters in messages", () => {
		const unicodeMessage = "Error: 数据库连接失败 🚫";
		const error = new DatabaseError(unicodeMessage, "UNICODE_ERROR");

		expect(error.message).toBe(unicodeMessage);
		expect(error.code).toBe("UNICODE_ERROR");
	});

	it("handles numeric codes converted to strings", () => {
		const error = new ConnectionError("Connection failed", 1234 as any);

		expect(error.code).toBe(1234);
	});
});

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, code?: string, detail?: string) {
    super(message, code, detail);
    this.name = 'ConnectionError';
  }
}

export class QueryTimeoutError extends DatabaseError {
  constructor(message = 'Query timed out.') {
    super(message);
    this.name = 'QueryTimeoutError';
  }
}

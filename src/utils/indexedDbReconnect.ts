type ResetIndexedDb = (database?: IDBDatabase | null) => void;

interface IndexedDbReconnectOptions<T> {
  openDatabase: () => Promise<IDBDatabase>;
  resetDatabase: ResetIndexedDb;
  operation: (database: IDBDatabase) => Promise<T>;
}

const CONNECTION_CLOSING_PATTERNS = [
  "database connection is closing",
  "connection is closing",
  "database is closing",
];

const getErrorName = (error: unknown): string =>
  error instanceof Error
    ? error.name
    : typeof error === "object" && error !== null && "name" in error && typeof (error as { name: unknown }).name === "string"
      ? (error as { name: string }).name
      : "";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

export function isIndexedDbConnectionClosingError(error: unknown): boolean {
  const name = getErrorName(error);
  const message = getErrorMessage(error).toLowerCase();
  const hasClosingMessage = CONNECTION_CLOSING_PATTERNS.some((pattern) => message.includes(pattern));

  if (hasClosingMessage) {
    return true;
  }

  return (name === "InvalidStateError" || name === "AbortError")
    && message.includes("idbdatabase")
    && message.includes("transaction");
}

export function bindIndexedDbLifecycle(database: IDBDatabase, resetDatabase: ResetIndexedDb): void {
  database.onclose = () => {
    resetDatabase(database);
  };

  database.onversionchange = () => {
    resetDatabase(database);
    database.close();
  };
}

export async function withReopenedIndexedDb<T>({
  openDatabase,
  resetDatabase,
  operation,
}: IndexedDbReconnectOptions<T>): Promise<T> {
  let database = await openDatabase();

  try {
    return await operation(database);
  } catch (error) {
    if (!isIndexedDbConnectionClosingError(error)) {
      throw error;
    }

    resetDatabase(database);
    database = await openDatabase();
    return operation(database);
  }
}

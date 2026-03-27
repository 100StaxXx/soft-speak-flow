type KeyPath = string | string[];

interface StoreSchema {
  keyPath: string;
  records: Map<string, Record<string, unknown>>;
  indexes: Map<string, KeyPath>;
}

interface OpenBehavior {
  throwOnTransactionCall?: number;
}

type CursorValue = Record<string, unknown>;

const createNameList = (getNames: () => string[]) => ({
  contains(name: string) {
    return getNames().includes(name);
  },
});

class FakeRequest<T> {
  result!: T;
  error: Error | null = null;
  onsuccess?: ((event: Event) => void) | null;
  onerror?: ((event: Event) => void) | null;
  onupgradeneeded?: ((event: Event) => void) | null;
  transaction: FakeTransaction | null = null;
}

class FakeCursor {
  constructor(
    private readonly transaction: FakeTransaction,
    private readonly schema: StoreSchema,
    private readonly entries: Array<[string, CursorValue]>,
    private readonly request: FakeRequest<FakeCursor | null>,
    private readonly index: number,
  ) {}

  get value(): CursorValue {
    return this.entries[this.index][1];
  }

  update(value: CursorValue): FakeRequest<unknown> {
    const [primaryKey] = this.entries[this.index];
    return this.transaction.runRequest(() => {
      this.schema.records.set(primaryKey, value);
      return undefined;
    });
  }

  delete(): FakeRequest<unknown> {
    const [primaryKey] = this.entries[this.index];
    return this.transaction.runRequest(() => {
      this.schema.records.delete(primaryKey);
      return undefined;
    });
  }

  continue(): void {
    const nextIndex = this.index + 1;
    window.setTimeout(() => {
      this.request.result = nextIndex < this.entries.length
        ? new FakeCursor(this.transaction, this.schema, this.entries, this.request, nextIndex)
        : null;
      this.request.onsuccess?.({ target: this.request } as unknown as Event);
    }, 0);
  }
}

class FakeTransaction {
  oncomplete?: (() => void) | null;
  onabort?: (() => void) | null;
  onerror?: (() => void) | null;
  error: Error | null = null;

  private pending = 0;
  private completionTimer: number | null = null;

  constructor(
    private readonly stores: Map<string, StoreSchema>,
    private readonly storeNames: string[],
  ) {}

  objectStore(name: string): FakeObjectStore {
    if (!this.storeNames.includes(name)) {
      throw new Error(`Store ${name} is not available in this transaction`);
    }

    const schema = this.stores.get(name);
    if (!schema) {
      throw new Error(`Store ${name} does not exist`);
    }

    return new FakeObjectStore(this, schema);
  }

  runRequest<T>(executor: () => T): FakeRequest<T> {
    if (this.completionTimer !== null) {
      window.clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }

    this.pending += 1;
    const request = new FakeRequest<T>();

    window.setTimeout(() => {
      try {
        request.result = executor();
        request.onsuccess?.({ target: request } as unknown as Event);
      } catch (error) {
        this.error = error instanceof Error ? error : new Error(String(error));
        request.error = this.error;
        request.onerror?.({ target: request } as unknown as Event);
        this.onerror?.();
        this.onabort?.();
      } finally {
        this.pending -= 1;
        if (this.pending === 0) {
          this.completionTimer = window.setTimeout(() => {
            this.completionTimer = null;
            if (!this.error) {
              this.oncomplete?.();
            }
          }, 0);
        }
      }
    }, 0);

    return request;
  }
}

class FakeIndex {
  constructor(
    private readonly transaction: FakeTransaction,
    private readonly schema: StoreSchema,
    private readonly keyPath: KeyPath,
  ) {}

  getAll(query?: IDBValidKey | IDBKeyRange): FakeRequest<Record<string, unknown>[]> {
    return this.transaction.runRequest(() =>
      [...this.schema.records.values()].filter((value) => matchesQuery(getIndexValue(value, this.keyPath), query)),
    );
  }
}

class FakeObjectStore {
  indexNames;

  constructor(
    private readonly transaction: FakeTransaction,
    private readonly schema: StoreSchema,
  ) {
    this.indexNames = createNameList(() => [...this.schema.indexes.keys()]);
  }

  createIndex(name: string, keyPath: KeyPath): void {
    this.schema.indexes.set(name, keyPath);
  }

  index(name: string): FakeIndex {
    const keyPath = this.schema.indexes.get(name);
    if (!keyPath) {
      throw new Error(`Index ${name} does not exist`);
    }
    return new FakeIndex(this.transaction, this.schema, keyPath);
  }

  get(key: IDBValidKey): FakeRequest<Record<string, unknown> | undefined> {
    return this.transaction.runRequest(() => this.schema.records.get(String(key)));
  }

  getAll(query?: IDBValidKey | IDBKeyRange): FakeRequest<Record<string, unknown>[]> {
    return this.transaction.runRequest(() =>
      [...this.schema.records.values()].filter((value) => matchesQuery(value[this.schema.keyPath], query)),
    );
  }

  put(value: Record<string, unknown>): FakeRequest<IDBValidKey> {
    return this.transaction.runRequest(() => {
      const key = getPrimaryKey(value, this.schema.keyPath);
      this.schema.records.set(key, value);
      return key;
    });
  }

  add(value: Record<string, unknown>): FakeRequest<IDBValidKey> {
    return this.transaction.runRequest(() => {
      const key = getPrimaryKey(value, this.schema.keyPath);
      if (this.schema.records.has(key)) {
        throw new Error(`Duplicate key ${key}`);
      }
      this.schema.records.set(key, value);
      return key;
    });
  }

  delete(key: IDBValidKey): FakeRequest<undefined> {
    return this.transaction.runRequest(() => {
      this.schema.records.delete(String(key));
      return undefined;
    });
  }

  clear(): FakeRequest<undefined> {
    return this.transaction.runRequest(() => {
      this.schema.records.clear();
      return undefined;
    });
  }

  openCursor(): FakeRequest<FakeCursor | null> {
    const request = new FakeRequest<FakeCursor | null>();
    const entries = [...this.schema.records.entries()];

    window.setTimeout(() => {
      request.result = entries.length > 0
        ? new FakeCursor(this.transaction, this.schema, entries, request, 0)
        : null;
      request.onsuccess?.({ target: request } as unknown as Event);
    }, 0);

    return request;
  }
}

class FakeDatabase {
  objectStoreNames;
  onclose: (() => void) | null = null;
  onversionchange: (() => void) | null = null;

  private transactionCallCount = 0;

  constructor(
    private readonly stores: Map<string, StoreSchema>,
    private readonly behavior: OpenBehavior,
  ) {
    this.objectStoreNames = createNameList(() => [...this.stores.keys()]);
  }

  createObjectStore(name: string, options?: { keyPath?: string }): FakeObjectStore {
    const schema: StoreSchema = {
      keyPath: options?.keyPath ?? "id",
      records: new Map(),
      indexes: new Map(),
    };
    this.stores.set(name, schema);
    return new FakeObjectStore(new FakeTransaction(this.stores, [name]), schema);
  }

  transaction(storeNames: string | string[], _mode?: string): FakeTransaction {
    this.transactionCallCount += 1;

    if (this.behavior.throwOnTransactionCall === this.transactionCallCount) {
      throw createClosingConnectionError();
    }

    const allowedStores = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new FakeTransaction(this.stores, allowedStores);
  }

  close(): void {
    this.onclose?.();
  }
}

interface DatabaseState {
  stores: Map<string, StoreSchema>;
  openCount: number;
}

const getPrimaryKey = (value: Record<string, unknown>, keyPath: string): string => {
  const key = value[keyPath];
  if (typeof key !== "string" && typeof key !== "number") {
    throw new Error(`Record is missing keyPath ${keyPath}`);
  }
  return String(key);
};

const getIndexValue = (value: Record<string, unknown>, keyPath: KeyPath): unknown =>
  Array.isArray(keyPath)
    ? keyPath.map((segment) => value[segment])
    : value[keyPath];

const matchesQuery = (candidate: unknown, query?: IDBValidKey | IDBKeyRange): boolean => {
  if (query === undefined) return true;

  const normalizedQuery = typeof query === "object" && query !== null && "__only" in query
    ? (query as { __only: unknown }).__only
    : query;

  if (Array.isArray(candidate)) {
    return JSON.stringify(candidate) === JSON.stringify(normalizedQuery);
  }

  return candidate === normalizedQuery;
};

export function createClosingConnectionError(): Error {
  const error = new Error("Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.");
  error.name = "InvalidStateError";
  return error;
}

export function createIndexedDbReconnectMock(behaviors: OpenBehavior[] = []): IDBFactory {
  const databases = new Map<string, DatabaseState>();

  return {
    open(name: string) {
      const request = new FakeRequest<IDBDatabase>();

      window.setTimeout(() => {
        let databaseState = databases.get(name);
        const isNew = !databaseState;
        if (!databaseState) {
          databaseState = {
            stores: new Map(),
            openCount: 0,
          };
          databases.set(name, databaseState);
        }

        const behavior = behaviors[databaseState.openCount] ?? {};
        databaseState.openCount += 1;

        const database = new FakeDatabase(databaseState.stores, behavior) as unknown as IDBDatabase;
        request.result = database;
        request.transaction = new FakeTransaction(databaseState.stores, [...databaseState.stores.keys()]);

        if (isNew && request.onupgradeneeded) {
          request.onupgradeneeded({ target: request } as unknown as Event);
        }

        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);

      return request as unknown as IDBOpenDBRequest;
    },

    deleteDatabase(name: string) {
      const request = new FakeRequest<undefined>();
      databases.delete(name);

      window.setTimeout(() => {
        request.result = undefined;
        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);

      return request as unknown as IDBOpenDBRequest;
    },
  } as IDBFactory;
}

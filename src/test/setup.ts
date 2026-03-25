import "@testing-library/jest-dom";

if (typeof globalThis.indexedDB === "undefined") {
  const compareKeys = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  const toKeyPathValue = (value: Record<string, unknown>, keyPath: string | string[]) =>
    Array.isArray(keyPath)
      ? keyPath.map((part) => value[part])
      : value[keyPath];
  const matchesQuery = (key: unknown, query: unknown) => {
    if (query === undefined) return true;
    if (query && typeof query === "object" && "__only" in (query as Record<string, unknown>)) {
      return compareKeys(key, (query as { __only: unknown }).__only);
    }
    return compareKeys(key, query);
  };
  const createNameList = (getNames: () => string[]) => ({
    contains: (name: string) => getNames().includes(name),
    item: (index: number) => getNames()[index] ?? null,
    get length() {
      return getNames().length;
    },
    [Symbol.iterator]: function* iterator() {
      yield* getNames();
    },
  });

  type StoreRecord = Record<string, unknown>;
  type StoreSchema = {
    keyPath: string;
    records: Map<string, StoreRecord>;
    indexes: Map<string, { keyPath: string | string[] }>;
  };

  class FakeRequest<T> {
    result!: T;
    error: Error | null = null;
    onsuccess: ((event: { target: FakeRequest<T> }) => void) | null = null;
    onerror: ((event: { target: FakeRequest<T> }) => void) | null = null;
    onupgradeneeded: ((event: { target: FakeRequest<T> }) => void) | null = null;
  }

  class FakeCursor {
    constructor(
      private request: FakeRequest<FakeCursor | null>,
      private entries: Array<{ key: string; value: StoreRecord }>,
      private index: number,
      private store: StoreSchema,
    ) {}

    get value() {
      return this.entries[this.index]?.value ?? null;
    }

    update(value: StoreRecord) {
      const request = new FakeRequest<undefined>();
      setTimeout(() => {
        this.store.records.set(String(value.id), value);
        request.result = undefined;
        request.onsuccess?.({ target: request });
      }, 0);
      return request;
    }

    delete() {
      const request = new FakeRequest<undefined>();
      setTimeout(() => {
        const current = this.entries[this.index];
        if (current) {
          this.store.records.delete(current.key);
        }
        request.result = undefined;
        request.onsuccess?.({ target: request });
      }, 0);
      return request;
    }

    continue() {
      this.index += 1;
      setTimeout(() => {
        this.request.result = this.index < this.entries.length
          ? new FakeCursor(this.request, this.entries, this.index, this.store)
          : null;
        this.request.onsuccess?.({ target: this.request });
      }, 0);
    }
  }

  class FakeObjectStore {
    indexNames;

    constructor(private transaction: FakeTransaction, private store: StoreSchema) {
      this.indexNames = createNameList(() => [...this.store.indexes.keys()]);
    }

    createIndex(name: string, keyPath: string | string[]) {
      this.store.indexes.set(name, { keyPath });
      return this;
    }

    index(name: string) {
      const indexSchema = this.store.indexes.get(name);
      if (!indexSchema) {
        throw new Error(`Missing index: ${name}`);
      }

      return {
        getAll: (query?: unknown) => this.transaction.runRequest(() => {
          return [...this.store.records.values()].filter((record) =>
            matchesQuery(toKeyPathValue(record, indexSchema.keyPath), query),
          );
        }),
        openCursor: (query?: unknown) => this.transaction.runCursorRequest(() => {
          return [...this.store.records.entries()]
            .filter(([, record]) => matchesQuery(toKeyPathValue(record, indexSchema.keyPath), query))
            .map(([key, value]) => ({ key, value }));
        }, this.store),
      };
    }

    get(id: unknown) {
      return this.transaction.runRequest(() => this.store.records.get(String(id)));
    }

    getAll(query?: unknown) {
      return this.transaction.runRequest(() => {
        if (query === undefined) {
          return [...this.store.records.values()];
        }

        return [...this.store.records.values()].filter((record) =>
          matchesQuery(toKeyPathValue(record, this.store.keyPath), query),
        );
      });
    }

    put(value: StoreRecord) {
      return this.transaction.runRequest(() => {
        this.store.records.set(String(value[this.store.keyPath]), value);
        return value[this.store.keyPath];
      });
    }

    add(value: StoreRecord) {
      return this.transaction.runRequest(() => {
        const key = String(value[this.store.keyPath]);
        if (this.store.records.has(key)) {
          throw new Error(`Duplicate key: ${key}`);
        }
        this.store.records.set(key, value);
        return value[this.store.keyPath];
      });
    }

    delete(id: unknown) {
      return this.transaction.runRequest(() => {
        this.store.records.delete(String(id));
        return undefined;
      });
    }

    clear() {
      return this.transaction.runRequest(() => {
        this.store.records.clear();
        return undefined;
      });
    }

    openCursor(query?: unknown) {
      return this.transaction.runCursorRequest(() => {
        return [...this.store.records.entries()]
          .filter(([key]) => matchesQuery(key, query))
          .map(([key, value]) => ({ key, value }));
      }, this.store);
    }
  }

  class FakeTransaction {
    oncomplete: (() => void) | null = null;
    onabort: (() => void) | null = null;
    onerror: (() => void) | null = null;
    error: Error | null = null;
    private pending = 0;
    private settled = false;

    constructor(private stores: Map<string, StoreSchema>, private storeName: string) {
      setTimeout(() => this.maybeComplete(), 0);
    }

    objectStore(name: string) {
      const store = this.stores.get(name);
      if (!store) {
        throw new Error(`Missing object store: ${name}`);
      }
      return new FakeObjectStore(this, store);
    }

    runRequest<T>(executor: () => T) {
      const request = new FakeRequest<T>();
      this.pending += 1;
      setTimeout(() => {
        try {
          request.result = executor();
          request.onsuccess?.({ target: request });
        } catch (error) {
          this.error = error as Error;
          request.error = this.error;
          request.onerror?.({ target: request });
          this.onerror?.();
        } finally {
          this.pending -= 1;
          this.maybeComplete();
        }
      }, 0);
      return request;
    }

    runCursorRequest(
      executor: () => Array<{ key: string; value: StoreRecord }>,
      store: StoreSchema,
    ) {
      const request = new FakeRequest<FakeCursor | null>();
      this.pending += 1;
      setTimeout(() => {
        try {
          const entries = executor();
          request.result = entries.length > 0 ? new FakeCursor(request, entries, 0, store) : null;
          request.onsuccess?.({ target: request });
        } catch (error) {
          this.error = error as Error;
          request.error = this.error;
          request.onerror?.({ target: request });
          this.onerror?.();
        } finally {
          this.pending -= 1;
          this.maybeComplete();
        }
      }, 0);
      return request;
    }

    private maybeComplete() {
      if (this.settled || this.pending > 0) return;
      this.settled = true;
      this.oncomplete?.();
    }
  }

  class FakeDatabase {
    objectStoreNames;

    constructor(private stores: Map<string, StoreSchema>) {
      this.objectStoreNames = createNameList(() => [...this.stores.keys()]);
    }

    createObjectStore(name: string, options?: { keyPath?: string }) {
      const schema: StoreSchema = {
        keyPath: options?.keyPath ?? "id",
        records: new Map(),
        indexes: new Map(),
      };
      this.stores.set(name, schema);
      return new FakeObjectStore(new FakeTransaction(this.stores, name), schema);
    }

    transaction(storeName: string, _mode?: string) {
      return new FakeTransaction(this.stores, storeName);
    }

    close() {}
  }

  const databases = new Map<string, FakeDatabase>();

  const indexedDB = {
    open(name: string) {
      const request = new FakeRequest<FakeDatabase>();
      setTimeout(() => {
        let database = databases.get(name);
        const isNew = !database;
        if (!database) {
          database = new FakeDatabase(new Map());
          databases.set(name, database);
        }

        request.result = database;
        if (isNew && request.onupgradeneeded) {
          request.onupgradeneeded({ target: request } as never);
        }
        request.onsuccess?.({ target: request });
      }, 0);
      return request;
    },
    deleteDatabase(name: string) {
      const request = new FakeRequest<undefined>();
      databases.delete(name);
      setTimeout(() => {
        request.result = undefined;
        request.onsuccess?.({ target: request });
      }, 0);
      return request;
    },
  };

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: indexedDB,
  });
  Object.defineProperty(globalThis, "IDBKeyRange", {
    configurable: true,
    value: {
      only: (value: unknown) => ({ __only: value }),
    },
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number, y?: number) {
    if (typeof options === "number") {
      this.scrollLeft = options;
      this.scrollTop = typeof y === "number" ? y : this.scrollTop;
      return;
    }

    if (options && typeof options === "object") {
      if (typeof options.left === "number") {
        this.scrollLeft = options.left;
      }
      if (typeof options.top === "number") {
        this.scrollTop = options.top;
      }
    }
  };
}

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: (options?: ScrollToOptions | number, y?: number) => {
    if (typeof options === "number") {
      (window as Window & { scrollX: number; scrollY: number }).scrollX = options;
      (window as Window & { scrollX: number; scrollY: number }).scrollY =
        typeof y === "number" ? y : window.scrollY;
      return;
    }

    if (options && typeof options === "object") {
      if (typeof options.left === "number") {
        (window as Window & { scrollX: number; scrollY: number }).scrollX = options.left;
      }
      if (typeof options.top === "number") {
        (window as Window & { scrollX: number; scrollY: number }).scrollY = options.top;
      }
    }
  },
});

Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  writable: true,
  value: () => undefined,
});

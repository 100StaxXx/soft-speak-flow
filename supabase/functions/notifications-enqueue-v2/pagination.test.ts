import { scanPaginatedRows } from "./pagination.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("daily profile scans process rows beyond the first page", async () => {
  const seenIds: string[] = [];
  const requestedAfterIds: Array<string | null> = [];

  const total = await scanPaginatedRows({
    pageSize: 2,
    fetchPage: async (afterId) => {
      requestedAfterIds.push(afterId);

      if (afterId === null) {
        return [{ id: "001" }, { id: "002" }];
      }

      if (afterId === "002") {
        return [{ id: "003" }];
      }

      return [];
    },
    processPage: (rows) => {
      seenIds.push(...rows.map((row) => row.id));
    },
  });

  assert(total === 3, `Expected 3 rows to be processed, got ${total}`);
  assert(
    seenIds.join(",") === "001,002,003",
    `Expected later-page rows to be processed, got ${seenIds.join(",")}`,
  );
  assert(
    requestedAfterIds.join(",") === ",002",
    `Expected keyset pagination after the first page, got ${requestedAfterIds.join(",")}`,
  );
});

Deno.test("check-in profile scans process later pages with a page size of one", async () => {
  const seenIds: string[] = [];
  const requestedAfterIds: Array<string | null> = [];

  const total = await scanPaginatedRows({
    pageSize: 1,
    fetchPage: async (afterId) => {
      requestedAfterIds.push(afterId);

      if (afterId === null) {
        return [{ id: "100" }];
      }

      if (afterId === "100") {
        return [{ id: "200" }];
      }

      if (afterId === "200") {
        return [{ id: "300" }];
      }

      return [];
    },
    processPage: (rows) => {
      seenIds.push(...rows.map((row) => row.id));
    },
  });

  assert(total === 3, `Expected 3 rows to be processed, got ${total}`);
  assert(
    seenIds.join(",") === "100,200,300",
    `Expected all check-in rows to be processed, got ${seenIds.join(",")}`,
  );
  assert(
    requestedAfterIds.join(",") === ",100,200,300",
    `Expected full keyset walk, got ${requestedAfterIds.join(",")}`,
  );
});

Deno.test("paginated scans stop after a partial final page without skipping first-page rows", async () => {
  const seenIds: string[] = [];
  let fetchCount = 0;

  const total = await scanPaginatedRows({
    pageSize: 3,
    fetchPage: async (afterId) => {
      fetchCount += 1;

      if (afterId === null) {
        return [{ id: "010" }, { id: "020" }, { id: "030" }];
      }

      if (afterId === "030") {
        return [{ id: "040" }];
      }

      return [];
    },
    processPage: (rows) => {
      seenIds.push(...rows.map((row) => row.id));
    },
  });

  assert(total === 4, `Expected 4 rows to be processed, got ${total}`);
  assert(fetchCount === 2, `Expected the scan to stop after the partial final page, got ${fetchCount} fetches`);
  assert(
    seenIds.join(",") === "010,020,030,040",
    `Expected the scan to preserve first-page and later-page rows, got ${seenIds.join(",")}`,
  );
});

export interface KeysetRow {
  id: string;
}

interface ScanPaginatedRowsArgs<Row extends KeysetRow> {
  pageSize: number;
  fetchPage: (afterId: string | null, pageSize: number) => Promise<Row[]>;
  processPage: (rows: Row[], context: { afterId: string | null; pageIndex: number }) => Promise<void> | void;
}

export async function scanPaginatedRows<Row extends KeysetRow>(
  args: ScanPaginatedRowsArgs<Row>,
): Promise<number> {
  const pageSize = Math.max(1, Math.trunc(args.pageSize) || 1);
  let afterId: string | null = null;
  let pageIndex = 0;
  let totalRows = 0;

  while (true) {
    const rows = await args.fetchPage(afterId, pageSize);

    if (rows.length === 0) {
      break;
    }

    totalRows += rows.length;
    await args.processPage(rows, { afterId, pageIndex });
    pageIndex += 1;

    const lastId = rows[rows.length - 1]?.id ?? null;
    if (!lastId || rows.length < pageSize) {
      break;
    }

    afterId = lastId;
  }

  return totalRows;
}

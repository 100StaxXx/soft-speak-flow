function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected} but received ${actual}`);
  }
}

Deno.test("registerUserStorageAsset upserts the expected payload", async () => {
  const { registerUserStorageAsset } = await import("./storageAssetLedger.ts");

  let capturedTable: string | null = null;
  let capturedPayload: Record<string, unknown> | null = null;
  let capturedConflict: string | undefined;

  await registerUserStorageAsset({
    supabase: {
      from: (table: string) => ({
        upsert: async (
          values: Record<string, unknown>,
          options?: { onConflict?: string },
        ) => {
          capturedTable = table;
          capturedPayload = values;
          capturedConflict = options?.onConflict;
          return { error: null };
        },
      }),
    },
    userId: "user-1",
    bucketId: "companion-images",
    storagePath: "user-1/dormant/asset.png",
    sourceKind: "companion_dormant_image",
    sourceRecordTable: "user_companion",
    sourceRecordId: "companion-1",
  });

  assertEquals(
    capturedTable,
    "user_storage_assets",
    "Expected helper to target the ledger table",
  );
  assert(capturedPayload !== null, "Expected helper to send an upsert payload");
  assertEquals(
    capturedPayload?.["user_id"],
    "user-1",
    "Expected helper to store user_id",
  );
  assertEquals(
    capturedPayload?.["bucket_id"],
    "companion-images",
    "Expected helper to store bucket_id",
  );
  assertEquals(
    capturedPayload?.["storage_path"],
    "user-1/dormant/asset.png",
    "Expected helper to store storage_path",
  );
  assertEquals(
    capturedPayload?.["source_record_table"],
    "user_companion",
    "Expected helper to include source_record_table",
  );
  assertEquals(
    capturedPayload?.["source_record_id"],
    "companion-1",
    "Expected helper to include source_record_id",
  );
  assertEquals(
    capturedConflict,
    "bucket_id,storage_path",
    "Expected helper to dedupe by bucket/path",
  );
});

Deno.test("registerUserStorageAsset rejects blank identifiers", async () => {
  const { registerUserStorageAsset } = await import("./storageAssetLedger.ts");

  await Promise.all([
    registerUserStorageAsset({
      supabase: {
        from: () => ({
          upsert: async () => ({ error: null }),
        }),
      },
      userId: " ",
      bucketId: "companion-images",
      storagePath: "user-1/dormant/asset.png",
      sourceKind: "companion_dormant_image",
    }).then(
      () => {
        throw new Error("Expected blank userId to fail");
      },
      (error) => {
        assert(
          error instanceof Error &&
            error.message.includes("requires non-empty identifiers"),
          "Expected helper to reject blank identifiers",
        );
      },
    ),
  ]);
});

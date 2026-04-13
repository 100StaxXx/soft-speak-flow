interface RegisterUserStorageAssetArgs {
  supabase: {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string },
      ) => PromiseLike<{ error: { message?: string } | null }>;
    };
  };
  userId: string;
  bucketId: string;
  storagePath: string;
  sourceKind: string;
  sourceRecordTable?: string | null;
  sourceRecordId?: string | null;
}

export async function registerUserStorageAsset({
  supabase,
  userId,
  bucketId,
  storagePath,
  sourceKind,
  sourceRecordTable,
  sourceRecordId,
}: RegisterUserStorageAssetArgs): Promise<void> {
  const trimmedUserId = userId.trim();
  const trimmedBucketId = bucketId.trim();
  const trimmedStoragePath = storagePath.trim();
  const trimmedSourceKind = sourceKind.trim();

  if (
    trimmedUserId.length === 0 || trimmedBucketId.length === 0 ||
    trimmedStoragePath.length === 0 || trimmedSourceKind.length === 0
  ) {
    throw new Error("registerUserStorageAsset requires non-empty identifiers");
  }

  const payload: Record<string, unknown> = {
    user_id: trimmedUserId,
    bucket_id: trimmedBucketId,
    storage_path: trimmedStoragePath,
    source_kind: trimmedSourceKind,
  };

  if (typeof sourceRecordTable === "string" && sourceRecordTable.trim().length > 0) {
    payload.source_record_table = sourceRecordTable.trim();
  }

  if (typeof sourceRecordId === "string" && sourceRecordId.trim().length > 0) {
    payload.source_record_id = sourceRecordId.trim();
  }

  const { error } = await supabase
    .from("user_storage_assets")
    .upsert(payload, { onConflict: "bucket_id,storage_path" });

  if (error) {
    throw new Error(
      `Failed to register storage asset ${trimmedBucketId}/${trimmedStoragePath}: ${
        error.message ?? "unknown_error"
      }`,
    );
  }
}

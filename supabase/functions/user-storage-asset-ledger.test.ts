function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("ledger migration provisions the asset table, trigger, bucket, and backfill", async () => {
  const source = await Deno.readTextFile(
    new URL("../migrations/20260412153000_add_user_storage_asset_ledger.sql", import.meta.url),
  );

  assert(
    source.includes("CREATE TABLE IF NOT EXISTS public.user_storage_assets"),
    "Expected migration to create user_storage_assets",
  );
  assert(
    source.includes("CREATE TRIGGER register_task_attachment_storage_asset"),
    "Expected migration to register task attachments through a trigger",
  );
  assert(
    source.includes("VALUES ('companion-images', 'companion-images', true)"),
    "Expected migration to provision the companion-images bucket",
  );
  assert(
    source.includes("FROM public.companion_memorials cm"),
    "Expected migration backfill to include memorial images",
  );
});

Deno.test("user-owned media writers register uploaded assets in the ledger", async () => {
  const files = [
    "./generate-companion-image/index.ts",
    "./generate-companion-launcher-image/index.ts",
    "./generate-companion-evolution/index.ts",
    "./generate-cosmic-postcard/index.ts",
    "./generate-journey-path/index.ts",
    "./generate-dormant-companion-image/index.ts",
    "./generate-memorial-image/index.ts",
    "./process-companion-animation-job/index.ts",
  ];

  for (const file of files) {
    const source = await Deno.readTextFile(new URL(file, import.meta.url));
    assert(
      source.includes('registerUserStorageAsset'),
      `Expected ${file} to register uploaded storage assets`,
    );
  }
});

Deno.test("companion image bootstrap cleans up hidden stage-one assets and records idempotency", async () => {
  const source = await Deno.readTextFile(
    new URL("./generate-companion-image/index.ts", import.meta.url),
  );
  const migration = await Deno.readTextFile(
    new URL("../migrations/20260425150000_add_companion_image_generation_idempotency.sql", import.meta.url),
  );
  const idempotencyTuningMigration = await Deno.readTextFile(
    new URL("../migrations/20260425170000_tune_companion_image_generation_idempotency.sql", import.meta.url),
  );

  assert(
    source.includes("deleteUploadedAssetBestEffort") &&
      source.includes("stage0_egg_bootstrap_failed"),
    "Expected stage-1-first bootstrap to clean hidden uploads when egg creation fails",
  );
  assert(
    source.includes("beginCompanionImageRequest") &&
      source.includes("completeCompanionImageRequestBestEffort"),
    "Expected companion image generation to use request-level idempotency",
  );
  assert(
    source.includes("qualityWarning") &&
      source.includes("judgeUnavailable"),
    "Expected bootstrap responses to surface quality and judge warnings",
  );
  assert(
    migration.includes("CREATE TABLE IF NOT EXISTS public.companion_image_generation_requests") &&
      migration.includes("begin_companion_image_generation_request") &&
      migration.includes("complete_companion_image_generation_request"),
    "Expected migration to provision companion image generation idempotency helpers",
  );
  assert(
    idempotencyTuningMigration.includes("interval '3 minutes'") &&
      idempotencyTuningMigration.includes("interval '30 minutes'") &&
      idempotencyTuningMigration.includes("expires_at = LEAST(expires_at, now() + interval '30 minutes')") &&
      idempotencyTuningMigration.includes("DELETE FROM public.companion_image_generation_requests"),
    "Expected idempotency tuning migration to shorten stale/replay windows, cap legacy rows, and clean expired rows",
  );
  assert(
    source.includes("isReplayImagePayloadUsable") &&
      source.includes("Completed replay image URL was unavailable"),
    "Expected completed idempotency replays to validate cached image URLs before returning",
  );
  assert(
    source.includes("Rejected oversized idempotency key"),
    "Expected oversized idempotency keys to be logged",
  );
});

Deno.test("legacy nonconforming storage writers now prefix uploads with the user id", async () => {
  const companionEvolutionSource = await Deno.readTextFile(
    new URL("./generate-companion-evolution/index.ts", import.meta.url),
  );
  assert(
    companionEvolutionSource.includes(
      'const fileName = `${userId}/evolutions/${companionId}_stage_${nextStage}_${Date.now()}.png`;',
    ),
    "Expected companion evolution uploads to be user-prefixed",
  );

  const dormantSource = await Deno.readTextFile(
    new URL("./generate-dormant-companion-image/index.ts", import.meta.url),
  );
  assert(
    dormantSource.includes(
      'const fileName = `${companion.user_id}/dormant/${companionId}-${Date.now()}.png`;',
    ),
    "Expected dormant image uploads to be user-prefixed",
  );

  const memorialSource = await Deno.readTextFile(
    new URL("./generate-memorial-image/index.ts", import.meta.url),
  );
  assert(
    memorialSource.includes(
      'const fileName = `${ownerUserId}/memorials/${memorialId}-${Date.now()}.png`;',
    ),
    "Expected memorial image uploads to be user-prefixed",
  );
});

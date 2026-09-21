import {
  type FunctionInvocationResult,
  LocalSupabaseHarness,
  type TestUserSession,
} from "./localSupabase.ts";

const MOCK_FROM_EDGE = "http://host.lima.internal:8787";
const MOCK_FROM_HOST = "http://127.0.0.1:8787";
const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const assert: (
  condition: unknown,
  message: string,
) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const userHeaders = (user: TestUserSession, anonKey: string) => ({
  Authorization: `Bearer ${user.accessToken}`,
  apikey: anonKey,
});

const retryFetch = async (
  input: string | URL,
  init?: RequestInit,
): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(attempt * 150);
    }
  }
  throw lastError;
};

const invokeFunction = async (
  harness: LocalSupabaseHarness,
  functionName: string,
  options: Parameters<LocalSupabaseHarness["invokeFunction"]>[1],
): Promise<FunctionInvocationResult> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await harness.invokeFunction(functionName, options);
      if (
        ![502, 504].includes(result.status) ||
        attempt === 5
      ) {
        return result;
      }
      await sleep(attempt * 200);
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(attempt * 200);
    }
  }
  throw lastError;
};

const readRows = async (
  harness: LocalSupabaseHarness,
  table: string,
  query: string,
): Promise<Array<Record<string, unknown>>> => {
  const response = await retryFetch(
    `${harness.config.apiUrl}/rest/v1/${table}?${query}`,
    { headers: harness.serviceHeaders },
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`Failed to read ${table}: ${body}`);
  return JSON.parse(body);
};

const patchRows = async (
  harness: LocalSupabaseHarness,
  table: string,
  query: string,
  values: Record<string, unknown>,
): Promise<void> => {
  const response = await retryFetch(
    `${harness.config.apiUrl}/rest/v1/${table}?${query}`,
    {
      method: "PATCH",
      headers: {
        ...harness.serviceHeaders,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(values),
    },
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`Failed to patch ${table}: ${body}`);
};

const invokeWorker = async (
  harness: LocalSupabaseHarness,
  eventId: string,
): Promise<FunctionInvocationResult> => {
  await patchRows(harness, "companion_cinema_events", `id=eq.${eventId}`, {
    next_retry_at: null,
    lease_token: null,
    lease_expires_at: null,
  });
  await patchRows(
    harness,
    "companion_cinema_renders",
    `event_id=eq.${eventId}&status=in.(queued,submitted,processing)`,
    { next_retry_at: null },
  );
  return await invokeFunction(harness, "process-companion-cinema-event", {
    body: { eventId },
    headers: {
      apikey: harness.config.anonKey,
      "x-internal-key": harness.config.internalFunctionSecret,
    },
  });
};

const processUntilReady = async (
  harness: LocalSupabaseHarness,
  eventId: string,
): Promise<void> => {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const result = await invokeWorker(harness, eventId);
    assert(
      result.status === 200 || result.status === 202,
      `Worker attempt ${attempt} failed (${result.status}): ${result.text}`,
    );
    if (result.json?.status === "ready") return;
  }
  throw new Error(`Cinema event ${eventId} did not become ready`);
};

const deleteUser = async (
  harness: LocalSupabaseHarness,
  userId: string,
): Promise<void> => {
  const response = await retryFetch(
    `${harness.config.apiUrl}/auth/v1/admin/users/${userId}`,
    {
      method: "DELETE",
      headers: harness.serviceHeaders,
    },
  );
  await response.body?.cancel();
};

const resetMock = async (): Promise<void> => {
  const response = await retryFetch(`${MOCK_FROM_HOST}/reset`, {
    method: "POST",
  });
  await response.body?.cancel();
};

const startInteraction = async ({
  harness,
  user,
  interactionType,
  intention,
}: {
  harness: LocalSupabaseHarness;
  user: TestUserSession;
  interactionType: "watch" | "hunt" | "forge";
  intention?: string;
}): Promise<{ eventId: string; runId: string }> => {
  const result = await invokeFunction(
    harness,
    "manage-companion-cinema-interaction",
    {
      body: {
        action: "start",
        interactionType,
        ...(intention ? { intention } : {}),
      },
      headers: userHeaders(user, harness.config.anonKey),
    },
  );
  assert(
    result.status === 201,
    `${interactionType} start failed: ${result.text}`,
  );
  const event = result.json?.event as Record<string, unknown> | undefined;
  const run = result.json?.run as Record<string, unknown> | undefined;
  const eventId = String(event?.id ?? "");
  const runId = String(run?.id ?? "");
  assert(
    eventId && runId,
    `${interactionType} did not return run and event IDs`,
  );
  return { eventId, runId };
};

const revealInteraction = async (
  harness: LocalSupabaseHarness,
  user: TestUserSession,
  eventId: string,
): Promise<void> => {
  const result = await invokeFunction(
    harness,
    "manage-companion-cinema-interaction",
    {
      body: { action: "reveal", eventId },
      headers: userHeaders(user, harness.config.anonKey),
    },
  );
  assert(result.status === 200, `Interaction reveal failed: ${result.text}`);
  assert(
    result.json?.ready === true,
    "Interaction reveal must return a signed film",
  );
};

Deno.test("Cosmiq cinema runs from hatch queue through reveal and the next background boundary", async () => {
  await resetMock();
  const harness = await LocalSupabaseHarness.create();
  const user = await harness.createUser("cosmiq-cinema-e2e");
  const gracewardUser = await harness.createUser("graceward-cinema-e2e");
  const companionId = crypto.randomUUID();
  const gracewardCompanionId = crypto.randomUUID();

  try {
    await harness.insertRows("user_companion", [{
      id: companionId,
      user_id: user.id,
      favorite_color: "violet",
      spirit_animal: "Fox",
      preset_id: "fox",
      core_element: "nature",
      story_tone: "epic_adventure",
      product_mode: "cosmiq",
      current_stage: 1,
      current_xp: 100,
      current_image_url: `${MOCK_FROM_EDGE}/image.png`,
      initial_image_url: `${MOCK_FROM_EDGE}/image.png`,
    }]);
    await harness.insertRows("user_companion", [{
      id: gracewardCompanionId,
      user_id: gracewardUser.id,
      favorite_color: "gold",
      spirit_animal: "Dove",
      core_element: "light",
      story_tone: "gentle",
      product_mode: "graceward",
      current_stage: 1,
      current_xp: 100,
      current_image_url: `${MOCK_FROM_EDGE}/image.png`,
      initial_image_url: `${MOCK_FROM_EDGE}/image.png`,
    }]);

    const blockedGraceward = await invokeFunction(
      harness,
      "process-companion-cinema-event",
      {
        body: { action: "enqueue", companionId: gracewardCompanionId },
        headers: userHeaders(gracewardUser, harness.config.anonKey),
      },
    );
    assert(
      blockedGraceward.status >= 400,
      "Graceward enqueue must be rejected",
    );
    assert(
      (await readRows(
        harness,
        "companion_cinema_events",
        `companion_id=eq.${gracewardCompanionId}&select=id`,
      )).length === 0,
      "Graceward rejection must not create provider work",
    );

    const enqueue = await invokeFunction(
      harness,
      "process-companion-cinema-event",
      {
        body: { action: "enqueue", companionId },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(enqueue.status === 202, `Cosmiq enqueue failed: ${enqueue.text}`);
    const eventId = String(enqueue.json?.eventId ?? "");
    assert(eventId.length > 0, "Enqueue did not return an event ID");

    if (enqueue.json?.status !== "rendering_video") {
      let portraitResult = await invokeWorker(harness, eventId);
      for (
        let attempt = 1;
        attempt < 3 && portraitResult.json?.status === "processing";
        attempt += 1
      ) {
        portraitResult = await invokeWorker(harness, eventId);
      }
      const portraitState = await readRows(
        harness,
        "companion_cinema_events",
        `id=eq.${eventId}&select=status,lease_token,lease_expires_at,updated_at,error_code,error_message`,
      );
      assert(
        portraitResult.status === 202 &&
          portraitResult.json?.status === "rendering_video",
        `Portrait phase did not complete: ${portraitResult.text}; state=${
          JSON.stringify(portraitState)
        }`,
      );
    }

    const initialRenders = await readRows(
      harness,
      "companion_cinema_renders",
      `event_id=eq.${eventId}&select=*`,
    );
    assert(
      initialRenders.length === 2,
      "Portrait phase must create two video candidates",
    );
    assert(
      initialRenders.every((row) => row.generate_audio === true),
      "Every evolution candidate must request native audio",
    );

    await processUntilReady(harness, eventId);

    const readyEvents = await readRows(
      harness,
      "companion_cinema_events",
      `id=eq.${eventId}&select=*`,
    );
    const readyEvent = readyEvents[0];
    assert(readyEvent?.status === "ready", "Evolution event must finish ready");
    assert(readyEvent.selected_render_id, "Ready event must select one render");

    const completedRenders = await readRows(
      harness,
      "companion_cinema_renders",
      `event_id=eq.${eventId}&select=*`,
    );
    assert(
      completedRenders.filter((row) => row.status === "selected").length === 1,
      "Exactly one candidate must be selected",
    );
    assert(
      completedRenders.every((row) => {
        const qa = row.qa_payload as Record<string, unknown>;
        return qa?.containerValid === true && qa?.videoTrackPresent === true &&
          qa?.audioTrackPresent === true &&
          qa?.durationWithinTolerance === true;
      }),
      "Both candidates must pass MP4, video, audio, and duration QA",
    );
    const privatePaths = [
      String(readyEvent.canonical_image_path ?? ""),
      ...completedRenders.map((row) => String(row.video_path ?? "")),
    ].filter(Boolean);

    for (const privatePath of privatePaths) {
      const hiddenObject = await retryFetch(
        `${harness.config.apiUrl}/storage/v1/object/companion-cinema-private/${privatePath}`,
        { headers: userHeaders(user, harness.config.anonKey) },
      );
      assert(
        !hiddenObject.ok,
        `Future cinema asset was readable before reveal (${hiddenObject.status}): ${privatePath}`,
      );
      await hiddenObject.body?.cancel();
    }

    const reveal = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: { action: "reveal", eventId },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(reveal.status === 200, `Reveal failed: ${reveal.text}`);
    assert(
      reveal.json?.ready === true,
      "Reveal must return a ready signed film",
    );
    const signedVideoUrl = String(reveal.json?.videoUrl ?? "").replace(
      "http://kong:8000",
      harness.config.apiUrl,
    );
    const signedVideo = await retryFetch(signedVideoUrl);
    assert(signedVideo.ok, "The reveal signed URL must download successfully");
    await signedVideo.body?.cancel();

    const promote = await invokeFunction(
      harness,
      "generate-companion-evolution",
      {
        body: {},
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      promote.status === 200,
      `Evolution promotion failed: ${promote.text}`,
    );
    assert(
      promote.json?.evolved === true,
      "Ready cinema must promote the companion",
    );
    assert(
      promote.json?.new_stage === 5,
      "The promoted boundary must be Level 5",
    );
    assert(
      promote.json?.asset_source === "personalized_cinema",
      "Cosmiq must never fall back to a premade evolution",
    );

    const companions = await readRows(
      harness,
      "user_companion",
      `id=eq.${companionId}&select=current_stage,current_image_url`,
    );
    assert(
      companions[0]?.current_stage === 5,
      "Companion state must advance atomically",
    );
    const nextEvents = await readRows(
      harness,
      "companion_cinema_events",
      `companion_id=eq.${companionId}&event_type=eq.evolution&select=boundary_level,status`,
    );
    assert(
      nextEvents.some((row) =>
        row.boundary_level === 13 && row.status === "queued"
      ),
      "Level 13 must begin generating only after Level 5 promotion",
    );
    assert(
      !nextEvents.some((row) => Number(row.boundary_level) > 13),
      "The engine must remain one personalized boundary ahead",
    );

    for (const privatePath of privatePaths) {
      const removedObject = await retryFetch(
        `${harness.config.apiUrl}/storage/v1/object/companion-cinema-private/${privatePath}`,
        { headers: harness.serviceHeaders },
      );
      assert(
        !removedObject.ok,
        `Private evolution candidate leaked after promotion (${removedObject.status}): ${privatePath}`,
      );
      await removedObject.body?.cancel();
    }

    const metricsResponse = await retryFetch(`${MOCK_FROM_HOST}/metrics`);
    const metrics = await metricsResponse.json();
    assert(
      metrics.imageEdits >= 1 && metrics.imageEdits <= 2,
      `Expected one passing portrait or a second quality retry, got ${metrics.imageEdits}`,
    );
    assert(
      metrics.imageJudges === metrics.imageEdits,
      "Every portrait candidate must be judged exactly once",
    );
    assert(
      metrics.falSubmissions === 2,
      `Expected two video candidates, got ${metrics.falSubmissions}`,
    );
    assert(
      metrics.falStatusChecks === 2,
      "Each video candidate must be polled",
    );
    assert(
      metrics.videoDownloads === 2,
      "Each selected-quality candidate must undergo local media QA",
    );
  } finally {
    await deleteUser(harness, user.id);
    await deleteUser(harness, gracewardUser.id);
  }
});

Deno.test("Watch, Hunt, Forge, reaction, reward, and cancellation run through the cinema endpoints", async () => {
  await resetMock();
  const harness = await LocalSupabaseHarness.create();
  const user = await harness.createUser("cosmiq-interactions-e2e");
  const companionId = crypto.randomUUID();

  try {
    await harness.insertRows("user_companion", [{
      id: companionId,
      user_id: user.id,
      favorite_color: "teal",
      spirit_animal: "Phoenix",
      preset_id: "phoenix",
      core_element: "fire",
      story_tone: "epic_adventure",
      product_mode: "cosmiq",
      current_stage: 1,
      current_xp: 10,
      current_image_url: `${MOCK_FROM_EDGE}/image.png`,
      initial_image_url: `${MOCK_FROM_EDGE}/image.png`,
    }]);

    const watch = await startInteraction({
      harness,
      user,
      interactionType: "watch",
    });
    await processUntilReady(harness, watch.eventId);
    await revealInteraction(harness, user, watch.eventId);
    const watchComplete = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: {
          action: "complete",
          runId: watch.runId,
          outcome: { completed: true, focusMinutes: 25 },
        },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      watchComplete.status === 200,
      `Watch completion failed: ${watchComplete.text}`,
    );
    const completedWatchRun = watchComplete.json?.run as
      | Record<string, unknown>
      | undefined;
    const reactionEventId = String(
      completedWatchRun?.completion_cinema_event_id ?? "",
    );
    assert(reactionEventId, "Watch completion must queue its return reaction");
    await processUntilReady(harness, reactionEventId);
    // Simulate a request that created and rendered the completion event but
    // lost its run-link write. An idempotent retry must repair the link without
    // resetting the already-paid ready event to queued.
    await patchRows(
      harness,
      "companion_interaction_runs",
      `id=eq.${watch.runId}`,
      { completion_cinema_event_id: null },
    );
    const repeatedWatchComplete = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: {
          action: "complete",
          runId: watch.runId,
          outcome: { completed: true, focusMinutes: 25 },
        },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      repeatedWatchComplete.status === 200 &&
        (repeatedWatchComplete.json?.run as Record<string, unknown> | undefined)
            ?.completion_cinema_event_id ===
          reactionEventId,
      "Repeated completion must reuse the same reaction event",
    );
    const preservedReaction = await readRows(
      harness,
      "companion_cinema_events",
      `id=eq.${reactionEventId}&select=status`,
    );
    assert(
      preservedReaction[0]?.status === "ready",
      "Idempotent completion repair must preserve a ready reaction",
    );
    const reverseCompletedWatch = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: { action: "cancel", runId: watch.runId },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      reverseCompletedWatch.status === 409,
      "A completed interaction must never be reversed to cancelled",
    );
    await revealInteraction(harness, user, reactionEventId);

    const hunt = await startInteraction({
      harness,
      user,
      interactionType: "hunt",
    });
    await processUntilReady(harness, hunt.eventId);
    await revealInteraction(harness, user, hunt.eventId);
    const huntComplete = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: {
          action: "complete",
          runId: hunt.runId,
          outcome: { completed: true },
        },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      huntComplete.status === 200,
      `Hunt completion failed: ${huntComplete.text}`,
    );
    const huntRun = huntComplete.json?.run as
      | Record<string, unknown>
      | undefined;
    assert(
      huntRun?.reward &&
        Object.keys(huntRun.reward as Record<string, unknown>).length > 0,
      "Hunt completion must award a durable relic",
    );
    assert(
      (await readRows(
        harness,
        "companion_legacy_achievements",
        `source_record_id=eq.${hunt.runId}&select=id`,
      )).length === 1,
      "Hunt reward must be written into companion legacy",
    );

    const forge = await startInteraction({
      harness,
      user,
      interactionType: "forge",
      intention: "Finish the launch brief",
    });
    await processUntilReady(harness, forge.eventId);
    await revealInteraction(harness, user, forge.eventId);
    const forgeComplete = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: {
          action: "complete",
          runId: forge.runId,
          outcome: { completed: true },
        },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      forgeComplete.status === 200,
      `Forge completion failed: ${forgeComplete.text}`,
    );
    const forgeRows = await readRows(
      harness,
      "companion_interaction_runs",
      `id=eq.${forge.runId}&select=intention,status`,
    );
    assert(
      forgeRows[0]?.intention === "Finish the launch brief" &&
        forgeRows[0]?.status === "completed",
      "Forge must persist and complete the named intention",
    );

    const cancelledWatch = await startInteraction({
      harness,
      user,
      interactionType: "watch",
    });
    let submittedRender = false;
    for (let attempt = 1; attempt <= 4 && !submittedRender; attempt += 1) {
      await invokeWorker(harness, cancelledWatch.eventId);
      const activeRenders = await readRows(
        harness,
        "companion_cinema_renders",
        `event_id=eq.${cancelledWatch.eventId}&select=provider_task_id`,
      );
      submittedRender = activeRenders.some((row) =>
        Boolean(row.provider_task_id)
      );
    }
    assert(
      submittedRender,
      "Cancellation fixture must reach a submitted provider job",
    );
    const cancellation = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: { action: "cancel", runId: cancelledWatch.runId },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      cancellation.status === 200,
      `Cancellation failed: ${cancellation.text}`,
    );
    const cancelledEvents = await readRows(
      harness,
      "companion_cinema_events",
      `id=eq.${cancelledWatch.eventId}&select=status`,
    );
    assert(
      cancelledEvents[0]?.status === "cancelled",
      "Cancelled Watch must stop its event",
    );
    const cancelledRenders = await readRows(
      harness,
      "companion_cinema_renders",
      `event_id=eq.${cancelledWatch.eventId}&select=status`,
    );
    assert(
      cancelledRenders.every((row) =>
        ["cancelled", "failed"].includes(String(row.status))
      ),
      "Cancellation must terminate every queued or submitted candidate",
    );
    const reverseCancelledWatch = await invokeFunction(
      harness,
      "manage-companion-cinema-interaction",
      {
        body: { action: "complete", runId: cancelledWatch.runId },
        headers: userHeaders(user, harness.config.anonKey),
      },
    );
    assert(
      reverseCancelledWatch.status === 409,
      "A cancelled interaction must never mint completion rewards or reactions",
    );

    const metricsResponse = await retryFetch(`${MOCK_FROM_HOST}/metrics`);
    const metrics = await metricsResponse.json();
    assert(
      metrics.imageEdits === 0,
      "Interaction films must reuse the canonical portrait",
    );
    assert(
      metrics.falSubmissions >= 9,
      "All interaction and reaction candidates must reach the provider",
    );
    assert(
      metrics.falCancellations >= 1,
      "Submitted work must be cancelled upstream",
    );
  } finally {
    await deleteUser(harness, user.id);
  }
});

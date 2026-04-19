import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  isCompanionChatPersistenceSetupError,
  withCompanionChatPersistenceCapability,
} from "./persistenceCapability.ts";

Deno.test("withCompanionChatPersistenceCapability returns false when the thread table is missing", async () => {
  const persistenceReady = await withCompanionChatPersistenceCapability(() => Promise.reject({
    code: "42P01",
    message: "relation \"companion_chat_threads\" does not exist",
    details: null,
    hint: null,
  }));

  assertEquals(persistenceReady, false);
});

Deno.test("withCompanionChatPersistenceCapability returns false when rollout columns are missing", async () => {
  const persistenceReady = await withCompanionChatPersistenceCapability(() => Promise.reject({
    code: "PGRST204",
    message: "Could not find the 'source' column of 'companion_chats' in the schema cache",
    details: null,
    hint: null,
  }));

  assertEquals(persistenceReady, false);
});

Deno.test("withCompanionChatPersistenceCapability preserves fully migrated persistence behavior", async () => {
  const persistenceReady = await withCompanionChatPersistenceCapability(() => Promise.resolve());

  assertEquals(persistenceReady, true);
});

Deno.test("withCompanionChatPersistenceCapability rethrows unrelated persistence failures", async () => {
  await assertRejects(
    () => withCompanionChatPersistenceCapability(() => Promise.reject(new Error("boom"))),
    Error,
    "boom",
  );
});

Deno.test("isCompanionChatPersistenceSetupError matches rollout storage schema mismatches", () => {
  assertEquals(
    isCompanionChatPersistenceSetupError({
      code: "PGRST204",
      message: "Could not find the 'surface' column of 'companion_chats' in the schema cache",
      details: null,
      hint: null,
    }),
    true,
  );
});

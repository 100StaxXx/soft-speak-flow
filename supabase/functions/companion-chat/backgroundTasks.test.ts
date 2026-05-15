import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { scheduleCompanionChatPostResponseWork } from "./backgroundTasks.ts";

Deno.test("scheduleCompanionChatPostResponseWork registers work with waitUntil", async () => {
  const scheduledTasks: Promise<unknown>[] = [];
  let didRun = false;

  const status = scheduleCompanionChatPostResponseWork(
    async () => {
      didRun = true;
    },
    {
      waitUntil: (task) => {
        scheduledTasks.push(task);
      },
    },
  );

  assertEquals(status, "scheduled");
  assertEquals(scheduledTasks.length, 1);

  await scheduledTasks[0];
  assertEquals(didRun, true);
});

Deno.test("scheduleCompanionChatPostResponseWork logs background failures without rejecting waitUntil work", async () => {
  const scheduledTasks: Promise<unknown>[] = [];
  const errors: unknown[] = [];

  const status = scheduleCompanionChatPostResponseWork(
    async () => {
      throw new Error("background boom");
    },
    {
      waitUntil: (task) => {
        scheduledTasks.push(task);
      },
      onError: (error) => {
        errors.push(error);
      },
    },
  );

  assertEquals(status, "scheduled");
  assertEquals(scheduledTasks.length, 1);

  await scheduledTasks[0];
  assertEquals(errors.length, 1);
  assertEquals(errors[0] instanceof Error, true);
});

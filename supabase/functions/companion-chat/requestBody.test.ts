import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildCompanionChatCompletionBody } from "./requestBody.ts";

Deno.test("buildCompanionChatCompletionBody uses GPT-5.5 chat completions shape", () => {
  const body = buildCompanionChatCompletionBody({
    model: "gpt-5.5",
    systemPrompt: "Stay warm and concise.",
    conversationHistory: [
      { role: "user", content: "Hey." },
      { role: "assistant", content: "I'm here." },
    ],
    message: "Can you help me think?",
    surface: "companion",
  });

  assertEquals(body.model, "gpt-5.5");
  assertEquals(body.reasoning_effort, "none");
  assertEquals(body.max_completion_tokens, 260);
  assertEquals("temperature" in body, false);
  assertEquals("max_tokens" in body, false);
  assertEquals(body.messages, [
    { role: "developer", content: "Stay warm and concise." },
    { role: "user", content: "Hey." },
    { role: "assistant", content: "I'm here." },
    { role: "user", content: "Can you help me think?" },
  ]);
});

Deno.test("buildCompanionChatCompletionBody allows documented GPT-5.5 snapshots to use no reasoning", () => {
  const body = buildCompanionChatCompletionBody({
    model: "gpt-5.5-2026-04-23",
    systemPrompt: "Stay warm and concise.",
    conversationHistory: [],
    message: "Hello.",
    surface: "companion",
  });

  assertEquals(body.reasoning_effort, "none");
  assertEquals(body.max_completion_tokens, 260);
  assertEquals(body.messages[0].role, "developer");
});

Deno.test("buildCompanionChatCompletionBody omits no-reasoning for GPT-5.5 pro and keeps legacy params for non-reasoning models", () => {
  const proBody = buildCompanionChatCompletionBody({
    model: "gpt-5.5-pro",
    systemPrompt: "Stay warm and concise.",
    conversationHistory: [],
    message: "Hello.",
    surface: "companion",
  });
  const legacyBody = buildCompanionChatCompletionBody({
    model: "gpt-4.1",
    systemPrompt: "Stay warm and concise.",
    conversationHistory: [],
    message: "Hello.",
    surface: "journeys",
  });

  assertEquals("reasoning_effort" in proBody, false);
  assertEquals(proBody.max_completion_tokens, 260);
  assertEquals(proBody.messages[0].role, "developer");
  assertEquals(legacyBody.temperature, 0.35);
  assertEquals(legacyBody.max_tokens, 260);
  assertEquals("max_completion_tokens" in legacyBody, false);
  assertEquals(legacyBody.messages[0].role, "system");
});

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runCompanionJudgedRender } from "./companionJudgedRender.ts";

interface TestScores {
  overall: number;
  notes?: string | null;
}

Deno.test("runCompanionJudgedRender adds one extra attempt when the judge is unavailable", async () => {
  const prompts: string[] = [];

  const result = await runCompanionJudgedRender<TestScores>({
    basePrompt: "base prompt",
    attempts: 2,
    maxAttempts: 3,
    render: async (prompt, attempt) => {
      prompts.push(prompt);
      return {
        imageDataUrl: `data:image/png;base64,attempt-${attempt}`,
        revisedPrompt: null,
        size: "1024x1536",
      };
    },
    judge: async () => null,
    scoresPass: () => false,
    rankScores: (scores) => scores?.overall ?? 0,
  });

  assertEquals(prompts.length, 3);
  assertEquals(result.retryCount, 2);
  assertEquals(result.judgeUnavailable, true);
});

Deno.test("runCompanionJudgedRender returns immediately on passing scores", async () => {
  let renderCount = 0;

  const result = await runCompanionJudgedRender<TestScores>({
    basePrompt: "base prompt",
    attempts: 3,
    maxAttempts: 4,
    render: async () => {
      renderCount += 1;
      return {
        imageDataUrl: "data:image/png;base64,first",
        revisedPrompt: "revised",
        size: "1024x1536",
      };
    },
    judge: async () => ({ overall: 9 }),
    scoresPass: (scores) => (scores?.overall ?? 0) >= 7,
    rankScores: (scores) => scores?.overall ?? 0,
  });

  assertEquals(renderCount, 1);
  assertEquals(result.passed, true);
  assertEquals(result.retryCount, 0);
});

Deno.test("runCompanionJudgedRender appends critique notes before retrying", async () => {
  const prompts: string[] = [];

  const result = await runCompanionJudgedRender<TestScores>({
    basePrompt: "base prompt",
    attempts: 2,
    render: async (prompt, attempt) => {
      prompts.push(prompt);
      return {
        imageDataUrl: `data:image/png;base64,attempt-${attempt}`,
        revisedPrompt: null,
      };
    },
    judge: async (_rendered, attempt) =>
      attempt === 0
        ? { overall: 4, notes: "center the subject" }
        : { overall: 8 },
    scoresPass: (scores) => (scores?.overall ?? 0) >= 7,
    rankScores: (scores) => scores?.overall ?? 0,
    appendCritique: (prompt, notes) =>
      notes ? `${prompt}\nRetry critique:\n- ${notes}` : prompt,
  });

  assertEquals(result.passed, true);
  assertEquals(prompts.length, 2);
  assertStringIncludes(prompts[1], "center the subject");
});

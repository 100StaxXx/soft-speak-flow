import { judgeCompanionImage } from "./companionImageJudge.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nReceived: ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("companion image judge requires and returns background cutout scoring", async () => {
  const capturedBodies: Array<Record<string, unknown>> = [];
  const guardedFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBodies.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({
                      continuity: 8,
                      difference: 7,
                      anatomy: 9,
                      centering: 8,
                      backgroundCutout: 3,
                      overall: 7,
                      subjectCenterX: 0.48,
                      subjectCenterY: 0.52,
                      notes: "Visible sky and cloud backdrop.",
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const scores = await judgeCompanionImage({
    guardedFetch,
    openAIApiKey: "test-key",
    profile: {
      spiritAnimal: "Fox",
      coreElement: "light",
      favoriteColor: "#FFD166",
    } as any,
    mode: "bootstrap",
    candidateImageUrl: "data:image/png;base64,abc",
    previousLevel: 0,
    nextLevel: 1,
  });

  assertEquals(scores?.backgroundCutout, 3, "Expected parsed background cutout score");
  const capturedBody = capturedBodies[0];
  assert(capturedBody, "Expected judge request body to be captured");

  const tools = capturedBody.tools as Array<Record<string, any>>;
  const parameters = tools[0]?.function?.parameters as Record<string, any>;
  assert(
    parameters.required.includes("backgroundCutout"),
    "Expected judge tool schema to require backgroundCutout",
  );

  const messages = capturedBody.messages as Array<Record<string, any>>;
  const content = messages[0]?.content as Array<Record<string, unknown>>;
  const instructions = String(content[0]?.text ?? "");
  assert(
    instructions.includes("BackgroundCutout") &&
      instructions.includes("sky") &&
      instructions.includes("rectangular backdrop"),
    "Expected judge instructions to define visible backdrop failures",
  );
});

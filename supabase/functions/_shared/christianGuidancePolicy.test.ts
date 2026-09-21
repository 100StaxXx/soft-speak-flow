import {
  CHRISTIAN_GUIDANCE_FALLBACK,
  enforceChristianGuidanceOutput,
  validateChristianGuidanceOutput,
} from "./christianGuidancePolicy.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("Christian guidance accepts grounded non-authoritative reflection", () => {
  const output = "You might pause, name what is within your control, and choose one loving next step.";
  const result = validateChristianGuidanceOutput(output);

  assert(result.safe, `Expected safe output, got ${result.reason}`);
});

Deno.test("Christian guidance blocks claims to know God's private message", () => {
  const result = validateChristianGuidanceOutput("God is telling you to leave your job tomorrow.");

  assert(!result.safe, "Expected divine-authority claim to be blocked");
  assert(result.reason === "divine_authority_claim", `Unexpected reason: ${result.reason}`);
});

Deno.test("Christian guidance blocks Scripture citations without reviewed context", () => {
  const result = validateChristianGuidanceOutput("Remember Philippians 4:13 and keep pushing.");

  assert(!result.safe, "Expected unapproved citation to be blocked");
  assert(result.reason === "unapproved_scripture_citation", `Unexpected reason: ${result.reason}`);
});

Deno.test("Christian guidance permits citations only when approved Scripture context is declared", () => {
  const result = validateChristianGuidanceOutput(
    "The reviewed passage is Philippians 4:6.",
    { hasApprovedScriptureContext: true },
  );

  assert(result.safe, `Expected approved citation to pass, got ${result.reason}`);
});

Deno.test("Christian guidance replaces unsafe model output with the safe fallback", () => {
  const result = enforceChristianGuidanceOutput("Thus says the Lord: your promotion is guaranteed.");

  assert(result === CHRISTIAN_GUIDANCE_FALLBACK, "Expected unsafe output to use the shared fallback");
});

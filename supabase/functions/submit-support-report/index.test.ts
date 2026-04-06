function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const submitSupportReportModule = await import("./index.ts");

Deno.test("parsePayload accepts feedback submissions", () => {
  const { payload, error } = submitSupportReportModule.parsePayload({
    correlationId: "corr-123",
    category: "feedback",
    summary: "A feedback entry in settings would help.",
    reproductionSteps: "",
    expectedBehavior: "",
    actualBehavior: "",
    consentDiagnostics: false,
  });

  assert(error === null, `Expected no validation error, got ${error}`);
  assert(payload?.category === "feedback", "Expected feedback category to be accepted");
});

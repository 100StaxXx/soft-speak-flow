function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

Deno.test("delete-user treats already-deleted auth users as non-fatal", () => {
  const cases = [
    new Error("User not found"),
    { message: "Auth api error: user not found" },
    { code: "USER_NOT_FOUND" },
    { name: "UserNotFoundError" },
  ];

  for (const candidate of cases) {
    assert(
      module.isAuthUserAlreadyDeletedError(candidate),
      `Expected ${JSON.stringify(candidate)} to be treated as an already-deleted auth user`,
    );
  }
});

Deno.test("delete-user keeps unrelated auth deletion failures fatal", () => {
  const cases = [
    new Error("permission denied"),
    { message: "rate limit exceeded" },
    { code: "unexpected_failure" },
    null,
  ];

  for (const candidate of cases) {
    assert(
      !module.isAuthUserAlreadyDeletedError(candidate),
      `Expected ${JSON.stringify(candidate)} to remain a fatal auth deletion error`,
    );
  }
});

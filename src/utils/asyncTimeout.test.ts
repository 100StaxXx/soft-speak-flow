import { describe, expect, it } from "vitest";
import { pollWithDeadline, TimeoutError, withTimeout } from "./asyncTimeout";

describe("asyncTimeout utilities", () => {
  it("withTimeout resolves when operation completes in time", async () => {
    const result = await withTimeout(
      () => Promise.resolve("ok"),
      { timeoutMs: 50, operation: "quick-op" },
    );
    expect(result).toBe("ok");
  });

  it("withTimeout throws TimeoutError when operation exceeds timeout", async () => {
    await expect(
      withTimeout(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve("late"), 40);
          }),
        { timeoutMs: 5, operation: "slow-op", timeoutCode: "GENERATION_TIMEOUT" },
      ),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("pollWithDeadline returns when task eventually succeeds", async () => {
    let attempts = 0;
    const result = await pollWithDeadline({
      deadlineMs: 60,
      intervalMs: 5,
      task: async () => {
        attempts += 1;
        return attempts >= 3 ? "ready" : null;
      },
    });

    expect(result).toBe("ready");
  });

  it("pollWithDeadline returns null when deadline expires", async () => {
    const result = await pollWithDeadline({
      deadlineMs: 20,
      intervalMs: 5,
      task: async () => null,
    });

    expect(result).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { resolveNativeRedirectBase } from "./redirectUrl";

describe("native redirect product boundary", () => {
  it("accepts only Graceward origins for a Graceward build", () => {
    expect(resolveNativeRedirectBase("https://graceward.app/", "christian"))
      .toBe("https://graceward.app");
    expect(() =>
      resolveNativeRedirectBase("https://app.cosmiq.quest", "christian")
    ).toThrow("does not belong to the graceward product");
  });

  it("accepts only Cosmiq origins for a Cosmiq build", () => {
    expect(resolveNativeRedirectBase("https://app.cosmiq.quest", "cosmiq"))
      .toBe("https://app.cosmiq.quest");
    expect(() => resolveNativeRedirectBase("https://graceward.app", "cosmiq"))
      .toThrow("does not belong to the cosmiq product");
  });
});

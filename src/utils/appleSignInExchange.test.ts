import { describe, expect, it, vi } from "vitest";
import { exchangeAppleIdentityToken } from "./appleSignInExchange";

describe("Apple token exchange", () => {
  it("recovers from a network interruption without another Apple authorization", async () => {
    const success = { data: { session: { user: { id: "same-user" } } }, error: null };
    const exchange = vi.fn().mockRejectedValueOnce(new TypeError("Load failed")).mockResolvedValue(success);
    expect(await exchangeAppleIdentityToken(exchange, async () => {})).toBe(success);
    expect(exchange).toHaveBeenCalledTimes(2);
  });
  it("never retries invalid credentials", async () => {
    const result = { error: { status: 400, message: "Invalid nonce" } };
    const exchange = vi.fn().mockResolvedValue(result);
    expect(await exchangeAppleIdentityToken(exchange, async () => {})).toBe(result);
    expect(exchange).toHaveBeenCalledTimes(1);
  });
  it("stops after three server failures", async () => {
    const exchange = vi.fn().mockResolvedValue({ error: { status: 503 } });
    await exchangeAppleIdentityToken(exchange, async () => {});
    expect(exchange).toHaveBeenCalledTimes(3);
  });
});

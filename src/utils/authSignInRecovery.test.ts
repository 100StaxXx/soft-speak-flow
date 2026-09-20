import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_FRESH_SIGN_IN_KEY, AUTH_SESSION_KEY, createRecoverableAuthStorage } from "./authSignInRecovery";

beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/"); });
const makeStorage = () => ({
  getItem: vi.fn().mockResolvedValue("saved-credentials"),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
});

describe("explicit fresh sign-in", () => {
  it("leaves normal startup session restoration unchanged", async () => {
    const underlying = makeStorage();
    const storage = createRecoverableAuthStorage(underlying);
    expect(await storage.getItem(AUTH_SESSION_KEY)).toBe("saved-credentials");
    await storage.removeItem(AUTH_SESSION_KEY);
    expect(underlying.removeItem).toHaveBeenCalledWith(AUTH_SESSION_KEY);
  });

  it("skips the stuck old token without deleting it, and unmasks only after a durable replacement", async () => {
    sessionStorage.setItem(AUTH_FRESH_SIGN_IN_KEY, "1");
    window.history.replaceState({}, "", "/auth?mode=login&recovery=1");
    const underlying = makeStorage();
    const storage = createRecoverableAuthStorage(underlying);
    expect(await storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    await storage.removeItem(AUTH_SESSION_KEY);
    expect(underlying.getItem).not.toHaveBeenCalled();
    expect(underlying.removeItem).not.toHaveBeenCalled();
    await storage.setItem(AUTH_SESSION_KEY, "new-validated-session");
    expect(underlying.setItem).toHaveBeenCalledWith(AUTH_SESSION_KEY, "new-validated-session");
    expect(sessionStorage.getItem(AUTH_FRESH_SIGN_IN_KEY)).toBeNull();
    expect(window.location.search).toBe("?mode=login");
    expect(await storage.getItem(AUTH_SESSION_KEY)).toBe("saved-credentials");
  });

  it("keeps recovery active and preserves old credentials if the new save fails", async () => {
    sessionStorage.setItem(AUTH_FRESH_SIGN_IN_KEY, "1");
    const underlying = makeStorage();
    underlying.setItem.mockRejectedValue(new Error("storage locked"));
    const storage = createRecoverableAuthStorage(underlying);
    await expect(storage.setItem(AUTH_SESSION_KEY, "new-session")).rejects.toThrow("storage locked");
    expect(await storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_FRESH_SIGN_IN_KEY)).toBe("1");
    expect(underlying.removeItem).not.toHaveBeenCalled();
  });

  it("does not interfere with OAuth verifier storage and works if sessionStorage is unavailable", async () => {
    window.history.replaceState({}, "", "/auth?mode=login&recovery=1");
    const underlying = makeStorage();
    const storage = createRecoverableAuthStorage(underlying);
    expect(await storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    await storage.setItem(`${AUTH_SESSION_KEY}-code-verifier`, "verifier");
    await storage.removeItem(`${AUTH_SESSION_KEY}-code-verifier`);
    expect(underlying.removeItem).toHaveBeenCalledWith(`${AUTH_SESSION_KEY}-code-verifier`);
    expect(await storage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });
});

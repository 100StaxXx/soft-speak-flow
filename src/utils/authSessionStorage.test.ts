import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ native: true, available: true, get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native, isPluginAvailable: () => mocks.available },
  registerPlugin: () => ({ getItem: mocks.get, setItem: mocks.set, removeItem: mocks.remove }),
}));
import { AUTH_STORAGE_READ_TIMEOUT_MS, authSessionStorage } from "./authSessionStorage";
const key = "sb-opbfpbbqvuksuvmtmssd-auth-token";
beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks(); mocks.native = true; mocks.available = true;
  mocks.get.mockResolvedValue({ value: null }); mocks.set.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined);
});
describe("secure session persistence", () => {
  it("bounds unresponsive secure writes and removals without erasing the legacy copy", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(key, "legacy");
      mocks.set.mockImplementation(() => new Promise(() => {}));
      const save = expect(authSessionStorage.setItem(key, "new")).rejects.toMatchObject({ code: "AUTH_STORAGE_WRITE_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(AUTH_STORAGE_READ_TIMEOUT_MS);
      await save;
      expect(localStorage.getItem(key)).toBe("legacy");
      mocks.remove.mockImplementation(() => new Promise(() => {}));
      const remove = expect(authSessionStorage.removeItem(key)).rejects.toMatchObject({ code: "AUTH_STORAGE_REMOVE_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(AUTH_STORAGE_READ_TIMEOUT_MS);
      await remove;
      expect(localStorage.getItem(key)).toBe("legacy");
    } finally { vi.useRealTimers(); }
  });
  it("bounds an unresponsive native read without falling back or erasing credentials", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(key, "stale-web-session");
      mocks.get.mockImplementation(() => new Promise(() => {}));
      const rejected = expect(authSessionStorage.getItem(key)).rejects.toMatchObject({ code: "AUTH_STORAGE_READ_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(AUTH_STORAGE_READ_TIMEOUT_MS);
      await rejected;
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.set).not.toHaveBeenCalled();
      expect(localStorage.getItem(key)).toBe("stale-web-session");
      mocks.get.mockResolvedValue({ value: "current-secure-session" });
      expect(await authSessionStorage.getItem(key)).toBe("current-secure-session");
    } finally { vi.useRealTimers(); }
  });
  it("migrates an existing install without requiring a fresh sign-in", async () => {
    localStorage.setItem(key, "existing-session");
    expect(await authSessionStorage.getItem(key)).toBe("existing-session");
    expect(mocks.set).toHaveBeenCalledWith({ key, value: "existing-session" });
    expect(localStorage.getItem(key)).toBeNull();
  });
  it("does not mistake an unavailable Keychain for a missing session", async () => {
    mocks.get.mockRejectedValue(new Error("temporarily unavailable"));
    await expect(authSessionStorage.getItem(key)).rejects.toThrow("temporarily unavailable");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("keeps legacy data if migration fails", async () => {
    localStorage.setItem(key, "existing-session"); mocks.set.mockRejectedValue(new Error("locked"));
    await expect(authSessionStorage.getItem(key)).rejects.toThrow("locked");
    expect(localStorage.getItem(key)).toBe("existing-session");
  });
  it("prefers the current secure token over stale web storage", async () => {
    localStorage.setItem(key, "stale"); mocks.get.mockResolvedValue({ value: "current" });
    expect(await authSessionStorage.getItem(key)).toBe("current");
  });
  it("clears both stores on intentional logout", async () => {
    localStorage.setItem(key, "legacy"); await authSessionStorage.removeItem(key);
    expect(mocks.remove).toHaveBeenCalledWith({ key }); expect(localStorage.getItem(key)).toBeNull();
  });
  it("retains web and older-build compatibility", async () => {
    mocks.available = false; await authSessionStorage.setItem(key, "web-session");
    expect(await authSessionStorage.getItem(key)).toBe("web-session"); expect(mocks.get).not.toHaveBeenCalled();
  });
});

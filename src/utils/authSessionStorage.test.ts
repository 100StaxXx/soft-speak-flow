import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ native: true, available: true, get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native, isPluginAvailable: () => mocks.available },
  registerPlugin: () => ({ getItem: mocks.get, setItem: mocks.set, removeItem: mocks.remove }),
}));
import { authSessionStorage } from "./authSessionStorage";
const key = "sb-opbfpbbqvuksuvmtmssd-auth-token";
beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks(); mocks.native = true; mocks.available = true;
  mocks.get.mockResolvedValue({ value: null }); mocks.set.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined);
});
describe("secure session persistence", () => {
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

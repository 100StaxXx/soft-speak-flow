import { afterEach, describe, expect, it, vi } from "vitest";
import { safeLocalStorage, safeSessionStorage } from "./storage";

afterEach(() => vi.restoreAllMocks());

describe.each([
  ["local", safeLocalStorage, localStorage],
  ["session", safeSessionStorage, sessionStorage],
] as const)("%s storage under quota pressure", (_name, safe, storage) => {
  it("can still read and remove an existing session when new writes fail", () => {
    storage.setItem("existing-auth-session", "saved-session");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(safe.getItem("existing-auth-session")).toBe("saved-session");
    expect(safe.setItem("new-key", "value")).toBe(false);
    expect(safe.removeItem("existing-auth-session")).toBe(true);
    expect(safe.getItem("existing-auth-session")).toBeNull();
  });
  it("attempts the actual write without an extra quota-consuming probe", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(safe.setItem("existing-auth-session", "updated")).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("existing-auth-session", "updated");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthRecoveryFetch } from "./authRecovery";

const native = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
  registerPlugin: () => ({ getItem: native.get, setItem: native.set, removeItem: native.remove }),
}));
import { authSessionStorage } from "./authSessionStorage";
import { createRecoverableAuthStorage } from "./authSignInRecovery";

const key = "sb-opbfpbbqvuksuvmtmssd-auth-token";
const secure = new Map<string, string>();
const clients: SupabaseClient[] = [];
const oldSession = () => ({
  access_token: "test-old-access", refresh_token: "test-old-refresh",
  token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 3600,
  user: { id: "upgrade-user", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01" },
});
const freshSession = () => ({ ...oldSession(), access_token: "test-fresh-access", refresh_token: "test-fresh-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 });

const makeClient = (request: typeof fetch) => {
  const base = "https://auth-recovery.example.test";
  const client = createClient(base, "test-public-key", {
    auth: { storageKey: key, storage: authSessionStorage, lock: processLock, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createAuthRecoveryFetch(base, request) },
  });
  clients.push(client);
  return client;
};

beforeEach(() => {
  vi.clearAllMocks();
  secure.clear();
  localStorage.clear();
  native.get.mockImplementation(async ({ key }) => ({ value: secure.get(key) ?? null }));
  native.set.mockImplementation(async ({ key, value }) => { secure.set(key, value); });
  native.remove.mockImplementation(async ({ key }) => { secure.delete(key); });
});
afterEach(async () => {
  for (const client of clients.splice(0)) await client.auth.stopAutoRefresh();
  vi.useRealTimers();
});

describe("upgrade restoration using the real Supabase SDK and native storage adapter", () => {
  it("can sign in with Apple again without reading or deleting the stuck saved token", async () => {
    secure.set(key, JSON.stringify(oldSession()));
    native.get.mockImplementation(async ({ key: requestedKey }) => {
      if (requestedKey === key) throw new Error("old token must not be read during explicit recovery");
      return { value: null };
    });
    const request = vi.fn().mockImplementation(async () => new Response(JSON.stringify(freshSession()), { status: 200 }));
    const client = createClient("https://auth-recovery.example.test", "test-public-key", {
      auth: { storageKey: key, storage: createRecoverableAuthStorage(authSessionStorage, true), lock: processLock, autoRefreshToken: false },
      global: { fetch: createAuthRecoveryFetch("https://auth-recovery.example.test", request) },
    });
    clients.push(client);
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(JSON.parse(secure.get(key)!).refresh_token).toBe("test-old-refresh");
    const result = await client.auth.signInWithIdToken({ provider: "apple", token: "isolated-test-token", nonce: "test-nonce" });
    expect(result.error).toBeNull();
    expect(result.data.user?.id).toBe("upgrade-user");
    expect(JSON.parse(secure.get(key)!).refresh_token).toBe("test-fresh-refresh");
    expect(native.remove).not.toHaveBeenCalledWith({ key });
  });
  it("does not hang forever when migrating an older install into secure storage", async () => {
    vi.useFakeTimers();
    localStorage.setItem(key, JSON.stringify(oldSession()));
    native.set.mockImplementation(() => new Promise(() => {}));
    const result = vi.fn();
    const rejected = vi.fn();
    void makeClient(vi.fn()).auth.getSession().then(result, rejected);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(rejected).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTH_STORAGE_WRITE_TIMEOUT" }));
    expect(result).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(native.remove).not.toHaveBeenCalled();
  });
  it("restores an expired session with foreground refresh and immediate auth subscribers", async () => {
    vi.useFakeTimers();
    secure.set(key, JSON.stringify(oldSession()));
    const request = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return new Response(JSON.stringify(freshSession()), { status: 200 });
    });
    const client = createClient("https://auth-recovery.example.test", "test-public-key", {
      auth: { storageKey: key, storage: authSessionStorage, lock: processLock, persistSession: true, autoRefreshToken: true },
      global: { fetch: createAuthRecoveryFetch("https://auth-recovery.example.test", request) },
    });
    clients.push(client);
    const listener = vi.fn();
    const subscription = client.auth.onAuthStateChange(listener);
    void client.auth.startAutoRefresh();
    const loaded = vi.fn();
    void client.auth.getSession().then(loaded);
    await vi.advanceTimersByTimeAsync(1000);
    expect(loaded).toHaveBeenCalledWith(expect.objectContaining({ data: { session: expect.objectContaining({ user: expect.objectContaining({ id: "upgrade-user" }) }) } }));
    expect(request).toHaveBeenCalledTimes(1);
    subscription.data.subscription.unsubscribe();
  });
  it("keeps a timed-out lock waiter from releasing another session operation early", async () => {
    vi.useFakeTimers();
    let rejectFirst!: (error: Error) => void;
    const first = processLock("auth-recovery-serialization-test", -1, () => new Promise<void>((_resolve, reject) => { rejectFirst = reject; }));
    const firstRejected = expect(first).rejects.toThrow("storage unavailable");
    await vi.advanceTimersByTimeAsync(0);
    const timedOut = processLock("auth-recovery-serialization-test", 0, vi.fn());
    const timeoutRejected = expect(timedOut).rejects.toMatchObject({ isAcquireTimeout: true });
    await vi.advanceTimersByTimeAsync(0);
    await timeoutRejected;
    const nextOperation = vi.fn().mockResolvedValue("recovered");
    const next = processLock("auth-recovery-serialization-test", -1, nextOperation);
    await vi.advanceTimersByTimeAsync(0);
    expect(nextOperation).not.toHaveBeenCalled();
    rejectFirst(new Error("storage unavailable"));
    await firstRejected;
    expect(await next).toBe("recovered");
  });

  it("migrates an expired older-install session and persists its renewed token securely", async () => {
    localStorage.setItem(key, JSON.stringify(oldSession()));
    const request = vi.fn().mockImplementation(async () => new Response(JSON.stringify(freshSession()), { status: 200 }));
    const result = await makeClient(request).auth.getSession();
    expect(result.error).toBeNull();
    expect(result.data.session?.user.id).toBe("upgrade-user");
    expect(result.data.session?.refresh_token).toBe("test-fresh-refresh");
    expect(JSON.parse(secure.get(key)!).refresh_token).toBe("test-fresh-refresh");
    expect(localStorage.getItem(key)).toBeNull();
    expect(native.remove).not.toHaveBeenCalled();
  });

  it("releases a hung renewal, retains the secure session, then recovers on a fresh check", async () => {
    vi.useFakeTimers();
    const session = JSON.stringify(oldSession());
    secure.set(key, session);
    const request = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));
    const client = makeClient(request);
    const pending = client.auth.getSession();
    await vi.advanceTimersByTimeAsync(35_000);
    const failed = await pending;
    expect(failed.error?.name).toBe("AuthRetryableFetchError");
    expect(secure.get(key)).toBe(session);
    expect(native.remove).not.toHaveBeenCalled();
    request.mockImplementation(async () => new Response(JSON.stringify(freshSession()), { status: 200 }));
    const recovered = await client.auth.getSession();
    expect(recovered.error).toBeNull();
    expect(recovered.data.session?.user.id).toBe("upgrade-user");
  });

  it("never treats a Keychain error as a missing session or falls back to stale web tokens", async () => {
    secure.set(key, JSON.stringify(freshSession()));
    localStorage.setItem(key, JSON.stringify(oldSession()));
    native.get.mockRejectedValue(new Error("AUTH_STORAGE_READ_FAILED"));
    const request = vi.fn();
    const client = makeClient(request);
    await expect(client.auth.getSession()).rejects.toThrow("AUTH_STORAGE_READ_FAILED");
    expect(request).not.toHaveBeenCalled();
    expect(native.remove).not.toHaveBeenCalled();
    expect(secure.has(key)).toBe(true);
    native.get.mockImplementation(async ({ key }) => ({ value: secure.get(key) ?? null }));
    const recovered = await client.auth.getSession();
    expect(recovered.data.session?.user.id).toBe("upgrade-user");
    expect(recovered.data.session?.access_token).toBe("test-fresh-access");
    expect(request).not.toHaveBeenCalled();
  });

  it("still honors a definitive server rejection of a revoked refresh token", async () => {
    secure.set(key, JSON.stringify(oldSession()));
    const request = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      error_code: "refresh_token_not_found", message: "Refresh token not found",
    }), { status: 400 }));
    const result = await makeClient(request).auth.getSession();
    expect(result.data.session).toBeNull();
    expect(result.error?.status).toBe(400);
    expect(secure.has(key)).toBe(false);
  });
});

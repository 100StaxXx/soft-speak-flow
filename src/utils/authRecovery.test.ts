import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_REQUEST_TIMEOUT_MS, createAuthRecoveryFetch } from "./authRecovery";

const base = "https://auth-recovery.example.test";
const authUrl = `${base}/auth/v1/token?grant_type=refresh_token`;

afterEach(() => vi.useRealTimers());

describe("bounded auth transport", () => {
  it("aborts a stalled request and rejects without fabricating a sign-out response", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const request = vi.fn((_input, init) => {
      signal = init?.signal;
      return new Promise<Response>(() => {});
    });
    const result = createAuthRecoveryFetch(base, request)(authUrl);
    const rejected = expect(result).rejects.toThrow("Sign-in connection timed out");
    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also times out a response that sends headers but never finishes its body", async () => {
    vi.useFakeTimers();
    const response = new Response("{}");
    vi.spyOn(response, "arrayBuffer").mockImplementation(() => new Promise(() => {}));
    const request = vi.fn().mockResolvedValue(response);
    const rejected = expect(createAuthRecoveryFetch(base, request)(authUrl)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await rejected;
  });

  it("preserves successful and rejected server responses and clears its deadline", async () => {
    vi.useFakeTimers();
    for (const status of [200, 400, 401, 503]) {
      const request = vi.fn().mockResolvedValue(new Response('{"message":"test"}', {
        status, headers: { "Content-Type": "application/json", "x-test": "preserved" },
      }));
      const response = await createAuthRecoveryFetch(base, request)(authUrl);
      expect(response.status).toBe(status);
      expect(response.headers.get("x-test")).toBe("preserved");
      expect(await response.json()).toEqual({ message: "test" });
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it("does not apply auth deadlines to database, AI, storage or other hosts", async () => {
    vi.useFakeTimers();
    for (const url of [`${base}/rest/v1/profiles`, `${base}/functions/v1/chat`, `${base}/storage/v1/object`, "https://other.example.test/auth/v1/token"]) {
      const init = { method: "POST" };
      const response = new Response("ok");
      const request = vi.fn().mockResolvedValue(response);
      expect(await createAuthRecoveryFetch(base, request)(url, init)).toBe(response);
      expect(request).toHaveBeenCalledWith(url, init);
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it("forwards caller cancellation", async () => {
    const upstream = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const request = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
      receivedSignal = init?.signal;
      receivedSignal?.addEventListener("abort", () => reject(new Error("caller cancelled")));
    }));
    const result = createAuthRecoveryFetch(base, request)(authUrl, { signal: upstream.signal });
    upstream.abort();
    await expect(result).rejects.toThrow("caller cancelled");
    expect(receivedSignal?.aborted).toBe(true);
  });
});

import {
  createSafeErrorResponse,
  getClientIpAddress,
  getPrimaryRateLimitWindow,
  normalizeEmailTarget,
} from "./abuseProtection.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("normalizeEmailTarget trims and lowercases email targets", () => {
  assert(normalizeEmailTarget("  USER@Example.COM ") === "user@example.com", "Expected normalized email");
  assert(normalizeEmailTarget("   ") === null, "Expected blank values to normalize to null");
});

Deno.test("getClientIpAddress prefers Cloudflare header then x-forwarded-for", () => {
  const cfRequest = new Request("https://example.com", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    },
  });

  const forwardedRequest = new Request("https://example.com", {
    headers: {
      "x-forwarded-for": "198.51.100.99, 198.51.100.100",
    },
  });

  const unknownRequest = new Request("https://example.com");

  assert(getClientIpAddress(cfRequest) === "203.0.113.10", "Expected Cloudflare IP to win");
  assert(getClientIpAddress(forwardedRequest) === "198.51.100.99", "Expected first forwarded IP");
  assert(getClientIpAddress(unknownRequest) === "unknown", "Expected unknown fallback");
});

Deno.test("getPrimaryRateLimitWindow picks the first populated subject window", () => {
  const window = getPrimaryRateLimitWindow({
    allowed: false,
    code: "rate_limit_exceeded",
    retry_after_seconds: 120,
    matched_profile: "ai.standard",
    limit_user: 20,
    remaining_user: 4,
    reset_user_at: "2026-03-28T18:00:00Z",
    limit_ip: 60,
    remaining_ip: 12,
    reset_ip_at: "2026-03-28T18:00:00Z",
    limit_email: null,
    remaining_email: null,
    reset_email_at: null,
    cooldown_until: null,
  });

  assert(window?.limit === 20, "Expected user limit to be preferred");
  assert(window?.remaining === 4, "Expected user remaining to be preferred");
  assert(window?.resetAt === "2026-03-28T18:00:00Z", "Expected user reset timestamp");
});

Deno.test("createSafeErrorResponse uses the standardized envelope and rate-limit headers", async () => {
  const response = createSafeErrorResponse(new Request("https://example.com", {
    headers: {
      Origin: "http://localhost:5173",
    },
  }), {
    status: 429,
    code: "RATE_LIMITED",
    error: "Too many requests. Please try again later.",
    requestId: "request-123",
    retryAfterSeconds: 90,
    protection: {
      allowed: false,
      code: "rate_limit_exceeded",
      retry_after_seconds: 90,
      matched_profile: "ai.standard",
      limit_user: 20,
      remaining_user: 0,
      reset_user_at: "2026-03-28T19:00:00Z",
      limit_ip: 60,
      remaining_ip: 5,
      reset_ip_at: "2026-03-28T19:00:00Z",
      limit_email: null,
      remaining_email: null,
      reset_email_at: null,
      cooldown_until: null,
    },
  });

  const body = await response.json() as Record<string, unknown>;

  assert(response.status === 429, "Expected 429 status");
  assert(body.error === "Too many requests. Please try again later.", "Expected safe error message");
  assert(body.code === "RATE_LIMITED", "Expected safe error code");
  assert(body.requestId === "request-123", "Expected request ID in body");
  assert(body.retryAfterSeconds === 90, "Expected retryAfterSeconds in body");
  assert(response.headers.get("Retry-After") === "90", "Expected Retry-After header");
  assert(response.headers.get("X-RateLimit-Limit") === "20", "Expected rate limit header");
  assert(response.headers.get("X-RateLimit-Remaining") === "0", "Expected remaining header");
  assert(response.headers.get("X-RateLimit-Reset") === "2026-03-28T19:00:00Z", "Expected reset header");
  assert(response.headers.get("X-RateLimit-Profile") === "ai.standard", "Expected profile header");
});

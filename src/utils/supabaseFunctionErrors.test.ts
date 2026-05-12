import { describe, expect, it } from "vitest";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
  toUserFacingFunctionError,
  type ParsedFunctionInvokeError,
} from "./supabaseFunctionErrors";

describe("supabaseFunctionErrors", () => {
  it("classifies transport failures as network errors", async () => {
    const parsed = await parseFunctionInvokeError(
      new Error("Failed to send a request to the Edge Function"),
    );

    expect(parsed.category).toBe("network");
    expect(parsed.status).toBeUndefined();
  });

  it("parses context response payload and auth status", async () => {
    const response = new Response(
      JSON.stringify({ message: "Unauthorized", code: "AUTH_EXPIRED", requestId: "req-auth-1" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "req-auth-1",
        },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.status).toBe(401);
    expect(parsed.category).toBe("auth");
    expect(parsed.requestId).toBe("req-auth-1");
    expect(parsed.responsePayload?.message).toBe("Unauthorized");
    expect(parsed.responsePayload?.code).toBe("AUTH_EXPIRED");
    expect(parsed.responsePayload?.requestId).toBe("req-auth-1");
  });

  it("preserves provider details returned by function payloads", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Failed to exchange authorization code",
        details: '{"error":"invalid_grant","error_description":"AADSTS50011: redirect_uri mismatch"}',
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.backendMessage).toBe("Failed to exchange authorization code");
    expect(parsed.details).toContain("invalid_grant");
    expect(parsed.responsePayload?.details).toContain("AADSTS50011");
  });

  it("parses JSON-readable function error contexts used in mocks", async () => {
    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: {
        json: async () => ({
          error: "Invalid email or password.",
          code: "INVALID_CREDENTIALS",
        }),
      },
    });

    expect(parsed.backendMessage).toBe("Invalid email or password.");
    expect(parsed.responsePayload?.code).toBe("INVALID_CREDENTIALS");
  });

  it("preserves diagnostic failureReason payloads", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Account deletion is temporarily unavailable. Please try again later.",
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        stage: "storage_cleanup",
        failureReason: "permission",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.responsePayload?.failureReason).toBe("permission");
  });

  it("falls back to X-Request-Id when the function body omits requestId", async () => {
    const response = new Response(
      JSON.stringify({ error: "Request could not be processed right now", code: "ABUSE_CHECK_FAILED" }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "req-auth-header-only",
        },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.requestId).toBe("req-auth-header-only");
  });

  it("classifies 429 as rate_limit and preserves backend message", async () => {
    const response = new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.category).toBe("rate_limit");
    expect(parsed.backendMessage).toBe("Too many requests");
  });

  it("parses retryAfterSeconds for rate-limited responses", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfterSeconds: 45,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.retryAfterSeconds).toBe(45);
    expect(parsed.responsePayload?.retryAfterSeconds).toBe(45);
  });

  it("parses upstream provider status fields from function payload", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Failed to prepare pep talk audio",
        code: "AUDIO_PIPELINE_FAILED",
        upstream_status: 500,
        upstream_error: "ElevenLabs API error: 401",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.code).toBe("AUDIO_PIPELINE_FAILED");
    expect(parsed.responsePayload?.code).toBe("AUDIO_PIPELINE_FAILED");
    expect(parsed.upstreamStatus).toBe(500);
    expect(parsed.upstreamError).toBe("ElevenLabs API error: 401");
    expect(toUserFacingFunctionError(parsed)).toContain("provider authentication failed");
  });

  it("infers upstream provider status from legacy AI API error messages", async () => {
    const response = new Response(
      JSON.stringify({
        message: "AI API error: 400",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.status).toBe(500);
    expect(parsed.backendMessage).toBe("AI API error: 400");
    expect(parsed.upstreamStatus).toBe(400);
    expect(toUserFacingFunctionError(parsed)).toContain("temporarily unavailable");
  });

  it("marks 5xx and timeout statuses as retriable", () => {
    const fiveHundredResponse = new Response("{}", { status: 503 });
    const timeoutResponse = new Response("{}", { status: 408 });

    expect(
      isRetriableFunctionInvokeError({
        name: "FunctionsHttpError",
        context: fiveHundredResponse,
      }),
    ).toBe(true);
    expect(
      isRetriableFunctionInvokeError({
        name: "FunctionsHttpError",
        context: timeoutResponse,
      }),
    ).toBe(true);
  });

  it("does not retry non-transient 4xx errors", () => {
    const unauthorizedResponse = new Response("{}", { status: 401 });
    const rateLimitResponse = new Response("{}", { status: 429 });

    expect(
      isRetriableFunctionInvokeError({
        name: "FunctionsHttpError",
        context: unauthorizedResponse,
      }),
    ).toBe(false);
    expect(
      isRetriableFunctionInvokeError({
        name: "FunctionsHttpError",
        context: rateLimitResponse,
      }),
    ).toBe(false);
  });

  it("maps parsed errors to friendly user messages", () => {
    const networkParsed: ParsedFunctionInvokeError = {
      category: "network",
      isOffline: false,
    };
    const authParsed: ParsedFunctionInvokeError = {
      category: "auth",
      isOffline: false,
    };
    const rateLimitParsed: ParsedFunctionInvokeError = {
      category: "rate_limit",
      isOffline: false,
      backendMessage: "Daily limit reached",
    };
    const serverParsed: ParsedFunctionInvokeError = {
      category: "http",
      isOffline: false,
      status: 503,
    };
    const serverParsedWithMessage: ParsedFunctionInvokeError = {
      category: "http",
      isOffline: false,
      status: 500,
      backendMessage: "No themes configured for mentor: solace",
    };
    const audioProviderAuthError: ParsedFunctionInvokeError = {
      category: "http",
      isOffline: false,
      status: 500,
      code: "AUDIO_PIPELINE_FAILED",
      upstreamStatus: 500,
      upstreamError: "ElevenLabs API error: 401",
      backendMessage: "Failed to prepare pep talk audio",
    };
    const audioProviderCreditsError: ParsedFunctionInvokeError = {
      category: "http",
      isOffline: false,
      status: 500,
      code: "AUDIO_GENERATION_FAILED",
      upstreamError: "ElevenLabs API error: 402",
      backendMessage: "Failed to generate audio",
    };
    const audioProviderRateLimitError: ParsedFunctionInvokeError = {
      category: "rate_limit",
      isOffline: false,
      status: 429,
      code: "AUDIO_PIPELINE_FAILED",
      upstreamStatus: 429,
      backendMessage: "Failed to prepare pep talk audio",
    };
    const unknownParsed: ParsedFunctionInvokeError = {
      category: "unknown",
      isOffline: false,
    };
    const rateLimitWithRetryHint: ParsedFunctionInvokeError = {
      category: "rate_limit",
      isOffline: false,
      retryAfterSeconds: 30,
    };
    const genericRateLimitWithRetryHint: ParsedFunctionInvokeError = {
      category: "rate_limit",
      isOffline: false,
      backendMessage: "Rate limit exceeded",
      retryAfterSeconds: 45,
    };
    const pepTalkInProgress: ParsedFunctionInvokeError = {
      category: "http",
      isOffline: false,
      status: 409,
      code: "PEP_TALK_REQUEST_IN_PROGRESS",
      backendMessage: "Pep talk generation is already in progress.",
    };
    const rateLimitWithPipelineWrapper: ParsedFunctionInvokeError = {
      category: "rate_limit",
      isOffline: false,
      backendMessage: "Failed to prepare pep talk audio",
      retryAfterSeconds: 45,
    };
    const technicalAudioPipelineWrapper: ParsedFunctionInvokeError = {
      category: "http",
      isOffline: false,
      status: 500,
      backendMessage: "Failed to prepare pep talk audio",
    };

    expect(
      toUserFacingFunctionError(networkParsed, { action: "evolve your companion" }),
    ).toContain("Check your connection");
    expect(
      toUserFacingFunctionError(authParsed, { action: "evolve your companion" }),
    ).toContain("session has expired");
    expect(toUserFacingFunctionError(rateLimitParsed)).toBe("Daily limit reached");
    expect(toUserFacingFunctionError(serverParsed)).toContain("temporarily unavailable");
    expect(toUserFacingFunctionError(serverParsedWithMessage)).toBe("No themes configured for mentor: solace");
    expect(toUserFacingFunctionError(audioProviderAuthError)).toContain("provider authentication failed");
    expect(toUserFacingFunctionError(audioProviderCreditsError)).toContain("credits are exhausted");
    expect(toUserFacingFunctionError(audioProviderRateLimitError)).toContain("Voice generation is being rate-limited");
    expect(toUserFacingFunctionError(rateLimitWithRetryHint)).toContain("30 seconds");
    expect(toUserFacingFunctionError(genericRateLimitWithRetryHint)).toContain("45 seconds");
    expect(toUserFacingFunctionError(pepTalkInProgress)).toContain("still being prepared");
    expect(toUserFacingFunctionError(rateLimitWithPipelineWrapper)).toContain("45 seconds");
    expect(toUserFacingFunctionError(technicalAudioPipelineWrapper)).toContain("temporarily unavailable");
    expect(
      toUserFacingFunctionError(unknownParsed, { action: "evolve your companion" }),
    ).toBe("Unable to evolve your companion. Please try again.");
  });
});

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
      JSON.stringify({ message: "Unauthorized", code: "AUTH_EXPIRED" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );

    const parsed = await parseFunctionInvokeError({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: response,
    });

    expect(parsed.status).toBe(401);
    expect(parsed.category).toBe("auth");
    expect(parsed.responsePayload?.message).toBe("Unauthorized");
    expect(parsed.responsePayload?.code).toBe("AUTH_EXPIRED");
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
    const unknownParsed: ParsedFunctionInvokeError = {
      category: "unknown",
      isOffline: false,
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
    expect(
      toUserFacingFunctionError(unknownParsed, { action: "evolve your companion" }),
    ).toBe("Unable to evolve your companion. Please try again.");
  });
});

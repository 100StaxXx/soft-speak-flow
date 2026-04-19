import { describe, expect, it } from "vitest";

import {
  resolveCompanionPlannerError,
  toUserFacingCompanionPlannerError,
} from "./companionPlannerErrors";

describe("companionPlannerErrors", () => {
  it("maps missing function responses to a rollout-aware message", async () => {
    await expect(
      resolveCompanionPlannerError({
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response("", { status: 404 }),
      }),
    ).resolves.toBe(
      "Companion Planner isn't live in this environment yet. Please try again after the backend is updated.",
    );
  });

  it("maps planner setup errors to a setup-aware message", async () => {
    await expect(
      resolveCompanionPlannerError({
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({
          code: "PGRST202",
          error: "Could not find the function public.consume_abuse_protection(p_profile_key, p_endpoint_name, p_user_id, p_ip_address, p_email_target, p_request_id, p_metadata) in the schema cache",
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      }),
    ).resolves.toBe(
      "Companion Planner is still being set up here. Please try again after the latest database update.",
    );
  });

  it("falls back to the generic function error mapper for server failures", () => {
    expect(
      toUserFacingCompanionPlannerError({
        category: "http",
        isOffline: false,
        status: 503,
      }),
    ).toBe("Our servers are temporarily unavailable. Please try again in a moment.");
  });
});

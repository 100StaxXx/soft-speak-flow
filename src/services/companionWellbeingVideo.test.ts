import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestWellbeingClip } from "./companionWellbeingVideo";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
const input = { action: "prepare" as const, companionId: "one", category: "mind" as const, stage: 1, sourceImageUrl: "image.png" };
describe("Video preparation responses", () => {
  beforeEach(() => vi.clearAllMocks());
  it("treats a missing clip as not generated, never a playback error", async () => {
    mocks.invoke.mockResolvedValue({ data: { clip: null }, error: null });
    expect(await requestWellbeingClip(input)).toEqual({ status: "not_generated", video_url: null });
  });
  it.each([
    [403, "access_required", /active trial or subscription/],
    [403, null, /isn’t available for this account/],
    [429, "rate_limited", /tomorrow/],
    [409, "appearance_changed", /companion has changed/],
    [503, "service_unavailable", /temporarily unavailable/],
    [401, null, /session is reconnecting/],
  ])("explains HTTP %s accurately", async (status, code, message) => {
    mocks.invoke.mockResolvedValue({ data: null, error: { name: "FunctionsHttpError", context: new Response(JSON.stringify({ code, error: "backend detail" }), { status: status as number }) } });
    await expect(requestWellbeingClip(input)).rejects.toThrow(message as RegExp);
  });
  it("recognizes portrait preparation returned in an older non-2xx envelope", async () => {
    mocks.invoke.mockResolvedValue({ error: { context: new Response(JSON.stringify({ code: "portrait_pending" }), { status: 409 }) } });
    expect((await requestWellbeingClip(input)).status).toBe("awaiting_portrait");
  });
});

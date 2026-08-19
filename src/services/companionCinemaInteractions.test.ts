import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import {
  getCompanionCinemaHistory,
  resolveCinemaEventSummary,
  revealCompanionCinemaEvent,
  startCompanionCinemaInteraction,
} from "./companionCinemaInteractions";

describe("companion cinema interaction service", () => {
  beforeEach(() => mocks.invoke.mockReset());

  it("starts a personalized Forge and returns quota visibility", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        run: { id: "run-1", interaction_type: "forge", status: "active" },
        quota: { dailyRemaining: 0, monthlyRemaining: 7 },
      },
      error: null,
    });
    const result = await startCompanionCinemaInteraction({
      interactionType: "forge",
      intention: "Ship the beta",
      expectedMinutes: 20,
    });
    expect(mocks.invoke).toHaveBeenCalledWith(
      "manage-companion-cinema-interaction",
      {
        body: {
          action: "start",
          interactionType: "forge",
          intention: "Ship the beta",
          expectedMinutes: 20,
        },
      },
    );
    expect(result.quota?.dailyRemaining).toBe(0);
  });

  it("loads durable history and reveals stored rewards", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { runs: [{ id: "run-1" }] }, error: null })
      .mockResolvedValueOnce({
        data: {
          eventId: "event-1",
          status: "revealed",
          ready: true,
          reward: { type: "relic", title: "Stormglass Sigil" },
        },
        error: null,
      });
    expect((await getCompanionCinemaHistory()).runs).toHaveLength(1);
    expect((await revealCompanionCinemaEvent("event-1")).reward?.title).toBe(
      "Stormglass Sigil",
    );
  });

  it("normalizes PostgREST to-one relationships", () => {
    const event = { id: "event-1", status: "ready" };
    expect(resolveCinemaEventSummary([event])).toEqual(event);
    expect(resolveCinemaEventSummary(event)).toEqual(event);
    expect(resolveCinemaEventSummary([])).toBeNull();
  });

  it("surfaces the server's safe quota message instead of a generic function error", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error:
              "That cinematic has reached its daily limit. It will be available again tomorrow.",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    await expect(startCompanionCinemaInteraction({
      interactionType: "hunt",
    })).rejects.toThrow("That cinematic has reached its daily limit");
  });
});

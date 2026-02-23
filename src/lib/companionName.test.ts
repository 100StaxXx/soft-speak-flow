import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveCompanionName } from "@/lib/companionName";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  evolutionMaybeSingle: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

describe("resolveCompanionName", () => {
  beforeEach(() => {
    mocks.evolutionMaybeSingle.mockReset();
    mocks.updateEq.mockReset();
    mocks.from.mockReset();

    mocks.evolutionMaybeSingle.mockResolvedValue({ data: null });
    mocks.updateEq.mockResolvedValue({ data: null, error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "companion_evolution_cards") {
        const chain = {
          select: vi.fn(),
          eq: vi.fn(),
          maybeSingle: mocks.evolutionMaybeSingle,
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        return chain;
      }

      if (table === "user_companion") {
        const chain = {
          update: vi.fn(),
          eq: mocks.updateEq,
        };
        chain.update.mockReturnValue(chain);
        return chain;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("returns explicit override when provided", async () => {
    const value = await resolveCompanionName({
      companion: {
        id: "comp-1",
        current_stage: 1,
        cached_creature_name: "Nova",
        spirit_animal: "eagle",
      },
      overrideName: "Zephyr",
      fallback: "empty",
    });

    expect(value).toBe("Zephyr");
    expect(mocks.evolutionMaybeSingle).not.toHaveBeenCalled();
  });

  it("uses cached name before any query", async () => {
    const value = await resolveCompanionName({
      companion: {
        id: "comp-2",
        current_stage: 2,
        cached_creature_name: "Astra",
        spirit_animal: "wolf",
      },
      fallback: "empty",
    });

    expect(value).toBe("Astra");
    expect(mocks.evolutionMaybeSingle).not.toHaveBeenCalled();
  });

  it("fetches current-stage name and writes cache", async () => {
    mocks.evolutionMaybeSingle.mockResolvedValue({ data: { creature_name: "Solis" } });

    const value = await resolveCompanionName({
      companion: {
        id: "comp-3",
        current_stage: 3,
        cached_creature_name: null,
        spirit_animal: "eagle",
      },
      fallback: "empty",
    });

    expect(value).toBe("Solis");
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "comp-3");
  });

  it("supports empty fallback policy", async () => {
    const value = await resolveCompanionName({
      companion: {
        id: "comp-4",
        current_stage: 4,
        cached_creature_name: null,
        spirit_animal: "eagle",
      },
      fallback: "empty",
    });

    expect(value).toBe("");
  });

  it("supports species fallback policy with capitalization", async () => {
    const value = await resolveCompanionName({
      companion: {
        id: "comp-5",
        current_stage: 5,
        cached_creature_name: null,
        spirit_animal: "snow fox",
      },
      fallback: "species",
    });

    expect(value).toBe("Snow Fox");
  });
});

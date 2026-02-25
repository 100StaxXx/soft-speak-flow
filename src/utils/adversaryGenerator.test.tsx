import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();

  return {
    fromMock,
    insertPayload: null as Record<string, unknown> | null,
    recentEncounterRows: [] as Array<Record<string, unknown>>,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: { id: "companion-1" },
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkAdversaryDefeatAchievements: vi.fn().mockResolvedValue({
      shouldRollLoot: false,
      lootTier: null,
    }),
  }),
}));

vi.mock("@/hooks/useLivingCompanion", () => ({
  useLivingCompanionSafe: () => ({
    triggerResistVictory: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import * as adversaryGeneratorModule from "@/utils/adversaryGenerator";
import { useAstralEncounters } from "@/hooks/useAstralEncounters";
import { generateAdversary } from "@/utils/adversaryGenerator";
import { RESIST_RANDOM_MINIGAME_POOL, type Adversary } from "@/types/astralEncounters";

const COMMON_DISTRACTION_POOL = [
  "Riftling Wisp",
  "Riftling Shade",
  "Riftling Specter",
  "Riftling Phantom",
  "Scatter Wisp",
  "Scatter Shade",
  "Scatter Specter",
  "Scatter Phantom",
  "Flickering Wisp",
  "Flickering Shade",
  "Flickering Specter",
  "Flickering Phantom",
  "Wandering Wisp",
  "Wandering Shade",
  "Wandering Specter",
  "Wandering Phantom",
];

const createEncounterRow = (id: string, name: string, miniGameType = "tap_sequence") => ({
  id,
  user_id: "user-1",
  companion_id: "companion-1",
  adversary_name: name,
  adversary_theme: "distraction",
  adversary_tier: "common",
  adversary_lore: "Stored lore",
  mini_game_type: miniGameType,
  trigger_type: "quest_milestone",
  trigger_source_id: null,
  result: null,
  accuracy_score: null,
  xp_earned: 0,
  essence_earned: null,
  stat_boost_type: null,
  stat_boost_amount: 0,
  phases_completed: 0,
  total_phases: 1,
  started_at: new Date().toISOString(),
  completed_at: null,
  retry_available_at: null,
  created_at: new Date().toISOString(),
});

const getSelectResultForTable = (table: string) => {
  if (table === "astral_encounters") {
    return { data: mocks.recentEncounterRows, error: null };
  }

  return { data: [], error: null };
};

const createFromBuilder = (table: string) => {
  const builder: Record<string, unknown> = {};

  const returnBuilder = () => builder;
  const resolveSelect = () => getSelectResultForTable(table);

  builder.select = vi.fn(returnBuilder);
  builder.eq = vi.fn(returnBuilder);
  builder.is = vi.fn(returnBuilder);
  builder.in = vi.fn(returnBuilder);
  builder.order = vi.fn(returnBuilder);
  builder.limit = vi.fn(async () => resolveSelect());
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.update = vi.fn(returnBuilder);
  builder.delete = vi.fn(returnBuilder);
  builder.insert = vi.fn((payload: Record<string, unknown>) => {
    mocks.insertPayload = payload;
    return builder;
  });
  builder.single = vi.fn(async () => {
    if (table === "astral_encounters") {
      const adversaryName = typeof mocks.insertPayload?.adversary_name === "string"
        ? mocks.insertPayload.adversary_name
        : "Spawned Enemy";

      return {
        data: {
          ...createEncounterRow("enc-new", adversaryName),
          ...mocks.insertPayload,
        },
        error: null,
      };
    }

    return { data: null, error: null };
  });

  // Support `await supabase.from(...).select(...).eq(...).order(...)` chains.
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    resolve(resolveSelect());

  return builder;
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const withMockedRandom = async (value: number, run: () => void | Promise<void>) => {
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(value);
  try {
    await run();
  } finally {
    randomSpy.mockRestore();
  }
};

describe("generateAdversary reusable roster", () => {
  it("returns valid adversaries across tier paths", async () => {
    await withMockedRandom(0, () => {
      const common = generateAdversary("quest_milestone");
      const uncommon = generateAdversary("epic_checkpoint", 40);
      const rare = generateAdversary("epic_checkpoint", 50);
      const epic = generateAdversary("epic_checkpoint", 75);
      const legendary = generateAdversary("epic_checkpoint", 100);

      expect(common.tier).toBe("common");
      expect(uncommon.tier).toBe("uncommon");
      expect(rare.tier).toBe("rare");
      expect(epic.tier).toBe("epic");
      expect(legendary.tier).toBe("legendary");

      [common, uncommon, rare, epic, legendary].forEach((adversary) => {
        expect(adversary.name.length).toBeGreaterThan(0);
        expect(adversary.lore.length).toBeGreaterThan(0);
      });
    });
  });

  it("honors avoidNames when alternate names exist", async () => {
    await withMockedRandom(0, () => {
      const adversary = generateAdversary(
        "urge_resist",
        undefined,
        "distraction",
        undefined,
        { avoidNames: ["Riftling Wisp"] },
      );

      expect(adversary.theme).toBe("distraction");
      expect(adversary.name).not.toBe("Riftling Wisp");
      expect(COMMON_DISTRACTION_POOL).toContain(adversary.name);
    });
  });

  it("falls back safely when all candidates are excluded", async () => {
    await withMockedRandom(0, () => {
      const adversary = generateAdversary(
        "urge_resist",
        undefined,
        "distraction",
        undefined,
        { avoidNames: COMMON_DISTRACTION_POOL },
      );

      expect(adversary.theme).toBe("distraction");
      expect(COMMON_DISTRACTION_POOL).toContain(adversary.name);
      expect(adversary.lore.length).toBeGreaterThan(0);
    });
  });

  it("uses only the resist random mini-game pool for urge_resist encounters", async () => {
    await withMockedRandom(0, () => {
      const adversary = generateAdversary("urge_resist", undefined, "distraction");

      expect(RESIST_RANDOM_MINIGAME_POOL).toContain(adversary.miniGameType);
    });
  });

  it("avoids the last two mini-games for urge_resist when alternatives exist", async () => {
    await withMockedRandom(0, () => {
      const adversary = generateAdversary(
        "urge_resist",
        undefined,
        "distraction",
        undefined,
        { recentMiniGames: ["energy_beam", "tap_sequence"] },
      );

      expect(adversary.miniGameType).toBe("orb_match");
      expect(adversary.miniGameType).not.toBe("energy_beam");
      expect(adversary.miniGameType).not.toBe("tap_sequence");
    });
  });

  it("falls back to full resist mini-game pool when recent history excludes all options", async () => {
    await withMockedRandom(0, () => {
      const adversary = generateAdversary(
        "urge_resist",
        undefined,
        "distraction",
        undefined,
        { recentMiniGames: [...RESIST_RANDOM_MINIGAME_POOL] },
      );

      expect(adversary.miniGameType).toBe("energy_beam");
      expect(RESIST_RANDOM_MINIGAME_POOL).toContain(adversary.miniGameType);
    });
  });
});

describe("useAstralEncounters roster integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertPayload = null;
    mocks.recentEncounterRows = [
      createEncounterRow("enc-1", "Enemy 1", "orb_match"),
      createEncounterRow("enc-2", "Enemy 2", "energy_beam"),
      createEncounterRow("enc-3", "Enemy 3", "invalid_mini_game"),
      ...Array.from({ length: 9 }, (_, index) =>
        createEncounterRow(`enc-${index + 4}`, `Enemy ${index + 4}`),
      ),
    ];
    mocks.fromMock.mockImplementation((table: string) => createFromBuilder(table));
  });

  it("passes recent 10 adversary names into generateAdversary options", async () => {
    const generatedAdversary: Adversary = {
      name: "Reusable Wisp",
      theme: "distraction",
      tier: "common",
      lore: "Reusable lore",
      miniGameType: "tap_sequence",
      phases: 1,
      essenceName: "Focus Essence",
      essenceDescription: "Reusable essence description",
      statType: "mind",
      statBoost: 1,
    };

    const generateAdversarySpy = vi
      .spyOn(adversaryGeneratorModule, "generateAdversary")
      .mockReturnValue(generatedAdversary);

    const { result } = renderHook(() => useAstralEncounters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.encounters?.length).toBe(12);
    });

    await act(async () => {
      await result.current.startEncounterAsync({
        triggerType: "quest_milestone",
      });
    });

    expect(generateAdversarySpy).toHaveBeenCalledTimes(1);
    expect(generateAdversarySpy.mock.calls[0][4]).toEqual({
      avoidNames: [
        "Enemy 1",
        "Enemy 2",
        "Enemy 3",
        "Enemy 4",
        "Enemy 5",
        "Enemy 6",
        "Enemy 7",
        "Enemy 8",
        "Enemy 9",
        "Enemy 10",
      ],
      recentMiniGames: ["orb_match", "energy_beam"],
    });

    expect(mocks.insertPayload).toMatchObject({
      adversary_name: generatedAdversary.name,
      adversary_theme: generatedAdversary.theme,
      adversary_tier: generatedAdversary.tier,
      adversary_lore: generatedAdversary.lore,
      mini_game_type: generatedAdversary.miniGameType,
    });
  });
});

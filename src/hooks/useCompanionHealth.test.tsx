import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();

  return {
    fromMock,
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: "fox",
      favorite_color: "#22c55e",
      spirit_animal: "Fox",
      core_element: "nature",
      current_stage: 5,
      current_xp: 120,
      current_image_url: "https://example.com/custom-current.png",
      current_image_focal_x: 0.43,
      current_image_focal_y: 0.57,
      neglected_image_url: "https://example.com/custom-neglected.png",
      neglected_image_focal_x: 0.28,
      neglected_image_focal_y: 0.72,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    storage: {
      from: () => ({
        getPublicUrl: (assetPath: string) => ({
          data: {
            publicUrl: `https://example.com/storage/v1/object/public/companion-presets/${assetPath}`,
          },
        }),
      }),
    },
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("./useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
  }),
}));

import { useCompanionHealth } from "./useCompanionHealth";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createBuilder = (table: string) => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      if (table === "user_companion") {
        return {
          data: {
            inactive_days: 0,
            last_activity_date: "2026-04-15",
            neglected_image_url: "https://example.com/custom-neglected.png",
            neglected_image_focal_x: 0.28,
            neglected_image_focal_y: 0.72,
            current_mood: "happy",
            body: 88,
            mind: 77,
            soul: 66,
            current_image_url: "https://example.com/custom-current.png",
            current_image_focal_x: 0.43,
            current_image_focal_y: 0.57,
            is_alive: true,
            hunger: 95,
            happiness: 93,
            care_score: 91,
            recovery_progress: 100,
          },
          error: null,
        };
      }

      if (table === "profiles") {
        return {
          data: {
            streak_freezes_available: 1,
            last_streak_freeze_used: null,
            streak_freezes_reset_at: null,
          },
          error: null,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return builder;
};

describe("useCompanionHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromMock.mockImplementation((table: string) => createBuilder(table));
  });

  it("resolves canonical preset art for normal and neglected images when stored URLs are custom", async () => {
    const { result } = renderHook(() => useCompanionHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.health.imageUrl).toBe(
        "https://example.com/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__nature.png",
      );
    });

    expect(result.current.health.imageFocalX).toBeNull();
    expect(result.current.health.imageFocalY).toBeNull();
    expect(result.current.health.neglectedImageUrl).toBe(
      "https://example.com/storage/v1/object/public/companion-presets/fox/t2_guardian/neglected/fox__t2_guardian__neglected__nature.png",
    );
    expect(result.current.health.neglectedImageFocalX).toBeNull();
    expect(result.current.health.neglectedImageFocalY).toBeNull();
  });
});

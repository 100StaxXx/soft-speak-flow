import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    preset_id: "fox",
    current_stage: 5,
    core_element: "nature",
    current_image_url: "https://example.com/custom-current.png",
    current_image_focal_x: 0.41,
    current_image_focal_y: 0.59,
    dormant_image_url: "https://example.com/custom-dormant.png",
    dormant_image_focal_x: 0.22,
    dormant_image_focal_y: 0.78,
    cached_creature_name: "Nova",
    spirit_animal: "Fox",
  },
  triggerEvent: vi.fn(),
  resolveCompanionNameMock: vi.fn(async () => "Nova"),
  localStorageMock: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
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

vi.mock("./useCompanionCareSignals", () => ({
  useCompanionCareSignals: () => ({
    isLoading: false,
    care: {
      dormancy: {
        isDormant: false,
      },
      bond: {
        level: 3,
      },
    },
  }),
}));

vi.mock("@/lib/companionName", () => ({
  resolveCompanionName: mocks.resolveCompanionNameMock,
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    triggerEvent: mocks.triggerEvent,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (assetPath: string) => ({
          data: {
            publicUrl: `https://example.com/storage/v1/object/public/companion-presets/${assetPath}`,
          },
        }),
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

import { useCompanionWakeUp } from "./useCompanionWakeUp";

describe("useCompanionWakeUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", mocks.localStorageMock);
  });

  it("exposes canonical preset art for wake-up and dormant states when stored URLs are custom", async () => {
    const { result } = renderHook(() => useCompanionWakeUp());

    await waitFor(() => {
      expect(result.current.companionName).toBe("Nova");
    });

    expect(result.current.companionImageUrl).toBe(
      "https://example.com/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__nature.png",
    );
    expect(result.current.companionImageFocalX).toBeNull();
    expect(result.current.companionImageFocalY).toBeNull();
    expect(result.current.dormantImageUrl).toBe(
      "https://example.com/storage/v1/object/public/companion-presets/fox/t2_guardian/dormant/fox__t2_guardian__dormant__nature.png",
    );
    expect(result.current.dormantImageFocalX).toBeNull();
    expect(result.current.dormantImageFocalY).toBeNull();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWallpaperCatalog } from "@/components/AdminWallpaperCatalog";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

const wallpaperAssets = [
  {
    id: "asset-1",
    page_key: "quests",
    source_kind: "generated",
    prompt_text: "prompt",
    prompt_version: 2,
    render_model: "gpt-image-1",
    storage_path: "quests/2026-04-08/batch/file.png",
    image_url: "https://example.com/quests.png",
    image_width: 1024,
    image_height: 1536,
    mobile_focus_x: 50,
    mobile_focus_y: 50,
    desktop_focus_x: 50,
    desktop_focus_y: 50,
    publish_state: "ready",
    validation_result: {
      scenicQualityScore: 90,
      moodMatchScore: 88,
      detailScore: 84,
      contrastScore: 76,
      rejectionReasons: [],
      notes: ["sharp"],
    },
    generation_error: null,
    generation_date: "2026-04-08",
    generated_at: "2026-04-08T10:00:00.000Z",
    created_at: "2026-04-08T10:00:00.000Z",
    updated_at: "2026-04-08T10:00:00.000Z",
    variant_key: "quests-desert-trail-dawn",
    batch_label: "landscape-diverse-v1-2026-04-08T10-00-00-000Z",
  },
];

const liveAssignments = [
  {
    page_key: "quests",
    wallpaper_asset_id: "asset-1",
  },
];

describe("AdminWallpaperCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockImplementation((table: string) => {
      if (table === "wallpaper_assets") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: wallpaperAssets, error: null }),
            }),
          }),
        };
      }

      if (table === "daily_wallpaper_assignments") {
        return {
          select: () => ({
            eq: async () => ({ data: liveAssignments, error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    });

    mocks.invoke.mockResolvedValue({
      data: {
        acceptedCount: 7,
        promoted: [{ pageKey: "quests", assetId: "asset-1" }],
      },
      error: null,
    });
  });

  it("shows batch metadata and marks the latest live asset as promoted", async () => {
    render(<AdminWallpaperCatalog />);

    await screen.findByText("Quests");

    expect(screen.getByText("Promoted live")).toBeInTheDocument();
    expect(screen.getByText(/landscape-diverse-v1-2026-04-08/i)).toBeInTheDocument();
    expect(screen.getByText("Desert Trail Dawn")).toBeInTheDocument();
  });

  it("triggers the fixed backlog generation flow from the admin action", async () => {
    render(<AdminWallpaperCatalog />);

    fireEvent.click(await screen.findByRole("button", { name: /generate 10 landscapes/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("generate-wallpaper-backlog", {
        body: {
          batchPreset: "landscape-diverse-v1",
          promoteNow: true,
        },
      });
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Generated 7 ready wallpapers. Promoted 1 live today.");
  });
});

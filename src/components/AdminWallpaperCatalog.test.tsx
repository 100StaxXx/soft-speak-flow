import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    variant_key: "quests-desert-trail-first-light",
    batch_label: "rotate-2026-04-08-2026-04-08T10-00-00-000Z",
  },
];

const liveAssignments = [
  {
    id: "assignment-1",
    page_key: "quests",
    for_date: "2026-04-08",
    wallpaper_asset_id: "asset-1",
    assignment_source: "auto",
    created_at: "2026-04-08T10:01:00.000Z",
    updated_at: "2026-04-08T10:01:00.000Z",
  },
];

describe("AdminWallpaperCatalog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T18:00:00.000Z"));
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
        outcomes: [
          { pageKey: "quests", dateKey: "2026-04-08", status: "generated", assetId: "asset-1" },
          { pageKey: "campaigns", dateKey: "2026-04-08", status: "carry_forward", assetId: "asset-2" },
        ],
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderCatalog = async () => {
    render(<AdminWallpaperCatalog />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it("shows batch metadata and marks the latest live asset as promoted", async () => {
    await renderCatalog();

    expect(screen.getByText("Promoted live")).toBeInTheDocument();
    expect(screen.getByText(/rotate-2026-04-08-2026-04-08/i)).toBeInTheDocument();
    expect(screen.getByText("Desert Trail / First Light")).toBeInTheDocument();
    expect(screen.getByText(/Assignment source:/i)).toHaveTextContent("auto");
  });

  it("triggers the daily wallpaper regeneration flow from the admin action", async () => {
    await renderCatalog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /regenerate daily set/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.invoke).toHaveBeenCalledWith("rotate-daily-wallpapers", {
      body: {
        startDate: "2026-04-08",
        daysAhead: 4,
        candidateCount: 3,
        force: true,
      },
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Regenerated the daily wallpaper set. 1 pages got new art and 1 pages carried forward.",
    );
  });

  it("refreshes the catalog after the regeneration call settles", async () => {
    await renderCatalog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /regenerate daily set/i }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.from).toHaveBeenCalledWith("wallpaper_assets");
    expect(mocks.from).toHaveBeenCalledWith("daily_wallpaper_assignments");
  });
});

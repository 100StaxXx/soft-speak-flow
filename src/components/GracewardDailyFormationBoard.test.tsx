import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyFormationCategory } from "@/data/dailyFormationPractices";
import type { Companion } from "@/hooks/useCompanion";

const mocks = vi.hoisted(() => ({
  completePractice: {
    Mind: vi.fn().mockResolvedValue(undefined),
    Body: vi.fn().mockResolvedValue(undefined),
    Soul: vi.fn().mockResolvedValue(undefined),
  } satisfies Record<DailyFormationCategory, ReturnType<typeof vi.fn>>,
  completed: {
    Mind: false,
    Body: false,
    Soul: false,
  } satisfies Record<DailyFormationCategory, boolean>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { timezone: "America/Los_Angeles" } }),
}));

vi.mock("@/utils/timezone", () => ({
  getEffectiveDailyDate: () => "2026-08-11",
}));

vi.mock("@/hooks/useAdaptiveDailyFormation", () => ({
  useAdaptiveDailyFormation: ({
    category,
  }: {
    category: DailyFormationCategory;
    enabled: boolean;
  }) => ({
    assignment: {
      completedAt: mocks.completed[category] ? "2026-08-11T18:00:00.000Z" : null,
    },
    practice: {
      title: `${category} practice`,
      action: `Take the next ${category.toLowerCase()} step.`,
      minutes: category === "Body" ? 10 : 5,
      xpReward: 15,
    },
    isLoading: false,
    isCompleting: false,
    completePractice: mocks.completePractice[category],
  }),
}));

import { GracewardDailyFormationBoard } from "./GracewardDailyFormationBoard";

const makeCompanion = (overrides: Partial<Companion> = {}): Companion => ({
  id: "companion-1",
  user_id: "user-1",
  preset_id: "lion",
  favorite_color: "#D6B86A",
  spirit_animal: "Lion",
  core_element: "light",
  current_stage: 4,
  current_xp: 300,
  current_image_url: "/lion.png",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-11T00:00:00.000Z",
  ...overrides,
});

const finishLatestFormationMedia = (callback: ReturnType<typeof vi.fn>) => {
  const media = callback.mock.calls.at(-1)?.[0] as { onPlaybackComplete?: () => void } | undefined;
  act(() => media?.onPlaybackComplete?.());
};

describe("GracewardDailyFormationBoard", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.completed.Mind = false;
    mocks.completed.Body = false;
    mocks.completed.Soul = false;
    Object.values(mocks.completePractice).forEach((completePractice) => {
      completePractice.mockClear();
      completePractice.mockResolvedValue(undefined);
    });
  });

  it("places compact Mind, Body, and Soul controls under the companion and reveals the real practice", async () => {
    const onFormationMediaChange = vi.fn();
    render(
      <GracewardDailyFormationBoard
        companion={makeCompanion()}
        onFormationMediaChange={onFormationMediaChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Mind" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Body" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Soul" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mind" }));

    expect(screen.getByText(/preparing today’s mind practice/i)).toBeInTheDocument();
    expect(screen.queryByText("Mind practice")).not.toBeInTheDocument();
    finishLatestFormationMedia(onFormationMediaChange);
    expect(await screen.findByText("Mind practice")).toBeInTheDocument();
    expect(screen.getByText("Take the next mind step.")).toBeInTheDocument();
    expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "Mind",
      playVideo: true,
      videoUrl: expect.stringMatching(/^\/graceward-motion\/v1\/lion\/light\/mind-[123]\.mp4$/),
      stillUrl: expect.stringMatching(/^\/graceward-motion\/v1\/lion\/light\/mind-[123]\.jpg$/),
    }));
  });

  it("plays a pillar animation only on its first reveal and keeps the finish frame afterward", () => {
    const onFormationMediaChange = vi.fn();
    render(
      <GracewardDailyFormationBoard
        companion={makeCompanion()}
        onFormationMediaChange={onFormationMediaChange}
      />,
    );

    const bodyButton = screen.getByRole("button", { name: "Body" });
    fireEvent.click(bodyButton);
    expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "Body",
      playVideo: true,
    }));

    fireEvent.click(bodyButton);
    expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "Body",
      playVideo: false,
    }));
  });

  it("restores the selected finish frame without replaying when the screen remounts", async () => {
    localStorage.setItem("graceward:formation-active:v1:user-1:2026-08-11", "Soul");
    localStorage.setItem("graceward:formation-reveals:v1:user-1:2026-08-11", "[\"Soul\"]");
    const onFormationMediaChange = vi.fn();

    render(
      <GracewardDailyFormationBoard
        companion={makeCompanion({ spirit_animal: "Dove", preset_id: "dove", core_element: "nature" })}
        onFormationMediaChange={onFormationMediaChange}
      />,
    );

    expect(await screen.findByText("Soul practice")).toBeInTheDocument();
    await waitFor(() => {
      expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
        category: "Soul",
        playVideo: false,
        videoUrl: expect.stringMatching(/^\/graceward-motion\/v1\/dove\/nature\/soul-[123]\.mp4$/),
        stillUrl: expect.stringMatching(/^\/graceward-motion\/v1\/dove\/nature\/soul-[123]\.jpg$/),
      }));
    });
  });

  it("clears the finish frame after the practice is completed", async () => {
    const onFormationMediaChange = vi.fn();
    render(
      <GracewardDailyFormationBoard
        companion={makeCompanion()}
        onFormationMediaChange={onFormationMediaChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Soul" }));
    finishLatestFormationMedia(onFormationMediaChange);
    fireEvent.click(await screen.findByRole("button", { name: "Mark practice complete" }));

    await waitFor(() => expect(mocks.completePractice.Soul).toHaveBeenCalledTimes(1));
    expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "Soul",
      phase: "completion",
      reaction: "encourage",
      playVideo: true,
      videoUrl: "/graceward-motion/v1/lion/light/reaction-encourage.mp4",
    }));
  });

  it("keeps the finish frame when completion cannot be saved", async () => {
    mocks.completePractice.Mind.mockRejectedValueOnce(new Error("offline"));
    const onFormationMediaChange = vi.fn();
    render(
      <GracewardDailyFormationBoard
        companion={makeCompanion()}
        onFormationMediaChange={onFormationMediaChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mind" }));
    finishLatestFormationMedia(onFormationMediaChange);
    fireEvent.click(await screen.findByRole("button", { name: "Mark practice complete" }));

    await waitFor(() => expect(mocks.completePractice.Mind).toHaveBeenCalledTimes(1));
    expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "Mind",
      playVideo: true,
    }));
  });

  it("keeps the controls available for legacy Graceward forms with an animated prop fallback", () => {
    const onFormationMediaChange = vi.fn();
    render(
      <GracewardDailyFormationBoard
        companion={makeCompanion({ spirit_animal: "Wolf", preset_id: "wolf", core_element: "nature" })}
        onFormationMediaChange={onFormationMediaChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mind" }));

    expect(screen.getByTestId("graceward-formation-controls")).toBeInTheDocument();
    expect(onFormationMediaChange).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "Mind",
      playVideo: true,
      videoUrl: null,
      stillUrl: null,
      phase: "practice",
    }));
  });

  it("does not show formation controls before a companion hatches", () => {
    render(<GracewardDailyFormationBoard companion={makeCompanion({ current_stage: 0 })} />);
    expect(screen.queryByTestId("graceward-formation-controls")).not.toBeInTheDocument();
  });
});

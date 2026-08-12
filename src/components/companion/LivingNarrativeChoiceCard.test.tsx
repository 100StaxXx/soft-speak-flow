import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionNarrativeChoice, LivingNarrativePrompt } from "@/types/livingNarrative";

const mocks = vi.hoisted(() => ({
  choice: null as CompanionNarrativeChoice | null,
  recordChoice: vi.fn(),
  updateSideQuest: vi.fn(),
  acceptSideQuest: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useLivingNarrativeChoice", () => ({
  useLivingNarrativeChoice: () => ({
    choice: mocks.choice,
    isLoading: false,
    error: null,
    recordChoice: { isPending: false, mutateAsync: mocks.recordChoice },
    updateSideQuest: { isPending: false, mutateAsync: mocks.updateSideQuest },
    acceptSideQuest: { isPending: false, mutateAsync: mocks.acceptSideQuest },
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));

import { LivingNarrativeChoiceCard } from "./LivingNarrativeChoiceCard";

const prompt: LivingNarrativePrompt = {
  promptKey: "chapter_compass_v1",
  contextLabel: "Prologue: The Glass Signal",
  question: "What should Nova carry forward?",
  options: [
    {
      key: "wisdom",
      label: "The lesson",
      detail: "Attention turns uncertainty into a path.",
      memoryType: "reflection",
      memorySummary: "The user chose attention.",
      consequenceTags: ["wisdom"],
      companionReply: "Then we will practice it.",
      sideQuestTitle: "Practice one lesson",
    },
    {
      key: "bond",
      label: "Our bond",
      detail: "Their heartbeats aligned.",
      memoryType: "relationship",
      memorySummary: "The bond became canon.",
      consequenceTags: ["bond"],
      companionReply: "I felt it too.",
    },
    {
      key: "signal",
      label: "The next signal",
      detail: "A bell answered.",
      memoryType: "discovery",
      memorySummary: "The signal became canon.",
      consequenceTags: ["mystery"],
      companionReply: "I will listen.",
    },
  ],
};

const baseProps = {
  sourceType: "story" as const,
  sourceId: "story-1",
  companionId: "companion-1",
  companionName: "Nova",
  prompt,
  stage: 1,
};

describe("LivingNarrativeChoiceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.choice = null;
    mocks.recordChoice.mockResolvedValue({});
    mocks.updateSideQuest.mockResolvedValue({});
    mocks.acceptSideQuest.mockResolvedValue({ id: "task-1" });
  });

  it("records a selected thread together with the optional private note", async () => {
    render(<LivingNarrativeChoiceCard {...baseProps} />);

    fireEvent.change(screen.getByLabelText(/Add a private note/i), {
      target: { value: "I want to pay closer attention." },
    });
    fireEvent.click(screen.getByRole("button", { name: /The lesson/i }));

    await waitFor(() => {
      expect(mocks.recordChoice).toHaveBeenCalledWith({
        option: prompt.options[0],
        responseNote: "I want to pay closer attention.",
      });
    });
  });

  it("lets a saved choice become an optional real-world side quest", async () => {
    mocks.choice = {
      id: "choice-1",
      user_id: "user-1",
      companion_id: "companion-1",
      epic_id: null,
      source_type: "story",
      source_id: "story-1",
      stage: 1,
      chapter_number: null,
      prompt_key: prompt.promptKey,
      prompt_text: prompt.question,
      option_key: "wisdom",
      option_label: "The lesson",
      response_note: null,
      consequence_tags: ["wisdom"],
      companion_reply: "Then we will practice it.",
      side_quest_title: "Practice one lesson",
      side_quest_status: "proposed",
      side_quest_task_id: null,
      created_at: "2026-08-09T12:00:00.000Z",
      updated_at: "2026-08-09T12:00:00.000Z",
    };

    render(<LivingNarrativeChoiceCard {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Add to Inbox/i }));

    await waitFor(() => {
      expect(mocks.acceptSideQuest).toHaveBeenCalledOnce();
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Side quest added to your Inbox");
    });
  });
});

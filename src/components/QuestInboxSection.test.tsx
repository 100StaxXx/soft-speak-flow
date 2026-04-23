import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestInboxSection, type InboxQuestItem } from "./QuestInboxSection";

vi.mock("@/utils/haptics", () => ({
  haptics: {
    light: vi.fn(),
  },
}));

vi.mock("@/components/journeys/JourneysCompanionLauncher", () => ({
  JourneysCompanionLauncher: ({
    onClick,
    text,
  }: {
    onClick?: () => void;
    text?: string;
  }) => (
    <button type="button" onClick={onClick}>
      {text ?? "Chat with companion"}
    </button>
  ),
}));

const buildQuest = (overrides: Partial<InboxQuestItem> = {}): InboxQuestItem => ({
  id: "quest-1",
  title: "Inbox quest",
  completed: false,
  taskDate: null,
  difficulty: "medium",
  scheduledTime: null,
  estimatedDuration: 30,
  recurrencePattern: null,
  recurrenceDays: [],
  recurrenceMonthDays: [],
  recurrenceCustomPeriod: null,
  reminderEnabled: false,
  reminderMinutesBefore: 15,
  category: null,
  notes: null,
  habitSourceId: null,
  imageUrl: null,
  attachments: [],
  location: null,
  ...overrides,
});

describe("QuestInboxSection", () => {
  it("renders canonical quest titles and forwards canonical edit payloads", () => {
    const onEditQuest = vi.fn();
    const quest = buildQuest({ title: "Canonical inbox quest" });

    render(
      <QuestInboxSection
        quests={[quest]}
        isLoading={false}
        isExpanded
        onExpandedChange={vi.fn()}
        onAddQuest={vi.fn()}
        onToggleQuest={vi.fn()}
        onEditQuest={onEditQuest}
        onDeleteQuest={vi.fn()}
      />,
    );

    expect(screen.getByText("Canonical inbox quest")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Edit quest"));

    expect(onEditQuest).toHaveBeenCalledWith(quest);
  });

  it("toggles and expands using canonical quest collections", () => {
    const onToggleQuest = vi.fn();

    render(
      <QuestInboxSection
        quests={[
          buildQuest({ id: "quest-1", title: "Quest one" }),
          buildQuest({ id: "quest-2", title: "Quest two" }),
          buildQuest({ id: "quest-3", title: "Quest three" }),
          buildQuest({ id: "quest-4", title: "Quest four" }),
          buildQuest({ id: "quest-5", title: "Quest five" }),
        ]}
        isLoading={false}
        isExpanded
        onExpandedChange={vi.fn()}
        onAddQuest={vi.fn()}
        onToggleQuest={onToggleQuest}
        onEditQuest={vi.fn()}
        onDeleteQuest={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Mark quest complete")[0]);
    expect(onToggleQuest).toHaveBeenCalledWith("quest-1", true);

    expect(screen.getByText("Show 1 more quest")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Show 1 more quest"));
    expect(screen.getByText("Quest five")).toBeInTheDocument();
  });
});

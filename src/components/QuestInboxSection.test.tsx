import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuestInboxSection } from "@/components/QuestInboxSection";

const openQuestLocationMock = vi.fn();

vi.mock("@/components/journeys/JourneysCompanionLauncher", () => ({
  JourneysCompanionLauncher: ({
    onClick,
    text,
  }: {
    onClick?: () => void;
    text?: string;
  }) => (
    <button type="button" onClick={onClick}>
      {text ?? "Companion"}
    </button>
  ),
}));

vi.mock("@/utils/questLocationLinks", async () => {
  const actual = await vi.importActual<typeof import("@/utils/questLocationLinks")>("@/utils/questLocationLinks");
  return {
    ...actual,
    openQuestLocation: (...args: Parameters<typeof actual.openQuestLocation>) => openQuestLocationMock(...args),
  };
});

describe("QuestInboxSection", () => {
  beforeEach(() => {
    openQuestLocationMock.mockClear();
  });

  it("opens inbox quest map actions without bubbling to parent controls", () => {
    const parentClick = vi.fn();
    const onToggleQuest = vi.fn();
    const onEditQuest = vi.fn();
    const onDeleteQuest = vi.fn();

    render(
      <div onClick={parentClick}>
        <QuestInboxSection
          tasks={[
            {
              id: "inbox-1",
              task_text: "Pick up city forms",
              completed: false,
              location: "City Hall",
            },
          ]}
          isLoading={false}
          isExpanded
          onExpandedChange={vi.fn()}
          onAddQuest={vi.fn()}
          onToggleQuest={onToggleQuest}
          onEditQuest={onEditQuest}
          onDeleteQuest={onDeleteQuest}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /open city hall in apple maps/i }));

    expect(openQuestLocationMock).toHaveBeenCalledWith("City Hall", "apple");
    expect(parentClick).not.toHaveBeenCalled();
    expect(onToggleQuest).not.toHaveBeenCalled();
    expect(onEditQuest).not.toHaveBeenCalled();
    expect(onDeleteQuest).not.toHaveBeenCalled();
  });
});

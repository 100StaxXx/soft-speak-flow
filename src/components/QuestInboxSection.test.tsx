import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuestInboxSection } from "@/components/QuestInboxSection";

const openQuestLocationMock = vi.fn();

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

  it("renders as a compact dropdown until the header is expanded", () => {
    const onExpandedChange = vi.fn();
    const quest = {
      id: "inbox-1",
      task_text: "Email Alex",
      completed: false,
    };

    const { rerender } = render(
      <QuestInboxSection
        tasks={[quest]}
        isLoading={false}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onToggleQuest={vi.fn()}
        onEditQuest={vi.fn()}
        onDeleteQuest={vi.fn()}
      />,
    );

    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Plan Inbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Quests without an assigned time yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Email Alex")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand inbox section/i }));

    expect(onExpandedChange).toHaveBeenCalledWith(true);

    rerender(
      <QuestInboxSection
        tasks={[quest]}
        isLoading={false}
        isExpanded
        onExpandedChange={onExpandedChange}
        onToggleQuest={vi.fn()}
        onEditQuest={vi.fn()}
        onDeleteQuest={vi.fn()}
      />,
    );

    expect(screen.getByText("Email Alex")).toBeInTheDocument();
    expect(screen.getByText("No time assigned yet")).toBeInTheDocument();
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

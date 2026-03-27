import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddQuestSheet, type AddQuestData } from "./AddQuestSheet";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import type { PersonalQuestTemplate } from "@/features/quests/types";

const mocks = vi.hoisted(() => ({
  integrationVisible: false,
  defaultProvider: null as "apple" | "google" | "outlook" | null,
  connections: [] as Array<{ provider: "apple" | "google" | "outlook" }>,
  personalTemplates: [] as PersonalQuestTemplate[],
  refreshPersonalTemplates: vi.fn(),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    integrationVisible: mocks.integrationVisible,
    defaultProvider: mocks.defaultProvider,
    connections: mocks.connections,
  }),
}));

const buildAttachments = (count: number): QuestAttachmentInput[] =>
  Array.from({ length: count }, (_, idx) => ({
    fileUrl: `https://example.com/file-${idx + 1}.png`,
    filePath: `user/file-${idx + 1}.png`,
    fileName: `file-${idx + 1}.png`,
    mimeType: "image/png",
    fileSizeBytes: 1024,
    isImage: true,
    sortOrder: idx,
  }));

const buildPersonalTemplate = (overrides: Partial<PersonalQuestTemplate> = {}): PersonalQuestTemplate => ({
  id: "personal-deep-work",
  title: "Deep work block",
  frequency: 3,
  lastUsedAt: "2026-01-14T08:30:00.000Z",
  difficulty: "medium",
  estimatedDuration: 90,
  notes: "Protect focus and silence notifications.",
  subtasks: ["Choose one priority", "Silence notifications"],
  ...overrides,
});

vi.mock("@/components/QuestAttachmentPicker", () => ({
  QuestAttachmentPicker: ({ onAttachmentsChange }: { onAttachmentsChange: (attachments: QuestAttachmentInput[]) => void }) => (
    <div>
      <button type="button" onClick={() => onAttachmentsChange(buildAttachments(10))}>
        Attach 10
      </button>
      <button type="button" onClick={() => onAttachmentsChange(buildAttachments(11))}>
        Attach 11
      </button>
    </div>
  ),
}));

vi.mock("@/features/quests/hooks/usePersonalQuestTemplates", () => ({
  usePersonalQuestTemplates: () => ({
    templates: mocks.personalTemplates,
    isLoading: false,
    error: null,
    refresh: mocks.refreshPersonalTemplates,
  }),
}));

describe("AddQuestSheet", () => {
  const selectedDate = new Date(2026, 0, 15);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.integrationVisible = false;
    mocks.defaultProvider = null;
    mocks.connections = [];
    mocks.personalTemplates = [];
  });

  it("renders simplified add quest controls without step instructions", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByPlaceholderText("Quest Title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse common quests" })).toBeInTheDocument();
    expect(screen.queryByText("New Quest")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 1 · Name your quest")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 2 · Pick a time")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 3 · Add quest")).not.toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Time" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Quest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Inbox instead" })).toBeInTheDocument();
    expect(screen.queryByText("Link to Contact")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("renders Advanced Settings below Photo / Files", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const advancedTrigger = screen.getByRole("button", { name: /Advanced Settings/i });
    const photoFilesLabel = screen.getByText("Photo / Files");
    const relation = advancedTrigger.compareDocumentPosition(photoFilesLabel);
    expect(relation & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("renders duration below time controls and above subtasks", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const timeButton = screen.getByRole("button", { name: "Time" });
    const durationButton = screen.getByRole("button", { name: "30 min" });
    const addSubtaskButton = screen.getByRole("button", { name: "Add Subtask" });

    expect(timeButton.compareDocumentPosition(durationButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(durationButton.compareDocumentPosition(addSubtaskButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("only shows Early Reminder after a time is selected", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Advanced Settings/i }));
    expect(screen.queryByText("Early Reminder")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    expect(screen.getByText("Early Reminder")).toBeInTheDocument();
  });

  it("does not auto-focus the title on open and still allows manual focus", () => {
    vi.useFakeTimers();
    try {
      render(
        <AddQuestSheet
          open
          onOpenChange={vi.fn()}
          selectedDate={selectedDate}
          onAdd={vi.fn().mockResolvedValue(undefined)}
        />
      );

      const titleInput = screen.getByPlaceholderText("Quest Title");
      expect(titleInput).not.toHaveFocus();

      act(() => {
        vi.runOnlyPendingTimers();
      });
      expect(titleInput).not.toHaveFocus();

      fireEvent.click(titleInput);
      titleInput.focus();
      expect(titleInput).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows campaign creation CTA with inline max cap hint", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
        onCreateCampaign={vi.fn()}
      />
    );

    expect(screen.getByText("Or create a Campaign")).toBeInTheDocument();
    expect(screen.getByText("Max 2 active")).toBeInTheDocument();
  });

  it("keeps Add Quest disabled until title and time are both set", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const createButton = screen.getByRole("button", { name: "Add Quest" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Plan sprint tasks" },
    });
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    expect(createButton).toBeEnabled();
  });

  it("auto-fills time on first time-chip tap", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Tutorial quest" },
    });

    const createButton = screen.getByRole("button", { name: "Add Quest" });
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Time" }));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));
    });
    expect(createButton).toBeEnabled();
    dispatchSpy.mockRestore();
  });

  it("supports prefilledTime and enables create once title is entered", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const createButton = screen.getByRole("button", { name: "Add Quest" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Morning planning" },
    });

    expect(createButton).toBeEnabled();
  });

  it("does not render quest suggestion chips", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByRole("button", { name: "10-minute inbox cleanup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review roadmap for 30 minutes" })).not.toBeInTheDocument();
  });

  it("hides repeat quest quick picks when the user has no repeated templates", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText("Your repeat quests")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See all" })).not.toBeInTheDocument();
  });

  it("renders repeat quest quick picks when personal templates exist", () => {
    mocks.personalTemplates = [
      buildPersonalTemplate(),
      buildPersonalTemplate({ id: "personal-emails", title: "Respond to emails", frequency: 2 }),
    ];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Your repeat quests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deep work block/i })).toBeInTheDocument();
  });

  it("prefills the draft when a repeat quest quick pick is selected", () => {
    mocks.personalTemplates = [buildPersonalTemplate()];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deep work block/i }));

    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Deep work block");
    expect(screen.getByDisplayValue("Protect focus and silence notifications.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Choose one priority")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Silence notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1.5h" })).toBeInTheDocument();
  });

  it("opens the template browser on the Yours tab from See all", () => {
    mocks.personalTemplates = [buildPersonalTemplate()];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "See all" }));

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search your repeat quests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deep work block/i })).toBeInTheDocument();
  });

  it("opens the template browser on the Common tab from Browse common quests", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));

    expect(screen.getByPlaceholderText("Search common quests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Respond to emails/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work" })).toBeInTheDocument();
  });

  it("switches between common and personal template tabs", async () => {
    mocks.personalTemplates = [buildPersonalTemplate()];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    expect(screen.getByRole("button", { name: /Respond to emails/i })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Yours" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search your repeat quests")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Deep work block/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Respond to emails/i })).not.toBeInTheDocument();
  });

  it("filters common quests by category", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: "Health" }));

    expect(screen.getByRole("button", { name: /Go to the gym/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Respond to emails/i })).not.toBeInTheDocument();
  });

  it("filters personal quests by search query", () => {
    mocks.personalTemplates = [
      buildPersonalTemplate(),
      buildPersonalTemplate({ id: "personal-weekly-review", title: "Weekly review", frequency: 2 }),
    ];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "See all" }));
    fireEvent.change(screen.getByPlaceholderText("Search your repeat quests"), {
      target: { value: "weekly" },
    });

    expect(screen.getByRole("button", { name: /Weekly review/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Deep work block/i })).not.toBeInTheDocument();
  });

  it("returns to the editor and does not auto-submit after selecting a common quest", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: /Respond to emails/i }));

    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Respond to emails");
    expect(screen.getByRole("button", { name: "Browse common quests" })).toBeInTheDocument();

    await waitFor(() => {
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  it("preserves the existing date and time when prefilling from a template", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: /Go to the gym/i }));

    expect(screen.getByRole("button", { name: "Jan 15" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:00 AM" })).toBeInTheDocument();
  });

  it("resets the template browser state after close and reopen", () => {
    mocks.personalTemplates = [buildPersonalTemplate()];
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "See all" }));
    fireEvent.change(screen.getByPlaceholderText("Search your repeat quests"), {
      target: { value: "deep" },
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Common" }));

    rerender(
      <AddQuestSheet
        open={false}
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );
    rerender(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    expect(screen.getByPlaceholderText("Quest Title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See all" }));
    expect(screen.getByPlaceholderText("Search your repeat quests")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Deep work block/i })).toBeInTheDocument();
  });

  it("keeps custom duration input open while typing preset-matching values", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    const durationInput = screen.getByPlaceholderText("Minutes");
    fireEvent.change(durationInput, { target: { value: "1" } });

    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Minutes")).toHaveValue(1);
  });

  it("closes custom duration input when a preset chip is selected", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByPlaceholderText("Minutes"), { target: { value: "17" } });
    fireEvent.click(screen.getByRole("button", { name: "1m" }));

    expect(screen.queryByPlaceholderText("Minutes")).not.toBeInTheDocument();
  });

  it("resets custom duration mode after close and reopen", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();

    rerender(
      <AddQuestSheet
        open={false}
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );
    rerender(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(screen.queryByPlaceholderText("Minutes")).not.toBeInTheDocument();
  });

  it("closes the date picker after selecting a new date", async () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const dateTrigger = screen.getByRole("button", { name: "Jan 15" });
    fireEvent.click(dateTrigger);

    const calendarGrid = screen.getByRole("grid");
    const nextDayButton = within(calendarGrid)
      .getAllByRole("gridcell")
      .find((button) => button.textContent === "16");

    expect(nextDayButton).toBeTruthy();
    fireEvent.click(nextDayButton!);

    await waitFor(() => {
      expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    });

    expect(dateTrigger).toHaveAttribute("data-state", "closed");
    expect(dateTrigger).not.toHaveTextContent("Jan 15");
  });

  it("shows full-day half-hour quick-pick times in the time picker", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Time" }));

    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("12:30 AM")).toBeInTheDocument();
    expect(screen.getByText("11:30 PM")).toBeInTheDocument();
  });

  it("keeps time picker scrolling local and does not call scrollIntoView", () => {
    vi.useFakeTimers();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });

    try {
      render(
        <AddQuestSheet
          open
          onOpenChange={vi.fn()}
          selectedDate={selectedDate}
          onAdd={vi.fn().mockResolvedValue(undefined)}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Time" }));
      fireEvent.change(screen.getByLabelText("Custom quest time"), {
        target: { value: "11:17" },
      });

      act(() => {
        vi.runOnlyPendingTimers();
      });

      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          writable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView;
      }
      vi.useRealTimers();
    }
  });

  it("snaps custom manual time values to the nearest half-hour on submit", async () => {
    const onAdd = vi.fn<Parameters<(data: AddQuestData) => Promise<void>>, ReturnType<(data: AddQuestData) => Promise<void>>>()
      .mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Custom time quest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    const customTimeInput = screen.getByLabelText("Custom quest time");
    expect(customTimeInput).toHaveClass("text-base");
    fireEvent.change(customTimeInput, {
      target: { value: "11:17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(onAdd.mock.calls[0]?.[0]).toMatchObject({
      scheduledTime: "11:30",
    });
  });

  it("sends inbox payload with null date/time when adding to inbox", async () => {
    const onAdd = vi.fn<Parameters<(data: AddQuestData) => Promise<void>>, ReturnType<(data: AddQuestData) => Promise<void>>>()
      .mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Triage inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Inbox instead" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    const payload = onAdd.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      text: "Triage inbox",
      taskDate: null,
      scheduledTime: null,
      sendToInbox: true,
      sendToCalendar: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables recurrence controls until a time is selected", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "None" })).toBeDisabled();
    expect(screen.getByText("Set a time to enable recurrence.")).toBeInTheDocument();
  });

  it("blocks add-to-inbox when recurrence is enabled", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Recurring inbox attempt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));

    const inboxButton = screen.getByRole("button", { name: "Add to Inbox instead" });
    expect(inboxButton).toBeDisabled();
    expect(screen.getByText("Recurring quests must stay scheduled with a time.")).toBeInTheDocument();

    fireEvent.click(inboxButton);

    await waitFor(() => {
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  it("submits scheduled quest payload when Add Quest is tapped", async () => {
    const onAdd = vi.fn<Parameters<(data: AddQuestData) => Promise<void>>, ReturnType<(data: AddQuestData) => Promise<void>>>()
      .mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Review roadmap" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    const payload = onAdd.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      text: "Review roadmap",
      taskDate: "2026-01-15",
      scheduledTime: "09:00",
      sendToInbox: false,
      contactId: null,
      autoLogInteraction: true,
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides send-to-calendar option when default provider is stale and no providers are connected", () => {
    mocks.integrationVisible = true;
    mocks.defaultProvider = "google";
    mocks.connections = [];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText(/Send to .* Calendar after create/i)).not.toBeInTheDocument();
  });

  it("hides send-to-calendar option while feature is disabled", () => {
    mocks.integrationVisible = true;
    mocks.defaultProvider = "outlook";
    mocks.connections = [{ provider: "google" }];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText("Send to Google Calendar after create")).not.toBeInTheDocument();
  });

  it("blocks close requests when preventClose is enabled", () => {
    const onOpenChange = vi.fn();
    const onPreventedCloseAttempt = vi.fn();

    render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
        preventClose
        onPreventedCloseAttempt={onPreventedCloseAttempt}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onPreventedCloseAttempt).toHaveBeenCalledTimes(1);
  });

  it("emits tutorial events for open, title entry, time selection, and create attempt", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={onAdd}
      />
    );

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-sheet-opened" }));

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Evented quest" },
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-title-entered" }));

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-create-attempted" }));
    dispatchSpy.mockRestore();
  });

  it("submits attachment payload with primary image when files are added", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Quest with files" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Attach 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    const payload = onAdd.mock.calls[0][0];
    expect(payload.attachments).toHaveLength(10);
    expect(payload.imageUrl).toBe("https://example.com/file-1.png");
  });

  it("submits weekdays recurrence with Monday-Friday day indexes", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Weekday quest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekdays" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrencePattern: "weekdays",
        recurrenceDays: [0, 1, 2, 3, 4],
      }),
    );
  });

  it("submits biweekly recurrence with one default selected day", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Biweekly quest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Every 2 Weeks" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrencePattern: "biweekly",
        recurrenceDays: [3], // 2026-01-15 is Thursday (Mon=0)
      }),
    );
  });
});

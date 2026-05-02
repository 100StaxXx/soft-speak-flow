import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddQuestSheet, type AddQuestData } from "./AddQuestSheet";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import type { PersonalQuestTemplate, QuestComposerPrefillDraft } from "@/features/quests/types";
import { DIFFICULTY_COLORS } from "@/components/quest-shared";
import { getQuestDraftStorageKey } from "@/utils/accountLocalState";

const mocks = vi.hoisted(() => ({
  integrationVisible: false,
  defaultProvider: null as "apple" | "google" | "outlook" | null,
  connections: [] as Array<{ provider: "apple" | "google" | "outlook" }>,
  personalTemplates: [] as PersonalQuestTemplate[],
  refreshPersonalTemplates: vi.fn(),
  saveTemplateMock: vi.fn(),
  toastMock: vi.fn(),
  storage: new Map<string, string>(),
  safeLocalStorage: {
    getItem: (key: string) => mocks.storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mocks.storage.set(key, value);
      return true;
    },
    removeItem: (key: string) => {
      mocks.storage.delete(key);
      return true;
    },
    clear: () => {
      mocks.storage.clear();
      return true;
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: mocks.safeLocalStorage,
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
  templateOrigin: "personal_derived",
  sourceCommonTemplateId: null,
  ...overrides,
});

const buildVoicePrefill = (overrides: Partial<QuestComposerPrefillDraft> = {}): QuestComposerPrefillDraft => ({
  text: "Voice planned quest",
  taskDate: "2026-01-16",
  scheduledTime: "15:00",
  estimatedDuration: 60,
  reminderEnabled: true,
  reminderMinutesBefore: 30,
  reminderOffsetsMinutes: [30],
  moreInformation: "Bring roadmap",
  location: "Library",
  subtasks: ["Draft outline", "Send recap"],
  creationSource: "voice",
  ...overrides,
});

const getRecurrenceSection = (): HTMLElement => {
  const recurrenceLabel = screen.getByText("Recurrence");
  const section = recurrenceLabel.parentElement?.parentElement;
  if (!section) {
    throw new Error("Recurrence section not found");
  }
  return section as HTMLElement;
};

const expectElementToIncludeClasses = (element: HTMLElement, classes: string) => {
  for (const token of classes.split(" ").filter(Boolean)) {
    expect(element.className).toContain(token);
  }
};

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
    isSavingTemplate: false,
    error: null,
    refresh: mocks.refreshPersonalTemplates,
    saveTemplate: mocks.saveTemplateMock,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
}));

describe("AddQuestSheet", () => {
  const selectedDate = new Date(2026, 0, 15);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.safeLocalStorage.clear();
    mocks.integrationVisible = false;
    mocks.defaultProvider = null;
    mocks.connections = [];
    mocks.personalTemplates = [];
    mocks.saveTemplateMock.mockResolvedValue(buildPersonalTemplate({
      id: "explicit-template-1",
      title: "Deep work sprint",
      difficulty: "hard",
      estimatedDuration: 75,
      notes: "Save the personalized version",
      subtasks: ["Choose one priority", "Block distractions"],
      templateOrigin: "personal_explicit",
      sourceCommonTemplateId: "work-deep-work-block",
    }));
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
    expect(screen.queryByText(/Name your quest.*Select a time/i)).not.toBeInTheDocument();
    expectElementToIncludeClasses(
      screen.getByTestId("add-quest-mobile-sheet"),
      "border-[#4d2811] text-[#4f240c]",
    );
    expect(screen.getByTestId("add-quest-editor-header").firstElementChild).toContainElement(
      screen.getByPlaceholderText("Quest Title"),
    );
    expect(screen.queryByText("Link to Contact")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("renders the desktop panel presentation when requested", () => {
    render(
      <AddQuestSheet
        open
        presentation="desktop-panel"
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByTestId("add-quest-desktop-panel")).toBeInTheDocument();
    expectElementToIncludeClasses(
      screen.getByTestId("add-quest-desktop-panel"),
      "border-[#4d2811] text-[#4f240c]",
    );
    expect(screen.queryByTestId("add-quest-mobile-sheet")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Quest Title")).toBeInTheDocument();
    expect(screen.getByText(/Name your quest.*Select a time.*Thu, Jan 15/i)).toBeInTheDocument();
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

  it.each([undefined, "desktop-panel"] as const)(
    "shows Early Reminder above Add Subtask and Advanced Settings after a time is selected for %s presentation",
    (presentation) => {
      render(
        <AddQuestSheet
          open
          presentation={presentation}
          onOpenChange={vi.fn()}
          selectedDate={selectedDate}
          onAdd={vi.fn().mockResolvedValue(undefined)}
        />
      );

      expect(screen.queryByText("Early Reminder")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Time" }));

      const reminderLabel = screen.getByText("Early Reminder");
      const addSubtaskButton = screen.getByRole("button", { name: "Add Subtask" });
      const advancedTrigger = screen.getByRole("button", { name: /Advanced Settings/i });

      expect(reminderLabel.compareDocumentPosition(addSubtaskButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(reminderLabel.compareDocumentPosition(advancedTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      fireEvent.click(advancedTrigger);

      expect(screen.getAllByText("Early Reminder")).toHaveLength(1);
    },
  );

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

  it("keeps footer extras out of the default mobile sheet", () => {
    mocks.integrationVisible = true;
    mocks.defaultProvider = "google";
    mocks.connections = [{ provider: "google" }];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
        onCreateCampaign={vi.fn()}
      />
    );

    expect(screen.queryByText(/Name your quest.*Select a time/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Or create a Campaign")).not.toBeInTheDocument();
    expect(screen.queryByText("Max 2 active")).not.toBeInTheDocument();
    expect(screen.queryByText(/Send to .* Calendar after create/i)).not.toBeInTheDocument();
  });

  it("shows campaign creation CTA with inline max cap hint in the desktop footer", () => {
    render(
      <AddQuestSheet
        open
        presentation="desktop-panel"
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

  it("uses the companion primary CTA style when easy is selected", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Take a quick walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    fireEvent.click(screen.getByRole("button", { name: "Easy" }));

    const createButton = screen.getByRole("button", { name: "Add Quest" });
    expect(createButton).toBeEnabled();
    expectElementToIncludeClasses(createButton, DIFFICULTY_COLORS.easy.primaryButton);
  });

  it("uses the companion primary CTA style when medium is selected", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Plan the weekly sprint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    fireEvent.click(screen.getByRole("button", { name: "Medium" }));

    const createButton = screen.getByRole("button", { name: "Add Quest" });
    expect(createButton).toBeEnabled();
    expectElementToIncludeClasses(createButton, DIFFICULTY_COLORS.medium.primaryButton);
  });

  it("auto-fills time on first time-chip tap without emitting tutorial completion", () => {
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

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));
    expect(createButton).toBeEnabled();
    dispatchSpy.mockRestore();
  });

  it("emits tutorial events only after the user commits title and time", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const titleInput = screen.getByPlaceholderText("Quest Title");
    fireEvent.change(titleInput, {
      target: { value: "Committed quest" },
    });

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-title-entered" }));

    fireEvent.blur(titleInput);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-title-entered" }));

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));

    fireEvent.blur(screen.getByLabelText("Custom quest time"));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));

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

  it("hides personal template quick picks when the user has no templates", () => {
    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText("Your templates")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See all" })).not.toBeInTheDocument();
  });

  it("renders personal template quick picks when templates exist", () => {
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

    expect(screen.getByText("Your templates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deep work block/i })).toBeInTheDocument();
  });

  it("prefills the draft when a personal template quick pick is selected", () => {
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
    expect(screen.getByPlaceholderText("Search your templates")).toBeInTheDocument();
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
      expect(screen.getByPlaceholderText("Search your templates")).toBeInTheDocument();
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
    fireEvent.change(screen.getByPlaceholderText("Search your templates"), {
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

  it("submits without prompting when a selected template is unchanged", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: /Respond to emails/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Save these changes to My Templates?")).not.toBeInTheDocument();
    expect(mocks.saveTemplateMock).not.toHaveBeenCalled();
  });

  it("shows the save-template prompt when a common template is customized", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: /Respond to emails/i }));
    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Respond to priority emails" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(await screen.findByText("Save these changes to My Templates?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to My Templates" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Just this time" })).toBeInTheDocument();
  });

  it("shows the update-template prompt when an explicit personal template is customized", async () => {
    mocks.personalTemplates = [buildPersonalTemplate({
      id: "explicit-template-1",
      templateOrigin: "personal_explicit",
      sourceCommonTemplateId: "work-deep-work-block",
    })];

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Deep work block/i }));
    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Deep work sprint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(await screen.findByText("Update your template?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Template" })).toBeInTheDocument();
  });

  it("continues with a one-off quest when Just this time is selected", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: /Respond to emails/i }));
    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Respond to priority emails" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));
    fireEvent.click(await screen.findByRole("button", { name: "Just this time" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(mocks.saveTemplateMock).not.toHaveBeenCalled();
  });

  it("saves the customized template before creating the quest", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    let resolveRefresh: (() => void) | null = null;
    mocks.refreshPersonalTemplates.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: /Respond to emails/i }));
    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Respond to priority emails" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save to My Templates" }));

    await waitFor(() => {
      expect(mocks.saveTemplateMock).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(mocks.saveTemplateMock.mock.invocationCallOrder[0]).toBeLessThan(onAdd.mock.invocationCallOrder[0] ?? Infinity);
    expect(mocks.refreshPersonalTemplates).toHaveBeenCalledTimes(1);
    expect(mocks.refreshPersonalTemplates.mock.invocationCallOrder[0]).toBeLessThan(onAdd.mock.invocationCallOrder[0] ?? Infinity);
    expect(mocks.saveTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceCommonTemplateId: "work-respond-to-emails",
      title: "Respond to priority emails",
    }));

    resolveRefresh?.();
  });

  it("does not prompt when only schedule fields change after selecting a template", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefilledTime="09:00"
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse common quests" }));
    fireEvent.click(screen.getByRole("button", { name: /Respond to emails/i }));
    fireEvent.click(screen.getByRole("button", { name: "9:00 AM" }));
    fireEvent.click(screen.getByRole("button", { name: "9:30 AM" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Save these changes to My Templates?")).not.toBeInTheDocument();
  });

  it("applies the same template prompt flow when adding a customized template quest to inbox", async () => {
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
    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Respond to priority emails" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Inbox instead" }));
    fireEvent.click(await screen.findByRole("button", { name: "Just this time" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(onAdd.mock.calls[0]?.[0]).toMatchObject({
      sendToInbox: true,
      taskDate: null,
      scheduledTime: null,
    });
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
    fireEvent.change(screen.getByPlaceholderText("Search your templates"), {
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
    expect(screen.getByPlaceholderText("Search your templates")).toHaveValue("");
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
    fireEvent.click(screen.getByRole("button", { name: "15m" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
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

  it("preserves custom manual time values on submit", async () => {
    const onAdd = vi.fn<(data: AddQuestData) => Promise<void>>()
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
      scheduledTime: "11:17",
    });
  });

  it("sends inbox payload with null date/time when adding to inbox", async () => {
    const onAdd = vi.fn<(data: AddQuestData) => Promise<void>>()
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
      creationSource: "inbox",
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

    expect(within(getRecurrenceSection()).getByRole("button", { name: "None" })).toBeDisabled();
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
    fireEvent.click(within(getRecurrenceSection()).getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));

    const inboxButton = screen.getByRole("button", { name: "Add to Inbox instead" });
    expect(inboxButton).toBeDisabled();
    expect(screen.queryByText("Recurring quests must stay scheduled with a time.")).not.toBeInTheDocument();

    fireEvent.click(inboxButton);

    await waitFor(() => {
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  it("submits scheduled quest payload when Add Quest is tapped", async () => {
    const onAdd = vi.fn<(data: AddQuestData) => Promise<void>>()
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
      creationSource: "manual",
      contactId: null,
      autoLogInteraction: true,
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies voice prefills once per key, preserves edits, and resets after close", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const initialPrefill = buildVoicePrefill();
    const { rerender } = render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
        prefillDraft={initialPrefill}
        prefillKey="voice-1"
      />,
    );

    const titleInput = screen.getByPlaceholderText("Quest Title");
    expect(titleInput).toHaveValue("Voice planned quest");
    expect(screen.getByRole("button", { name: "Jan 16" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3:00 PM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1h" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bring roadmap")).toBeInTheDocument();
    expect(screen.getByText("30 minutes before")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Advanced Settings/i }));

    fireEvent.change(titleInput, {
      target: { value: "Edited voice quest" },
    });

    rerender(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
        prefillDraft={buildVoicePrefill({ text: "Overwritten while open", scheduledTime: "16:00" })}
        prefillKey="voice-1"
      />,
    );

    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Edited voice quest");
    expect(screen.getByRole("button", { name: "3:00 PM" })).toBeInTheDocument();

    rerender(
      <AddQuestSheet
        open={false}
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
        prefillDraft={buildVoicePrefill({ text: "Reopened voice quest" })}
        prefillKey="voice-1"
      />,
    );

    rerender(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
        prefillDraft={buildVoicePrefill({ text: "Reopened voice quest" })}
        prefillKey="voice-1"
      />,
    );

    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Reopened voice quest");

    rerender(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={onAdd}
        prefillDraft={buildVoicePrefill({ text: "Fresh voice quest", scheduledTime: "16:30" })}
        prefillKey="voice-2"
      />,
    );

    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Fresh voice quest");
    expect(screen.getByRole("button", { name: "4:30 PM" })).toBeInTheDocument();
  });

  it("submits a voice-prefilled quest with the voice creation source preserved", async () => {
    const onAdd = vi.fn<(data: AddQuestData) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={onAdd}
        prefillDraft={buildVoicePrefill()}
        prefillKey="voice-submit"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(onAdd.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      text: "Voice planned quest",
      taskDate: "2026-01-16",
      scheduledTime: "15:00",
      creationSource: "voice",
      reminderEnabled: true,
      reminderMinutesBefore: 30,
      reminderOffsetsMinutes: [30],
      moreInformation: "Bring roadmap",
      subtasks: ["Draft outline", "Send recap"],
    }));
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

    const titleInput = screen.getByPlaceholderText("Quest Title");
    fireEvent.change(titleInput, {
      target: { value: "Evented quest" },
    });
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-title-entered" }));

    fireEvent.keyDown(titleInput, { key: "Enter" });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-title-entered" }));

    fireEvent.click(screen.getByRole("button", { name: "Time" }));
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "add-quest-time-selected" }));
    expect(document.querySelector('[data-tour="add-quest-time-panel"]')).not.toBeNull();

    const explicitTimeButton = document.querySelector('[data-tour="add-quest-time-slot"]');
    expect(explicitTimeButton).not.toBeNull();
    fireEvent.click(explicitTimeButton as Element);
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
    fireEvent.click(within(getRecurrenceSection()).getByRole("button", { name: "None" }));
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
    fireEvent.click(within(getRecurrenceSection()).getByRole("button", { name: "None" }));
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

  it("persists a quest draft across close and lets the user restore it", async () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <AddQuestSheet
        open
        onOpenChange={onOpenChange}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Quest Title"), {
      target: { value: "Persistent quest" },
    });

    await waitFor(() => {
      expect(mocks.safeLocalStorage.getItem(getQuestDraftStorageKey("user-1"))).toContain("Persistent quest");
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.safeLocalStorage.getItem(getQuestDraftStorageKey("user-1"))).toContain("Persistent quest");

    unmount();

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText("Restore saved quest draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));

    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Persistent quest");
  });

  it("auto-restores a saved quest draft when opened from creation popup recovery", async () => {
    mocks.safeLocalStorage.setItem(
      getQuestDraftStorageKey("user-1"),
      JSON.stringify({
        text: "Recovered quest",
        taskDate: "2026-01-15",
        difficulty: "hard",
        scheduledTime: "10:00",
        estimatedDuration: 45,
        recurrencePattern: null,
        recurrenceDays: [],
        recurrenceMonthDays: [],
        recurrenceCustomPeriod: null,
        reminderEnabled: false,
        reminderMinutesBefore: 15,
        moreInformation: "Still here after relaunch",
        location: null,
        sendToCalendar: false,
        subtasks: ["First step"],
        attachments: [],
        creationSource: "manual",
        selectedTemplate: null,
        updatedAt: "2026-01-15T10:00:00.000Z",
      }),
    );

    render(
      <AddQuestSheet
        open
        autoRestoreDraftOnOpen
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Recovered quest");
    });
    expect(screen.queryByText("Restore saved quest draft?")).not.toBeInTheDocument();
  });

  it("discards a saved quest draft when requested", async () => {
    mocks.safeLocalStorage.setItem(
      getQuestDraftStorageKey("user-1"),
      JSON.stringify({
        text: "Throwaway quest",
        taskDate: "2026-01-15",
        difficulty: "medium",
        scheduledTime: null,
        estimatedDuration: 30,
        recurrencePattern: null,
        recurrenceDays: [],
        recurrenceMonthDays: [],
        recurrenceCustomPeriod: null,
        reminderEnabled: false,
        reminderMinutesBefore: 15,
        moreInformation: null,
        location: null,
        sendToCalendar: false,
        subtasks: [],
        attachments: [],
        creationSource: "manual",
        selectedTemplate: null,
        updatedAt: "2026-01-15T10:00:00.000Z",
      }),
    );

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText("Restore saved quest draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));

    await waitFor(() => {
      expect(mocks.safeLocalStorage.getItem(getQuestDraftStorageKey("user-1"))).toBeNull();
    });
    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("");
  });

  it("clears the saved quest draft after a successful submission", async () => {
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
      target: { value: "Submit clears draft" },
    });

    await waitFor(() => {
      expect(mocks.safeLocalStorage.getItem(getQuestDraftStorageKey("user-1"))).toContain("Submit clears draft");
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    expect(mocks.safeLocalStorage.getItem(getQuestDraftStorageKey("user-1"))).toBeNull();
  });

  it("prefers an explicit prefill over an older saved draft", () => {
    mocks.safeLocalStorage.setItem(
      getQuestDraftStorageKey("user-1"),
      JSON.stringify({
        text: "Saved local draft",
        taskDate: "2026-01-15",
        difficulty: "medium",
        scheduledTime: "08:00",
        estimatedDuration: 30,
        recurrencePattern: null,
        recurrenceDays: [],
        recurrenceMonthDays: [],
        recurrenceCustomPeriod: null,
        reminderEnabled: false,
        reminderMinutesBefore: 15,
        moreInformation: null,
        location: null,
        sendToCalendar: false,
        subtasks: [],
        attachments: [],
        creationSource: "manual",
        selectedTemplate: null,
        updatedAt: "2026-01-15T10:00:00.000Z",
      }),
    );

    render(
      <AddQuestSheet
        open
        onOpenChange={vi.fn()}
        selectedDate={selectedDate}
        prefillDraft={buildVoicePrefill({ text: "Voice wins" })}
        prefillKey="voice-prefill-1"
        onAdd={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByText("Restore saved quest draft?")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Quest Title")).toHaveValue("Voice wins");
  });
});

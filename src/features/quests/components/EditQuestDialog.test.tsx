import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditQuestDialog } from "./EditQuestDialog";
import { DIFFICULTY_COLORS } from "@/components/quest-shared";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";

const mocks = vi.hoisted(() => ({
  addSubtask: vi.fn(),
  toggleSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  companionFavoriteColor: "#52b7ff",
}));

const expectElementToIncludeClasses = (element: HTMLElement, classes: string) => {
  for (const token of classes.split(" ").filter(Boolean)) {
    expect(element.className).toContain(token);
  }
};

vi.mock("@/hooks/useQuestImagePicker", () => ({
  useQuestImagePicker: () => ({
    deleteImage: vi.fn().mockResolvedValue(undefined),
    pickAttachments: vi.fn().mockResolvedValue([]),
    deleteAttachment: vi.fn().mockResolvedValue(true),
    isUploading: false,
  }),
}));

vi.mock("@/features/tasks/hooks/useSubtasks", () => ({
  useSubtasks: () => ({
    subtasks: [],
    addSubtask: mocks.addSubtask,
    toggleSubtask: mocks.toggleSubtask,
    deleteSubtask: mocks.deleteSubtask,
    isAdding: false,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: { favorite_color: mocks.companionFavoriteColor },
  }),
}));

vi.mock("@/components/QuestAttachmentPicker", () => ({
  QuestAttachmentPicker: ({ onAttachmentsChange }: { onAttachmentsChange: (attachments: Array<{
    fileUrl: string;
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    isImage: boolean;
    sortOrder?: number;
  }>) => void }) => (
    <button
      type="button"
      onClick={() =>
        onAttachmentsChange([{
          fileUrl: "https://example.com/a.png",
          filePath: "user/a.png",
          fileName: "a.png",
          mimeType: "image/png",
          fileSizeBytes: 1000,
          isImage: true,
          sortOrder: 0,
        }])
      }
    >
      Add Attachments
    </button>
  ),
}));

describe("EditQuestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.companionFavoriteColor = "#52b7ff";
  });

  const legacyTask = {
    id: "task-1",
    task_text: "Legacy quest",
    task_date: "2026-02-13T08:00:00.000Z",
    difficulty: "challenging",
    scheduled_time: "09:30:00",
    estimated_duration: 30,
    recurrence_pattern: null,
    recurrence_days: [],
    reminder_enabled: false,
    reminder_minutes_before: 15,
    category: null,
    notes: null,
    image_url: null,
    location: null,
  };

  const legacyWeeklyMultiDayTask = {
    ...legacyTask,
    id: "task-2",
    recurrence_pattern: "weekly",
    recurrence_days: [0, 2, 4],
  };

  const legacyRecurringWithoutTimeTask = {
    ...legacyTask,
    id: "task-3",
    recurrence_pattern: "daily",
    scheduled_time: null,
  };

  it("reopens safely with legacy time values", () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        isSaving={false}
      />,
    );

    expect(screen.getByDisplayValue("Legacy quest")).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText("Close")[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        isSaving={false}
      />,
    );

    expect(screen.getByDisplayValue("Legacy quest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  });

  it("applies supplied companion frosted variables to the edit quest sheet", () => {
    const companionFrostedThemeStyle = getCompanionFrostedThemeStyle("#9b6bff");

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
    );

    const sheet = screen.getByTestId("edit-quest-mobile-sheet");
    expect(sheet.style.getPropertyValue("--companion-frosted-primary")).toBe(
      companionFrostedThemeStyle["--companion-frosted-primary"],
    );
    expect(sheet.style.getPropertyValue("--companion-frosted-primary-rgb")).toBe(
      companionFrostedThemeStyle["--companion-frosted-primary-rgb"],
    );
  });

  it("falls back to the stored companion color when no theme style is supplied", () => {
    mocks.companionFavoriteColor = "#58d68d";
    const companionFrostedThemeStyle = getCompanionFrostedThemeStyle(mocks.companionFavoriteColor);

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
    );

    expect(screen.getByTestId("edit-quest-mobile-sheet").style.getPropertyValue("--companion-frosted-primary")).toBe(
      companionFrostedThemeStyle["--companion-frosted-primary"],
    );
  });

  it("themes the delete confirmation portal with the resolved companion color", () => {
    const companionFrostedThemeStyle = getCompanionFrostedThemeStyle("#9b6bff");

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByTestId("edit-quest-delete-dialog");
    expect(dialog).toHaveClass("companion-frosted-quest-light");
    expect(dialog.style.getPropertyValue("--companion-frosted-primary")).toBe(
      companionFrostedThemeStyle["--companion-frosted-primary"],
    );
  });

  it("uses the companion primary CTA style when easy is selected", () => {
    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Easy" }));

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    expect(saveButton).toBeEnabled();
    expectElementToIncludeClasses(saveButton, DIFFICULTY_COLORS.easy.primaryButton);
  });

  it("uses the companion primary CTA style when medium is selected", () => {
    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Medium" }));

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    expect(saveButton).toBeEnabled();
    expectElementToIncludeClasses(saveButton, DIFFICULTY_COLORS.medium.primaryButton);
  });

  it("renders the desktop panel presentation when requested", () => {
    render(
      <EditQuestDialog
        task={legacyTask}
        open
        presentation="desktop-panel"
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
    );

    expect(screen.getByTestId("edit-quest-desktop-panel")).toBeInTheDocument();
    expectElementToIncludeClasses(
      screen.getByTestId("edit-quest-desktop-panel"),
      "border-[hsl(var(--celestial-blue)_/_0.62)] text-foreground",
    );
    expect(screen.queryByTestId("edit-quest-mobile-sheet")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Legacy quest")).toBeInTheDocument();
  });

  it("renders early reminder above subtasks after the time controls", () => {
    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
    );

    const timeButton = screen.getByRole("button", { name: "9:30 AM" });
    const durationButton = screen.getByRole("button", { name: "30 min" });
    const reminderButton = screen.getByRole("button", { name: "None" });
    const addSubtaskInput = screen.getByPlaceholderText("Add Subtask");

    expect(timeButton.compareDocumentPosition(durationButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(durationButton.compareDocumentPosition(reminderButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reminderButton.compareDocumentPosition(addSubtaskInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows custom and long early reminder options from the edit quest dialog", () => {
    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "None" }));

    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 day before" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 days before" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 week before" })).toBeInTheDocument();
  });

  it.each([undefined, "desktop-panel"] as const)(
    "shows Early Reminder above Advanced Settings without duplicating it for %s presentation",
    (presentation) => {
      render(
        <EditQuestDialog
          task={legacyTask}
          open
          presentation={presentation}
          onOpenChange={vi.fn()}
          onSave={vi.fn().mockResolvedValue(undefined)}
          isSaving={false}
        />,
      );

      const reminderLabel = screen.getByText("Early Reminder");
      const advancedTrigger = screen.getByRole("button", { name: /Advanced Settings/i });
      const relation = advancedTrigger.compareDocumentPosition(reminderLabel);

      expect(relation & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      expect(screen.queryByText("Recurrence")).not.toBeInTheDocument();

      fireEvent.click(advancedTrigger);

      expect(screen.getAllByText("Early Reminder")).toHaveLength(1);
      expect(screen.getByText("Recurrence")).toBeInTheDocument();
    },
  );

  it("normalizes legacy values before save", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        task_date: "2026-02-13",
        difficulty: "hard",
        scheduled_time: "09:30",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("saves manual custom time values from the time picker", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "9:30 AM" }));
    const customTimeInput = screen.getByLabelText("Custom quest time");
    expect(customTimeInput).toHaveClass("text-base");
    fireEvent.change(customTimeInput, {
      target: { value: "11:17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        scheduled_time: "11:17",
      }),
    );
  });

  it("saves multiple early reminder offsets", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    fireEvent.click(screen.getByRole("button", { name: "1 hour before" }));
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "1 hour before" }).some(
        (button) => button.getAttribute("aria-haspopup") === "dialog",
      )).toBe(true);
    });
    fireEvent.click(screen.getByRole("button", { name: "10 minutes before" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        reminder_enabled: true,
        reminder_minutes_before: 10,
        reminder_offsets_minutes: [10, 60],
      }),
    );
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
        <EditQuestDialog
          task={legacyTask}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn().mockResolvedValue(undefined)}
          isSaving={false}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "9:30 AM" }));
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

  it("normalizes legacy weekly multi-day recurrence to custom on save", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyWeeklyMultiDayTask}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      "task-2",
      expect.objectContaining({
        recurrence_pattern: "custom",
        recurrence_days: [0, 2, 4],
      }),
    );
  });

  it("includes attachments in save payload", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        isSaving={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Attachments" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ fileUrl: "https://example.com/a.png" }),
        ]),
        image_url: "https://example.com/a.png",
      }),
    );
  });

  it("requires time before saving recurring quests", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyRecurringWithoutTimeTask}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        isSaving={false}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText("Set a time before enabling recurrence.")).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it("uses a local planner subtask draft for planner edits", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        isSaving={false}
        plannerSubtaskDraft={["Warm up", "Cooldown"]}
      />,
    );

    expect(screen.getByText("Warm up")).toBeInTheDocument();
    expect(screen.getByText("Cooldown")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Add Subtask"), {
      target: { value: "Stretch" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Add Subtask"), {
      key: "Enter",
      code: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        subtasks: ["Warm up", "Cooldown", "Stretch"],
      }),
    );
    expect(mocks.addSubtask).not.toHaveBeenCalled();
    expect(mocks.deleteSubtask).not.toHaveBeenCalled();
  });

  it("removes planner-draft subtasks locally without mutating live subtasks", () => {
    render(
      <EditQuestDialog
        task={legacyTask}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        plannerSubtaskDraft={["Warm up", "Cooldown"]}
      />,
    );

    const warmupRow = screen.getByText("Warm up").closest("div");
    const deleteButtons = warmupRow?.querySelectorAll("button") ?? [];
    const deleteButton = deleteButtons[deleteButtons.length - 1] ?? null;
    if (!(deleteButton instanceof HTMLButtonElement)) {
      throw new Error("Planner subtask delete button not found");
    }

    fireEvent.click(deleteButton);

    expect(screen.queryByText("Warm up")).not.toBeInTheDocument();
    expect(screen.getByText("Cooldown")).toBeInTheDocument();
    expect(mocks.deleteSubtask).not.toHaveBeenCalled();
    expect(mocks.toggleSubtask).not.toHaveBeenCalled();
  });
});

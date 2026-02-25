import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditQuestDialog } from "./EditQuestDialog";

const mocks = vi.hoisted(() => ({
  addSubtask: vi.fn(),
  toggleSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
}));

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
    fireEvent.change(screen.getByLabelText("Custom quest time"), {
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
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestAttachmentPicker } from "./QuestAttachmentPicker";
import type { QuestAttachmentInput } from "@/types/questAttachments";

const mocks = vi.hoisted(() => ({
  pickAttachments: vi.fn(),
  pickPhotoAttachments: vi.fn(),
  pickFileAttachments: vi.fn(),
  deleteAttachment: vi.fn().mockResolvedValue(true),
  isNativeAttachmentPicker: false,
  isUploading: false,
}));

vi.mock("@/hooks/useQuestImagePicker", () => ({
  useQuestImagePicker: () => ({
    pickAttachments: mocks.pickAttachments,
    pickPhotoAttachments: mocks.pickPhotoAttachments,
    pickFileAttachments: mocks.pickFileAttachments,
    deleteAttachment: mocks.deleteAttachment,
    isNativeAttachmentPicker: mocks.isNativeAttachmentPicker,
    isUploading: mocks.isUploading,
  }),
}));

const buildAttachments = (count: number): QuestAttachmentInput[] =>
  Array.from({ length: count }, (_, idx) => ({
    fileUrl: `https://example.com/${idx + 1}.png`,
    filePath: `user/${idx + 1}.png`,
    fileName: `${idx + 1}.png`,
    mimeType: "image/png",
    fileSizeBytes: 1000,
    isImage: true,
    sortOrder: idx,
  }));

describe("QuestAttachmentPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativeAttachmentPicker = false;
    mocks.isUploading = false;
  });

  it("shows helper text for limits", () => {
    render(
      <QuestAttachmentPicker
        attachments={[]}
        onAttachmentsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Up to 10 files, 10MB each.")).toBeInTheDocument();
  });

  it("allows up to 10 attachments", async () => {
    const onAttachmentsChange = vi.fn();
    mocks.pickAttachments.mockResolvedValueOnce(buildAttachments(10));

    render(
      <QuestAttachmentPicker
        attachments={[]}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Photo/File" }));

    await waitFor(() => {
      expect(onAttachmentsChange).toHaveBeenCalledTimes(1);
    });

    expect(onAttachmentsChange.mock.calls[0][0]).toHaveLength(10);
  });

  it("does not exceed 10 when already full", async () => {
    const onAttachmentsChange = vi.fn();

    render(
      <QuestAttachmentPicker
        attachments={buildAttachments(10)}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Add Photo/File" })).toBeDisabled();
    expect(mocks.pickAttachments).not.toHaveBeenCalled();
  });

  it("shows native photo and file buttons on native platforms", async () => {
    const onAttachmentsChange = vi.fn();
    mocks.isNativeAttachmentPicker = true;
    mocks.pickPhotoAttachments.mockResolvedValueOnce(buildAttachments(2));

    render(
      <QuestAttachmentPicker
        attachments={[]}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add Photo/File" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Photos" }));

    await waitFor(() => {
      expect(onAttachmentsChange).toHaveBeenCalledTimes(1);
    });

    expect(mocks.pickPhotoAttachments).toHaveBeenCalledWith({
      currentCount: 0,
      maxCount: 10,
    });
    expect(onAttachmentsChange.mock.calls[0][0]).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add Files" })).toBeInTheDocument();
  });

  it("adds native files without replacing existing attachments", async () => {
    const onAttachmentsChange = vi.fn();
    mocks.isNativeAttachmentPicker = true;
    const existing = buildAttachments(1);
    const pickedFile: QuestAttachmentInput = {
      fileUrl: "https://example.com/manual.pdf",
      filePath: "user/manual.pdf",
      fileName: "manual.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1000,
      isImage: false,
      sortOrder: 1,
    };
    mocks.pickFileAttachments.mockResolvedValueOnce([pickedFile]);

    render(
      <QuestAttachmentPicker
        attachments={existing}
        onAttachmentsChange={onAttachmentsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Files" }));

    await waitFor(() => {
      expect(onAttachmentsChange).toHaveBeenCalledTimes(1);
    });

    expect(mocks.pickFileAttachments).toHaveBeenCalledWith({
      currentCount: 1,
      maxCount: 10,
    });
    expect(onAttachmentsChange.mock.calls[0][0]).toEqual([...existing, pickedFile]);
  });

  it("disables both native buttons when full", () => {
    mocks.isNativeAttachmentPicker = true;

    render(
      <QuestAttachmentPicker
        attachments={buildAttachments(10)}
        onAttachmentsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Add Photos" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Files" })).toBeDisabled();
    expect(mocks.pickPhotoAttachments).not.toHaveBeenCalled();
    expect(mocks.pickFileAttachments).not.toHaveBeenCalled();
  });
});

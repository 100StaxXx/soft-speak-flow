import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestAttachmentPicker } from "./QuestAttachmentPicker";
import type { QuestAttachmentInput } from "@/types/questAttachments";

const mocks = vi.hoisted(() => ({
  pickAttachments: vi.fn(),
  deleteAttachment: vi.fn().mockResolvedValue(true),
  isUploading: false,
}));

vi.mock("@/hooks/useQuestImagePicker", () => ({
  useQuestImagePicker: () => ({
    pickAttachments: mocks.pickAttachments,
    deleteAttachment: mocks.deleteAttachment,
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
});


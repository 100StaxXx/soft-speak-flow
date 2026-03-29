import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  functionsInvokeMock: vi.fn(),
  storageFromMock: vi.fn(),
  uploadToSignedUrlMock: vi.fn(),
  createSignedUrlMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.functionsInvokeMock(...args),
    },
    storage: {
      from: (...args: unknown[]) => mocks.storageFromMock(...args),
    },
  },
}));

import { useQuestImagePicker } from "./useQuestImagePicker";

describe("useQuestImagePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFromMock.mockReturnValue({
      uploadToSignedUrl: mocks.uploadToSignedUrlMock,
      createSignedUrl: mocks.createSignedUrlMock,
    });
    mocks.functionsInvokeMock.mockResolvedValue({
      data: {
        path: "user-1/123_attachment.png",
        token: "signed-upload-token",
      },
      error: null,
    });
    mocks.uploadToSignedUrlMock.mockResolvedValue({ error: null });
    mocks.createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/user-1/123_attachment.png" },
      error: null,
    });
  });

  it("uploads quest attachments and returns signed read URLs", async () => {
    const { result } = renderHook(() => useQuestImagePicker());
    const file = new File(["hello"], "quest.png", { type: "image/png" });

    let attachment: Awaited<ReturnType<typeof result.current.uploadAttachment>> = null;
    await act(async () => {
      attachment = await result.current.uploadAttachment(file, file.name);
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("init-quest-attachment-upload", {
      body: {
        fileName: "quest.png",
        mimeType: "image/png",
        fileSizeBytes: 5,
      },
    });
    expect(mocks.storageFromMock).toHaveBeenCalledWith("quest-attachments");
    expect(mocks.uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/123_attachment.png",
      "signed-upload-token",
      file,
      {
        contentType: "image/png",
        upsert: false,
      },
    );
    expect(mocks.createSignedUrlMock).toHaveBeenCalledWith("user-1/123_attachment.png", 3600);
    expect(attachment).toMatchObject({
      filePath: "user-1/123_attachment.png",
      fileUrl: "https://signed.example/user-1/123_attachment.png",
      fileName: "quest.png",
      mimeType: "image/png",
      isImage: true,
    });
  });

  it("deletes attachments using the storage path extracted from signed URLs", async () => {
    mocks.functionsInvokeMock.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useQuestImagePicker());

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteAttachment(
        "https://example.supabase.co/storage/v1/object/sign/quest-attachments/user-1%2F123_attachment.png?token=abc",
      );
    });

    expect(deleted).toBe(true);

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("delete-quest-attachment", {
      body: {
        filePath: "user-1/123_attachment.png",
      },
    });
  });
});

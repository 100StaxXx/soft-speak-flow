import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  functionsInvokeMock: vi.fn(),
  storageFromMock: vi.fn(),
  uploadToSignedUrlMock: vi.fn(),
  createSignedUrlMock: vi.fn(),
  isNativePlatformMock: vi.fn(() => false),
  convertFileSrcMock: vi.fn((path: string) => `capacitor://localhost/_capacitor_file_${path}`),
  pickImagesMock: vi.fn(),
  pickFilesMock: vi.fn(),
  fetchMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNativePlatformMock(),
    convertFileSrc: (path: string) => mocks.convertFileSrcMock(path),
  },
}));

vi.mock("@capawesome/capacitor-file-picker", () => ({
  FilePicker: {
    pickImages: (...args: unknown[]) => mocks.pickImagesMock(...args),
    pickFiles: (...args: unknown[]) => mocks.pickFilesMock(...args),
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

vi.mock("@/components/ui/sonner", () => ({
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
    mocks.isNativePlatformMock.mockReturnValue(false);
    mocks.convertFileSrcMock.mockImplementation((path: string) => `capacitor://localhost/_capacitor_file_${path}`);
    mocks.fetchMock.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["hello"], { type: "image/jpeg" })),
    });
    vi.stubGlobal("fetch", mocks.fetchMock);
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

  it("uploads native photo picks through signed attachment uploads", async () => {
    mocks.isNativePlatformMock.mockReturnValue(true);
    mocks.pickImagesMock.mockResolvedValueOnce({
      files: [{
        name: "IMG_0001.HEIC",
        mimeType: "image/jpeg",
        path: "file:///tmp/photo.jpeg",
        size: 5,
      }],
    });

    const { result } = renderHook(() => useQuestImagePicker());

    let attachments: Awaited<ReturnType<typeof result.current.pickPhotoAttachments>> = [];
    await act(async () => {
      attachments = await result.current.pickPhotoAttachments({ currentCount: 0, maxCount: 10 });
    });

    expect(mocks.pickImagesMock).toHaveBeenCalledWith({
      limit: 10,
      ordered: true,
      readData: false,
      skipTranscoding: false,
    });
    expect(mocks.convertFileSrcMock).toHaveBeenCalledWith("file:///tmp/photo.jpeg");
    expect(mocks.fetchMock).toHaveBeenCalledWith("capacitor://localhost/_capacitor_file_file:///tmp/photo.jpeg");
    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("init-quest-attachment-upload", {
      body: {
        fileName: "IMG_0001.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 5,
      },
    });
    expect(attachments[0]).toMatchObject({
      fileName: "IMG_0001.jpg",
      mimeType: "image/jpeg",
      isImage: true,
    });
  });

  it("uploads native file picks through signed attachment uploads", async () => {
    mocks.isNativePlatformMock.mockReturnValue(true);
    mocks.pickFilesMock.mockResolvedValueOnce({
      files: [{
        name: "brief.pdf",
        mimeType: "application/pdf",
        path: "file:///tmp/brief.pdf",
        size: 7,
      }],
    });
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["pdfdata"], { type: "application/pdf" })),
    });

    const { result } = renderHook(() => useQuestImagePicker());

    let attachments: Awaited<ReturnType<typeof result.current.pickFileAttachments>> = [];
    await act(async () => {
      attachments = await result.current.pickFileAttachments({ currentCount: 9, maxCount: 10 });
    });

    expect(mocks.pickFilesMock).toHaveBeenCalledWith({
      types: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/csv",
      ],
      limit: 1,
      readData: false,
    });
    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("init-quest-attachment-upload", {
      body: {
        fileName: "brief.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 7,
      },
    });
    expect(attachments[0]).toMatchObject({
      fileName: "brief.pdf",
      mimeType: "application/pdf",
      isImage: false,
    });
  });

  it("rejects unsupported native file types before upload", async () => {
    mocks.isNativePlatformMock.mockReturnValue(true);
    mocks.pickFilesMock.mockResolvedValueOnce({
      files: [{
        name: "malware.exe",
        mimeType: "application/x-msdownload",
        path: "file:///tmp/malware.exe",
        size: 4,
      }],
    });

    const { result } = renderHook(() => useQuestImagePicker());

    let attachments: Awaited<ReturnType<typeof result.current.pickFileAttachments>> = [];
    await act(async () => {
      attachments = await result.current.pickFileAttachments();
    });

    expect(attachments).toEqual([]);
    expect(mocks.toastErrorMock).toHaveBeenCalledWith('"malware.exe" is not a supported file type.');
    expect(mocks.fetchMock).not.toHaveBeenCalled();
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("rejects oversized native files before upload", async () => {
    mocks.isNativePlatformMock.mockReturnValue(true);
    mocks.pickFilesMock.mockResolvedValueOnce({
      files: [{
        name: "large.pdf",
        mimeType: "application/pdf",
        path: "file:///tmp/large.pdf",
        size: 10 * 1024 * 1024 + 1,
      }],
    });

    const { result } = renderHook(() => useQuestImagePicker());

    let attachments: Awaited<ReturnType<typeof result.current.pickFileAttachments>> = [];
    await act(async () => {
      attachments = await result.current.pickFileAttachments();
    });

    expect(attachments).toEqual([]);
    expect(mocks.toastErrorMock).toHaveBeenCalledWith('"large.pdf" exceeds the 10MB limit.');
    expect(mocks.fetchMock).not.toHaveBeenCalled();
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });

  it("handles native picker cancellation and empty selections without errors", async () => {
    mocks.isNativePlatformMock.mockReturnValue(true);
    mocks.pickImagesMock
      .mockRejectedValueOnce(new Error("User cancelled photos"))
      .mockResolvedValueOnce({ files: [] });

    const { result } = renderHook(() => useQuestImagePicker());

    let cancelled: Awaited<ReturnType<typeof result.current.pickPhotoAttachments>> = [];
    await act(async () => {
      cancelled = await result.current.pickPhotoAttachments();
    });

    let empty: Awaited<ReturnType<typeof result.current.pickPhotoAttachments>> = [];
    await act(async () => {
      empty = await result.current.pickPhotoAttachments();
    });

    expect(cancelled).toEqual([]);
    expect(empty).toEqual([]);
    expect(mocks.toastErrorMock).not.toHaveBeenCalled();
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
  });
});

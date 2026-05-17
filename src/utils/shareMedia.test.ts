import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNative: false,
  nativeCanShareMock: vi.fn(),
  nativeShareMock: vi.fn(),
  writeFileMock: vi.fn(),
  toPngMock: vi.fn(),
  renderEvolutionShareVideoMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNative,
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: {
    Cache: "CACHE",
  },
  Filesystem: {
    writeFile: mocks.writeFileMock,
  },
}));

vi.mock("@capacitor/share", () => ({
  Share: {
    canShare: mocks.nativeCanShareMock,
    share: mocks.nativeShareMock,
  },
}));

vi.mock("html-to-image", () => ({
  toPng: mocks.toPngMock,
}));

vi.mock("@/plugins/EvolutionShareVideoPlugin", () => ({
  EvolutionShareVideo: {
    renderEvolutionShareVideo: mocks.renderEvolutionShareVideoMock,
  },
}));

import {
  isShareCancelled,
  renderEvolutionShareVideo,
  renderShareCardImage,
  shareRenderedMedia,
} from "./shareMedia";

const pngDataUrl = "data:image/png;base64,cG5n";

const setNavigatorCapability = ({
  share,
  canShare,
  writeText,
}: {
  share?: Navigator["share"];
  canShare?: Navigator["canShare"];
  writeText?: (text: string) => Promise<void>;
}) => {
  Object.defineProperty(window.navigator, "share", {
    configurable: true,
    value: share,
  });
  Object.defineProperty(window.navigator, "canShare", {
    configurable: true,
    value: canShare,
  });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
};

describe("shareMedia", () => {
  beforeEach(() => {
    mocks.isNative = false;
    mocks.nativeCanShareMock.mockReset();
    mocks.nativeCanShareMock.mockResolvedValue({ value: true });
    mocks.nativeShareMock.mockReset();
    mocks.nativeShareMock.mockResolvedValue({});
    mocks.writeFileMock.mockReset();
    mocks.writeFileMock.mockResolvedValue({ uri: "file:///cache/cosmiq-card.png" });
    mocks.toPngMock.mockReset();
    mocks.toPngMock.mockResolvedValue(pngDataUrl);
    mocks.renderEvolutionShareVideoMock.mockReset();
    mocks.renderEvolutionShareVideoMock.mockResolvedValue({
      uri: "file:///cache/evolution.mp4",
      filename: "evolution.mp4",
      mimeType: "video/mp4",
      width: 1080,
      height: 1920,
      durationMs: 3000,
    });
    setNavigatorCapability({});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["png"], { type: "image/png" }))),
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:cosmiq-share"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("detects share sheet cancellation without treating real failures as cancel", () => {
    expect(isShareCancelled(new DOMException("The operation was aborted.", "AbortError"))).toBe(true);
    expect(isShareCancelled(new Error("Share sheet dismissed by user"))).toBe(true);
    expect(isShareCancelled("User cancelled the dialog")).toBe(true);
    expect(isShareCancelled(new Error("Network request failed"))).toBe(false);
  });

  it("renders a share card image as a web File", async () => {
    const element = document.createElement("div");

    const result = await renderShareCardImage({
      element,
      filename: "cosmiq-card.png",
      format: "story",
    });

    expect(mocks.toPngMock).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        pixelRatio: 3,
        backgroundColor: "#080a12",
      }),
    );
    expect(result).toBeInstanceOf(File);
    expect((result as File).name).toBe("cosmiq-card.png");
    expect((result as File).type).toBe("image/png");
  });

  it("renders a share card image into native cache on native platforms", async () => {
    mocks.isNative = true;
    const element = document.createElement("div");

    const result = await renderShareCardImage({
      element,
      filename: "cosmiq-card.png",
      format: "square",
    });

    expect(mocks.writeFileMock).toHaveBeenCalledWith({
      path: "cosmiq-card.png",
      data: "cG5n",
      directory: "CACHE",
      recursive: true,
    });
    expect(result).toEqual({
      uri: "file:///cache/cosmiq-card.png",
      filename: "cosmiq-card.png",
      mimeType: "image/png",
      width: 1080,
      height: 1080,
    });
  });

  it("uses the native share sheet for native rendered media", async () => {
    mocks.isNative = true;
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorCapability({ writeText });

    const result = await shareRenderedMedia({
      uriOrFile: {
        uri: "file:///cache/evolution.mp4",
        filename: "evolution.mp4",
        mimeType: "video/mp4",
      },
      title: "Stage 5 Evolution",
      text: "My companion just evolved. #Cosmiq",
      dialogTitle: "Share evolution video",
    });

    expect(result).toEqual({ status: "shared", captionCopied: true });
    expect(mocks.nativeCanShareMock).toHaveBeenCalled();
    expect(mocks.nativeShareMock).toHaveBeenCalledWith({
      title: "Stage 5 Evolution",
      text: "My companion just evolved. #Cosmiq",
      url: undefined,
      files: ["file:///cache/evolution.mp4"],
      dialogTitle: "Share evolution video",
    });
    expect(writeText).toHaveBeenCalledWith("My companion just evolved. #Cosmiq");
  });

  it("uses Web Share files when supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    setNavigatorCapability({ share, canShare });
    const file = new File(["card"], "cosmiq-card.png", { type: "image/png" });

    const result = await shareRenderedMedia({
      uriOrFile: file,
      title: "Cosmiq title",
      text: "My current Cosmiq title. #Cosmiq",
    });

    expect(result.status).toBe("shared");
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
    expect(share).toHaveBeenCalledWith({
      files: [file],
      title: "Cosmiq title",
      text: "My current Cosmiq title. #Cosmiq",
    });
  });

  it("returns cancelled when the share target is dismissed", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const canShare = vi.fn().mockReturnValue(true);
    setNavigatorCapability({ share, canShare });

    const result = await shareRenderedMedia({
      uriOrFile: new File(["card"], "cosmiq-card.png", { type: "image/png" }),
      title: "Cosmiq title",
      text: "My current Cosmiq title. #Cosmiq",
    });

    expect(result.status).toBe("cancelled");
  });

  it("downloads when sharing is unsupported", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    setNavigatorCapability({});
    const file = new File(["card"], "cosmiq-card.png", { type: "image/png" });

    const result = await shareRenderedMedia({
      uriOrFile: file,
      title: "Cosmiq title",
      text: "My current Cosmiq title. #Cosmiq",
    });

    expect(result.status).toBe("downloaded");
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("delegates evolution video rendering to the registered plugin", async () => {
    await renderEvolutionShareVideo({
      sourceVideoUrl: "https://example.com/source.mp4",
      posterImageUrl: "https://example.com/poster.png",
      stage: 5,
      template: "aesthetic-reveal",
    });

    expect(mocks.renderEvolutionShareVideoMock).toHaveBeenCalledWith({
      sourceVideoUrl: "https://example.com/source.mp4",
      posterImageUrl: "https://example.com/poster.png",
      stage: 5,
      template: "aesthetic-reveal",
    });
  });
});

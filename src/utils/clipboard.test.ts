import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

import { safeClipboardWrite } from "@/utils/clipboard";

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommand = document.execCommand;

const setClipboard = (clipboard: Clipboard | undefined) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
};

const setExecCommandMock = (result: boolean) => {
  const execCommandMock = vi.fn(() => result);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommandMock,
  });
  return execCommandMock;
};

describe("safeClipboardWrite", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.getPlatform.mockReturnValue("web");
    setClipboard(undefined);
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
    } else {
      delete (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
    }

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: originalExecCommand,
    });
  });

  it("returns false on native iOS when Clipboard API is unavailable and does not use execCommand", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    const execCommandMock = setExecCommandMock(true);

    const result = await safeClipboardWrite("abc");

    expect(result).toBe(false);
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  it("falls back to execCommand on non-iOS when Clipboard API is unavailable", async () => {
    const execCommandMock = setExecCommandMock(true);

    const result = await safeClipboardWrite("abc");

    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith("copy");
  });

  it("uses Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText } as unknown as Clipboard);
    const execCommandMock = setExecCommandMock(true);

    const result = await safeClipboardWrite("abc");

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("abc");
    expect(execCommandMock).not.toHaveBeenCalled();
  });
});

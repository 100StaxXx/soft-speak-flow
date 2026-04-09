import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceQuestCaptureDrawer } from "./VoiceQuestCaptureDrawer";

const mocks = vi.hoisted(() => ({
  isRecording: false,
  isAutoStopping: false,
  permissionStatus: "granted" as "granted" | "prompt" | "denied" | "unsupported",
  startRecording: vi.fn(async () => undefined),
  stopRecording: vi.fn(),
  requestPermission: vi.fn(async () => "granted" as const),
  latestOptions: null as null | {
    onInterimResult?: (text: string) => void;
    onFinalResult?: (text: string) => void;
    onError?: (message: string) => void;
    onPermissionNeeded?: () => void;
  },
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: (options: typeof mocks.latestOptions) => {
    mocks.latestOptions = options;

    return {
      isRecording: mocks.isRecording,
      isAutoStopping: mocks.isAutoStopping,
      isSupported: true,
      permissionStatus: mocks.permissionStatus,
      startRecording: mocks.startRecording,
      stopRecording: mocks.stopRecording,
      toggleRecording: vi.fn(),
      requestPermission: mocks.requestPermission,
    };
  },
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
    shouldScaleBackground?: boolean;
  }) => (open ? <div data-testid="voice-drawer">{children}</div> : null),
  DrawerContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DrawerHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DrawerTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DrawerDescription: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DrawerFooter: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/AudioReactiveWaveform", () => ({
  AudioReactiveWaveform: ({ isActive }: { isActive: boolean }) => (
    <div data-testid="waveform" data-active={String(isActive)} />
  ),
}));

vi.mock("@/components/PermissionRequestDialog", () => ({
  PermissionRequestDialog: ({
    isOpen,
    permissionStatus,
    onRequestPermission,
    onClose,
  }: {
    isOpen: boolean;
    permissionStatus: string;
    onRequestPermission: () => void;
    onClose: () => void;
    isRequesting?: boolean;
  }) =>
    isOpen ? (
      <div data-testid="permission-dialog" data-status={permissionStatus}>
        <button type="button" onClick={onRequestPermission}>
          request permission
        </button>
        <button type="button" onClick={onClose}>
          close permission
        </button>
      </div>
    ) : null,
}));

describe("VoiceQuestCaptureDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRecording = false;
    mocks.isAutoStopping = false;
    mocks.permissionStatus = "granted";
    mocks.requestPermission.mockResolvedValue("granted");
    mocks.latestOptions = null;
  });

  it("starts recording on open and forwards the final transcript into the existing quest flow", async () => {
    const onCapture = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <VoiceQuestCaptureDrawer open onOpenChange={onOpenChange} onCapture={onCapture} />,
    );

    await waitFor(() => {
      expect(mocks.startRecording).toHaveBeenCalledTimes(1);
    });

    act(() => {
      mocks.latestOptions?.onFinalResult?.("Plan focus sprint");
    });

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith("Plan focus sprint");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("retries capture after permission is granted from the prompt flow", async () => {
    mocks.permissionStatus = "prompt";
    mocks.isRecording = false;
    const onOpenChange = vi.fn();

    render(
      <VoiceQuestCaptureDrawer open onOpenChange={onOpenChange} onCapture={vi.fn()} />,
    );

    mocks.startRecording.mockClear();

    act(() => {
      mocks.latestOptions?.onPermissionNeeded?.();
    });

    expect(screen.getByTestId("permission-dialog")).toHaveAttribute("data-status", "prompt");

    fireEvent.click(screen.getByRole("button", { name: "request permission" }));

    await waitFor(() => {
      expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
      expect(mocks.startRecording).toHaveBeenCalledTimes(1);
    });
  });

  it.each(["denied", "unsupported"] as const)(
    "surfaces the %s permission state through the permission dialog",
    (permissionStatus) => {
      mocks.permissionStatus = permissionStatus;
      mocks.isRecording = false;

      render(
        <VoiceQuestCaptureDrawer open onOpenChange={vi.fn()} onCapture={vi.fn()} />,
      );

      act(() => {
        mocks.latestOptions?.onPermissionNeeded?.();
      });

      expect(screen.getByTestId("permission-dialog")).toHaveAttribute("data-status", permissionStatus);
    },
  );
});

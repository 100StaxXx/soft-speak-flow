import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    stopSpeaking: vi.fn(),
  },
  modeSettings: {
    setMode: vi.fn(),
    setAdaptationEnabled: vi.fn(),
  },
  state: {
    messages: [
      {
        id: "a1",
        role: "assistant" as const,
        content: "Tomorrow is pretty light.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "agent" as const,
      },
      {
        id: "a2",
        role: "user" as const,
        content: "I want to hit the gym at 3",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "agent" as const,
      },
    ],
    draftInput: "I want to hit the gym at 3",
    pendingAction: {
      id: "action-1",
      status: "pending" as const,
      intent: "schedule_task" as const,
      actionType: "task_create" as const,
      summary: 'Add "Gym" for 2026-04-18 at 15:00.',
      confirmationMessage: 'Want me to add "Gym" for 2026-04-18 at 15:00?',
      normalizedPayload: {},
      affectedEntities: null,
      expiresAt: "2026-04-18T20:00:00.000Z",
      createdAt: "2026-04-18T08:02:00.000Z",
    },
  },
}));

vi.mock("@/hooks/useCompanionAssistant", () => ({
  useCompanionAssistant: () => ({
    todayLabel: "Saturday, April 18",
    placeholder: "Talk to Cosmiq naturally.",
    messages: mocks.state.messages,
    pendingAction: mocks.state.pendingAction,
    draftInput: mocks.state.draftInput,
    setDraftInput: mocks.assistant.setDraftInput,
    interimText: "",
    isSubmitting: false,
    isResolvingAction: false,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    confirmPendingAction: mocks.assistant.confirmPendingAction,
    cancelPendingAction: mocks.assistant.cancelPendingAction,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted" as const,
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    isRequestingPermission: false,
    toggleRecording: mocks.assistant.toggleRecording,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
    isSpeaking: false,
    speechProvider: "device" as const,
    stopSpeaking: mocks.assistant.stopSpeaking,
  }),
}));

vi.mock("@/hooks/useCompanionModeSettings", () => ({
  useCompanionModeSettings: () => ({
    mode: "alpha" as const,
    adaptationEnabled: true,
    isLoading: false,
    isSaving: false,
    setMode: mocks.modeSettings.setMode,
    setAdaptationEnabled: mocks.modeSettings.setAdaptationEnabled,
  }),
}));

import { CompanionPlannerPanel } from "./CompanionPlannerPanel";

describe("CompanionPlannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the unified transcript and pending confirmation card", () => {
    render(<CompanionPlannerPanel />);

    expect(screen.getByText("Tomorrow is pretty light.")).toBeInTheDocument();
    expect(screen.getByText('Add "Gym" for 2026-04-18 at 15:00.')).toBeInTheDocument();
    expect(screen.getByText('Want me to add "Gym" for 2026-04-18 at 15:00?')).toBeInTheDocument();
  });

  it("wires confirm and cancel actions to the unified assistant hook", () => {
    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.assistant.confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.cancelPendingAction).toHaveBeenCalledTimes(1);
  });

  it("submits the typed message from the single composer", () => {
    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByTestId("companion-assistant-send-button"));

    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
  });
});

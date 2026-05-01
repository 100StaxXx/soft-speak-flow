import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  navigate: vi.fn(),
  generateBriefing: vi.fn(),
  dismissBriefing: vi.fn(),
  markViewed: vi.fn(),
  refetchBriefing: vi.fn(),
  parseFunctionInvokeError: vi.fn(),
  toUserFacingFunctionError: vi.fn(),
  briefingError: null as Error | null,
  briefing: null as null | {
    id: string;
    viewed_at: string | null;
    dismissed_at: string | null;
    content: string;
    inferred_goals: string[];
    todays_focus: string | null;
    action_prompt: string | null;
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => ({
    name: "The Sage",
    slug: "sage",
    primary_color: "#000000",
  }),
}));

vi.mock("@/hooks/useMorningBriefing", () => ({
  useMorningBriefing: () => ({
    briefing: mocks.briefing,
    isLoading: false,
    error: mocks.briefingError,
    refetch: mocks.refetchBriefing,
    generateBriefing: {
      mutateAsync: mocks.generateBriefing,
    },
    dismissBriefing: {
      mutateAsync: mocks.dismissBriefing,
    },
    markViewed: {
      mutate: mocks.markViewed,
    },
    isGenerating: false,
  }),
}));

vi.mock("@/utils/supabaseFunctionErrors", () => ({
  parseFunctionInvokeError: mocks.parseFunctionInvokeError,
  toUserFacingFunctionError: mocks.toUserFacingFunctionError,
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: () => <div data-testid="mentor-avatar" />,
}));

import { MorningBriefing } from "./MorningBriefing";

describe("MorningBriefing error handling", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.toast.mockClear();
    mocks.navigate.mockClear();
    mocks.generateBriefing.mockReset();
    mocks.dismissBriefing.mockReset();
    mocks.markViewed.mockReset();
    mocks.refetchBriefing.mockReset();
    mocks.parseFunctionInvokeError.mockReset();
    mocks.toUserFacingFunctionError.mockReset();
    mocks.briefingError = null;
    mocks.briefing = null;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("parses function failures for the toast and persistent inline error", async () => {
    const invokeError = new Error("Edge Function returned a non-2xx status code");
    const parsedError = {
      category: "http",
      isOffline: false,
      backendMessage: "AI service not configured",
    };
    mocks.generateBriefing.mockRejectedValueOnce(invokeError);
    mocks.parseFunctionInvokeError.mockResolvedValueOnce(parsedError);
    mocks.toUserFacingFunctionError.mockReturnValueOnce("AI service not configured");

    render(<MorningBriefing />);

    fireEvent.click(screen.getByRole("button", { name: /prepare my briefing/i }));

    await waitFor(() => {
      expect(mocks.parseFunctionInvokeError).toHaveBeenCalledWith(invokeError);
    });
    expect(mocks.toUserFacingFunctionError).toHaveBeenCalledWith(parsedError, {
      action: "prepare your briefing",
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Couldn't prepare briefing",
      description: "AI service not configured",
      variant: "destructive",
    });
    expect(screen.getByText("AI service not configured")).toBeInTheDocument();
  });

  it("shows a persistent load error instead of the generate action", async () => {
    mocks.briefingError = new Error("RLS denied");
    mocks.refetchBriefing.mockResolvedValueOnce({ data: null });

    render(<MorningBriefing />);

    expect(screen.getByText("Couldn't load today's briefing.")).toBeInTheDocument();
    expect(screen.getByText("Please try again before preparing a new briefing.")).toBeInTheDocument();
    expect(screen.queryByText("RLS denied")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /prepare my briefing/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mocks.refetchBriefing).toHaveBeenCalled();
    });
  });
});

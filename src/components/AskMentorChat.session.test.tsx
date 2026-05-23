import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const futureExpiry = () => Math.floor(Date.now() / 1000) + 3600;

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  refreshSession: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
  getSession: vi.fn(),
  invokeFunction: vi.fn(),
  from: vi.fn(),
  countMentorChats: vi.fn(),
  insertMentorChats: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    refreshSession: mocks.refreshSession,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    functions: {
      invoke: mocks.invokeFunction,
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("./MentorChatFeedback", () => ({
  MentorChatFeedback: () => null,
}));

import { AskMentorChat } from "./AskMentorChat";

const activeSession = () => ({
  access_token: "access-token",
  expires_at: futureExpiry(),
});

const renderAskMentorChat = () =>
  render(
    <MemoryRouter>
      <AskMentorChat
        mentorName="The Sage"
        mentorTone="Calm and steady"
        mentorSlug="sage"
        mentorId="mentor-1"
      />
    </MemoryRouter>,
  );

const submitMentorMessage = (message = "Help me reset") => {
  fireEvent.change(screen.getByPlaceholderText("Type your message..."), {
    target: { value: message },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
};

const configureMentorChatsTable = () => {
  const countChain = {
    eq: vi.fn(() => countChain),
    gte: vi.fn(() => mocks.countMentorChats()),
  };

  mocks.from.mockImplementation((table: string) => {
    if (table !== "mentor_chats") {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      select: vi.fn(() => countChain),
      insert: mocks.insertMentorChats,
    };
  });
};

describe("AskMentorChat session handling", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();

    mocks.user = { id: "user-1" };
    mocks.refreshSession.mockClear();
    mocks.toast.mockClear();
    mocks.getSession.mockReset();
    mocks.invokeFunction.mockReset();
    mocks.from.mockReset();
    mocks.countMentorChats.mockReset();
    mocks.insertMentorChats.mockReset();

    configureMentorChatsTable();
    mocks.countMentorChats.mockResolvedValue({ count: 0, error: null });
    mocks.insertMentorChats.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: activeSession() },
      error: null,
    });
    mocks.invokeFunction.mockResolvedValue({
      data: {
        response: "Take one breath, then choose the next small step.",
        dailyLimit: 20,
        messagesUsed: 1,
      },
      error: null,
    });
  });

  it("invokes mentor-chat with an active cached session without refreshing", async () => {
    renderAskMentorChat();

    submitMentorMessage();

    await waitFor(() => {
      expect(mocks.invokeFunction).toHaveBeenCalledWith(
        "mentor-chat",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "Help me reset",
            mentorName: "The Sage",
            mentorTone: "Calm and steady",
            mentorSlug: "sage",
          }),
        }),
      );
    });
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("refreshes a missing cached session before invoking mentor-chat", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: activeSession() }, error: null });

    renderAskMentorChat();

    submitMentorMessage();

    await waitFor(() => {
      expect(mocks.invokeFunction).toHaveBeenCalledTimes(1);
    });
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledTimes(2);
  });

  it("shows a session-expired toast and does not invoke when recovery fails", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    renderAskMentorChat();

    submitMentorMessage();

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Session expired",
        description: "Please sign in again to chat with your guide.",
        variant: "destructive",
      });
    });
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.invokeFunction).not.toHaveBeenCalled();
  });

  it("persists successful replies with the authenticated context user id", async () => {
    renderAskMentorChat();

    submitMentorMessage("What is my next move?");

    await waitFor(() => {
      expect(mocks.insertMentorChats).toHaveBeenCalledWith([
        {
          user_id: "user-1",
          mentor_id: "mentor-1",
          role: "user",
          content: "What is my next move?",
        },
        {
          user_id: "user-1",
          mentor_id: "mentor-1",
          role: "assistant",
          content: "Take one breath, then choose the next small step.",
        },
      ]);
    });
  });
});

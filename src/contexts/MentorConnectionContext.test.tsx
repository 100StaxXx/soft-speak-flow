import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    mentorId: null as string | null,
    status: "recovering" as "ready" | "recovering" | "missing",
    refreshConnection: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/hooks/useMentorConnectionHealth", () => ({
  useMentorConnectionHealth: () => ({
    effectiveMentorId: mocks.state.mentorId,
    status: mocks.state.status,
    refreshConnection: mocks.state.refreshConnection,
  }),
}));

import { MentorConnectionProvider, useMentorConnection } from "./MentorConnectionContext";

const Consumer = ({ label }: { label: string }) => {
  const { mentorId, status } = useMentorConnection();

  return (
    <div data-testid={label}>
      {mentorId ?? "none"}:{status}
    </div>
  );
};

describe("MentorConnectionProvider", () => {
  beforeEach(() => {
    mocks.state.mentorId = null;
    mocks.state.status = "recovering";
    mocks.state.refreshConnection.mockClear();
  });

  it("keeps multiple consumers in sync through recovery and mentor changes", () => {
    const { rerender } = render(
      <MentorConnectionProvider>
        <Consumer label="home" />
        <Consumer label="chat" />
      </MentorConnectionProvider>,
    );

    expect(screen.getByTestId("home")).toHaveTextContent("none:recovering");
    expect(screen.getByTestId("chat")).toHaveTextContent("none:recovering");

    mocks.state.mentorId = "mentor-restored";
    mocks.state.status = "ready";

    rerender(
      <MentorConnectionProvider>
        <Consumer label="home" />
        <Consumer label="chat" />
      </MentorConnectionProvider>,
    );

    expect(screen.getByTestId("home")).toHaveTextContent("mentor-restored:ready");
    expect(screen.getByTestId("chat")).toHaveTextContent("mentor-restored:ready");

    mocks.state.mentorId = "mentor-new";

    rerender(
      <MentorConnectionProvider>
        <Consumer label="home" />
        <Consumer label="chat" />
      </MentorConnectionProvider>,
    );

    expect(screen.getByTestId("home")).toHaveTextContent("mentor-new:ready");
    expect(screen.getByTestId("chat")).toHaveTextContent("mentor-new:ready");
  });
});

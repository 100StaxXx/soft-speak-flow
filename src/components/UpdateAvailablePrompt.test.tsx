import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {
    hasUpdate: false,
    channel: null as "pwa" | "ios_store" | null,
    currentVersion: null as string | null,
    latestVersion: null as string | null,
  },
  updateActionMock: vi.fn(),
  dismissMock: vi.fn(),
}));

vi.mock("@/hooks/useUpdateAvailability", () => ({
  useUpdateAvailability: () => ({
    ...mocks.state,
    updateAction: mocks.updateActionMock,
    dismiss: mocks.dismissMock,
  }),
}));

import { UpdateAvailablePrompt } from "./UpdateAvailablePrompt";

describe("UpdateAvailablePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.hasUpdate = false;
    mocks.state.channel = null;
    mocks.state.currentVersion = null;
    mocks.state.latestVersion = null;
  });

  it("does not render when no update exists", () => {
    render(<UpdateAvailablePrompt />);
    expect(screen.queryByText("A new update is available")).not.toBeInTheDocument();
  });

  it("renders PWA actions and dispatches update + dismiss handlers", () => {
    mocks.state.hasUpdate = true;
    mocks.state.channel = "pwa";
    mocks.state.currentVersion = "sw-old";
    mocks.state.latestVersion = "sw-new";

    render(<UpdateAvailablePrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(mocks.dismissMock).toHaveBeenCalledWith("sw-new");

    fireEvent.click(screen.getByRole("button", { name: "Update now" }));
    expect(mocks.updateActionMock).toHaveBeenCalledTimes(1);
  });

  it("renders Open App Store label for iOS store updates", () => {
    mocks.state.hasUpdate = true;
    mocks.state.channel = "ios_store";
    mocks.state.currentVersion = "1.0.0";
    mocks.state.latestVersion = "1.1.0";

    render(<UpdateAvailablePrompt />);

    expect(screen.getByRole("button", { name: "Open App Store" })).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reveal: vi.fn(),
  medium: vi.fn(),
  success: vi.fn(),
  ensureReady: vi.fn(),
  play: vi.fn(),
}));

vi.mock("@/services/companionCinemaInteractions", () => ({
  revealCompanionCinemaEvent: (...args: unknown[]) => mocks.reveal(...args),
}));
vi.mock("@/utils/haptics", () => ({
  haptics: { medium: mocks.medium, success: mocks.success },
}));
vi.mock("@/utils/globalAudio", () => ({
  globalAudio: {
    getMuted: () => false,
    subscribe: () => () => undefined,
    ensureReady: mocks.ensureReady,
    setMuted: vi.fn(),
  },
}));

import { CompanionCinemaPlayer } from "./CompanionCinemaPlayer";

describe("CompanionCinemaPlayer", () => {
  beforeEach(() => {
    mocks.reveal.mockReset();
    mocks.medium.mockReset();
    mocks.success.mockReset();
    mocks.ensureReady.mockResolvedValue(undefined);
    mocks.play.mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(mocks.play);
  });

  it("plays with haptics and holds the earned Hunt relic after the final frame", async () => {
    const onOpenChange = vi.fn();
    const onFinished = vi.fn();
    mocks.reveal.mockResolvedValue({
      eventId: "event-1",
      status: "revealed",
      ready: true,
      eventType: "hunt",
      title: "The Hunt",
      revealCopy: "Your companion returned.",
      videoUrl: "https://example.test/hunt.mp4",
      reward: {
        type: "relic",
        title: "Emberbound Fragment",
        description: "A relic from the path beyond.",
      },
    });
    render(
      <CompanionCinemaPlayer
        eventId="event-1"
        open
        onOpenChange={onOpenChange}
        onFinished={onFinished}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /begin with sound/i }));
    expect(mocks.medium).toHaveBeenCalledTimes(1);
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    fireEvent.ended(video!);

    expect(await screen.findByText("Relic recovered")).toBeInTheDocument();
    expect(screen.getByText("Emberbound Fragment")).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("recovers from an expired or failed signed video URL", async () => {
    mocks.reveal.mockResolvedValue({
      eventId: "event-1",
      status: "revealed",
      ready: true,
      eventType: "forge",
      title: "The Forge",
      videoUrl: "https://example.test/expired.mp4",
    });
    render(
      <CompanionCinemaPlayer
        eventId="event-1"
        open
        onOpenChange={vi.fn()}
      />,
    );

    const video = await waitFor(() => {
      const element = document.querySelector("video");
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.error(video);

    expect(await screen.findByText(/secure link/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.reveal).toHaveBeenCalledTimes(2));
  });
});

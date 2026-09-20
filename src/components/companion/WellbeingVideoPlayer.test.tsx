import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WellbeingVideoPlayer } from "./WellbeingVideoPlayer";
const clip = { url: "https://example.com/one.mp4", sourceImageUrl: "one.png", category: "mind" as const };
describe("Three-second companion playback", () => {
  beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());
  it("plays a real inline silent video and returns to the portrait after three seconds", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    const video = screen.getByLabelText("mind companion moment") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", clip.url); expect(video.muted).toBe(true); expect(video).toHaveAttribute("playsinline");
    video.currentTime = 3; fireEvent.timeUpdate(video); expect(onClose).toHaveBeenCalled();
  });
  it("offers a play button when iOS blocks autoplay", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("NotAllowedError"));
    await act(async () => render(<WellbeingVideoPlayer clip={clip} onClose={vi.fn()} />));
    expect(screen.getByRole("button", { name: "Play moment" })).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play moment" })));
    expect(screen.queryByRole("button", { name: "Play moment" })).not.toBeInTheDocument();
  });
  it("closes on background instead of resuming unexpectedly", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
  });
  it("leaves an exit available when playback fails", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    fireEvent.error(screen.getByLabelText("mind companion moment"));
    expect(screen.getByRole("status")).toHaveTextContent("Couldn’t play");
    fireEvent.click(screen.getByRole("button", { name: "Close" })); expect(onClose).toHaveBeenCalled();
  });
});

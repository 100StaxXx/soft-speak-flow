import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WellbeingVideoPlayer } from "./WellbeingVideoPlayer";
const clip = { url: "https://example.com/one.mp4", sourceImageUrl: "one.png", category: "mind" as const };
describe("Seamless companion playback", () => {
  beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
  it("returns to the scene automatically when playback never starts", async () => {
    vi.useFakeTimers();
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => new Promise(() => {}));
    const onClose = vi.fn();
    render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    act(() => vi.advanceTimersByTime(15_000));
    expect(onClose).toHaveBeenCalledWith("failed");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
  it("does not time out while waiting for an explicit autoplay-permission tap", async () => {
    vi.useFakeTimers();
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("NotAllowedError"));
    await act(async () => render(<WellbeingVideoPlayer clip={clip} onClose={vi.fn()} />));
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("button", { name: "Play moment" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("plays all five seconds, settling to the anchor before ending", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    const video = screen.getByLabelText("mind companion moment") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", clip.url); expect(video.muted).toBe(true); expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveStyle({ opacity: "0" });
    expect(screen.getByTestId("wellbeing-video-player")).not.toHaveClass("bg-black");
    fireEvent.playing(video); expect(video).toHaveStyle({ opacity: "1" });
    video.currentTime = 3; fireEvent.timeUpdate(video); expect(onClose).not.toHaveBeenCalled();
    video.currentTime = 4.8; fireEvent.timeUpdate(video);
    expect(video).toHaveStyle({ opacity: "0" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.ended(video); expect(onClose).toHaveBeenCalledWith("ended");
  });
  it("offers a play button when iOS blocks autoplay", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("NotAllowedError"));
    await act(async () => render(<WellbeingVideoPlayer clip={clip} onClose={vi.fn()} />));
    expect(screen.getByRole("button", { name: "Play moment" })).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play moment" })));
    fireEvent.playing(screen.getByLabelText("mind companion moment"));
    expect(screen.queryByRole("button", { name: "Play moment" })).not.toBeInTheDocument();
  });
  it("closes on background instead of resuming unexpectedly", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
  });
  it("exits automatically when playback fails, without an overlay button", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    fireEvent.error(screen.getByLabelText("mind companion moment"));
    expect(onClose).toHaveBeenCalledWith("failed");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
  it("keeps the scene visible while stalled and never shows a black loading surface", () => {
    const { container } = render(<WellbeingVideoPlayer clip={{ ...clip, sceneImageUrl: "scene.jpg" }} onClose={vi.fn()} />);
    fireEvent.load(container.querySelector("img")!);
    const video = screen.getByLabelText("mind companion moment");
    expect(container.querySelector("img")).toHaveAttribute("src", "scene.jpg");
    expect(video).toHaveStyle({ opacity: "0" });
    fireEvent.playing(video); fireEvent.waiting(video);
    expect(video).toHaveStyle({ opacity: "1" });
    expect(container.querySelector("img")).toHaveStyle({ opacity: "1" });
  });
  it("uses a decoded frame callback before revealing video on iOS", () => {
    let decoded!: VideoFrameRequestCallback;
    const callback = vi.fn((fn: VideoFrameRequestCallback) => { decoded = fn; return 1; });
    const { unmount } = render(<WellbeingVideoPlayer clip={clip} onClose={vi.fn()} />);
    const video = screen.getByLabelText("mind companion moment") as HTMLVideoElement;
    video.requestVideoFrameCallback = callback;
    video.cancelVideoFrameCallback = vi.fn();
    fireEvent.playing(video);
    expect(video).toHaveStyle({ opacity: "0" });
    act(() => decoded(0, {} as VideoFrameCallbackMetadata));
    expect(video).toHaveStyle({ opacity: "1" });
    unmount();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
  });
  it("does not restart when the parent callback changes", () => {
    const view = render(<WellbeingVideoPlayer clip={clip} onClose={vi.fn()} />);
    view.rerender(<WellbeingVideoPlayer clip={clip} onClose={vi.fn()} />);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
  it("rejects an old three-second clip instead of cutting it into a five-second moment", () => {
    const onClose = vi.fn(); render(<WellbeingVideoPlayer clip={clip} onClose={onClose} />);
    const video = screen.getByLabelText("mind companion moment");
    Object.defineProperty(video, "duration", { value: 3 });
    fireEvent.loadedMetadata(video);
    expect(onClose).toHaveBeenCalledWith("failed");
    fireEvent.playing(video);
    expect(video).toHaveStyle({ opacity: "0" });
  });
  it("stays quiet if the phone blocks automatic idle playback", async () => {
    const onClose = vi.fn();
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("NotAllowedError"));
    await act(async () => render(<WellbeingVideoPlayer clip={{ ...clip, category: "idle_rest" }} automatic onClose={onClose} />));
    expect(onClose).toHaveBeenCalledWith("blocked");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

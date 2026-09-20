import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionIdleVideos } from "./CompanionIdleVideos";
import { IDLE_VIDEO_CATEGORIES, WELLBEING_PROMPT_VERSION } from "@/shared/companionWellbeing";
const mocks = vi.hoisted(() => ({ user: { id: "user-one" } as { id: string } | null, request: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/services/companionWellbeingVideo", () => ({ requestWellbeingClip: mocks.request }));
const props = { companionId: "one", stage: 1, sourceImageUrl: "portrait.png", active: true };
const ready = IDLE_VIDEO_CATEGORIES.map((category) => ({ category, clip: {
  status: "succeeded", video_url: `${category}.mp4`, scene_image_url: "scene.jpg", prompt_version: WELLBEING_PROMPT_VERSION,
} }));
function setup(seed = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed) client.setQueryData(["companion-idle-clips", WELLBEING_PROMPT_VERSION, "user-one", "one", 1, "portrait.png"], ready);
  const content = (overrides = {}) => <QueryClientProvider client={client}><CompanionIdleVideos {...props} {...overrides} /></QueryClientProvider>;
  return { ...render(content()), content, client };
}
describe("Generated idle rotation", () => {
  beforeEach(() => {
    mocks.user = { id: "user-one" }; vi.clearAllMocks();
    mocks.request.mockResolvedValue({ status: "queued", video_url: null });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("rotates through all four clips with a restful pause and preloads the next", async () => {
    vi.useFakeTimers(); const view = setup();
    for (const category of IDLE_VIDEO_CATEGORIES) {
      const video = screen.getByLabelText(`${category} companion moment`);
      fireEvent.ended(video);
      expect(screen.queryByTestId("wellbeing-video-player")).not.toBeInTheDocument();
      expect(view.container.querySelector('img[src="scene.jpg"]')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(2200); });
    }
    expect(screen.getByLabelText("idle_breathe companion moment")).toBeInTheDocument();
    expect(view.container.querySelector('video[aria-hidden="true"]')).toHaveAttribute("src", "idle_look.mp4");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("keeps the static portrait alone while clips prepare; status reads never generate videos", async () => {
    setup(false);
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(4));
    expect(mocks.request.mock.calls.every(([request]) => request.action === "status")).toBe(true);
    expect(screen.queryByTestId("companion-idle-videos")).not.toBeInTheDocument();
  });
  it("stops playback when hidden, reduced motion is active, or an activity takes priority", () => {
    const view = setup();
    expect(screen.getByTestId("wellbeing-video-player")).toBeInTheDocument();
    view.rerender(view.content({ active: false }));
    expect(screen.queryByTestId("wellbeing-video-player")).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
  it("does not reuse clips across accounts or new portraits", () => {
    const view = setup();
    view.rerender(view.content({ sourceImageUrl: "new-portrait.png" }));
    expect(screen.queryByTestId("wellbeing-video-player")).not.toBeInTheDocument();
    mocks.user = { id: "other-user" }; view.rerender(view.content());
    expect(screen.queryByTestId("wellbeing-video-player")).not.toBeInTheDocument();
  });
  it("stops when the document backgrounds even before the parent visibility signal updates", () => {
    setup();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByTestId("wellbeing-video-player")).not.toBeInTheDocument();
  });
  it("does not switch a playing clip when additional idle jobs finish", async () => {
    vi.useFakeTimers();
    const view = setup();
    const key = ["companion-idle-clips", WELLBEING_PROMPT_VERSION, "user-one", "one", 1, "portrait.png"];
    act(() => view.client.setQueryData(key, ready.slice(0, 2)));
    for (let turn = 0; turn < 3; turn++) {
      fireEvent.ended(screen.getByLabelText(/companion moment$/));
      await act(async () => { vi.advanceTimersByTime(2200); });
    }
    const playing = screen.getByLabelText("idle_look companion moment");
    act(() => view.client.setQueryData(key, ready));
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.getByLabelText("idle_look companion moment")).toBe(playing);
  });
  it("skips a broken clip without producing repeated overlays or paid retries", async () => {
    vi.useFakeTimers(); setup();
    fireEvent.error(screen.getByLabelText("idle_breathe companion moment"));
    await act(async () => { vi.advanceTimersByTime(2200); });
    expect(screen.queryByLabelText("idle_breathe companion moment")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionWellbeing } from "./CompanionWellbeing";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), navigate: vi.fn(), user: { id: "user-1" } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
const props = { companionId: "one", currentStage: 5, sourceImageUrl: "https://example.com/one.png", isVisible: true, prefersReducedMotion: false, onPlay: vi.fn() };
const ready = { data: { clip: { status: "succeeded", video_url: "https://example.com/clip.mp4" } }, error: null };
describe("Optional Mind Body Soul", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.invoke.mockResolvedValue(ready); });
  afterEach(() => vi.useRealTimers());
  it("does nothing on mount and requests only the selected category", async () => {
    render(<CompanionWellbeing {...props} />);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Soul ideas")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Soul" }));
    await waitFor(() => expect(props.onPlay).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenCalledWith("companion-wellbeing-video", { timeout: 20000, body: { action: "prepare", companionId: "one", category: "soul", stage: 5, sourceImageUrl: props.sourceImageUrl, promptVersion: 3 } });
    fireEvent.click(screen.getByRole("button", { name: "Soul" }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(props.onPlay).toHaveBeenCalledTimes(2);
  });
  it("opens the existing planner for confirmation and preserves the selected category", async () => {
    render(<CompanionWellbeing {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Soul" }));
    fireEvent.click(screen.getByRole("button", { name: "Plan: Notice something you appreciate" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/journeys", { state: { journeysCreateQuestRequest: { id: expect.any(String), prefill: { title: "Notice something you appreciate", durationMinutes: 2, category: "soul" } } } });
    await screen.findByText("Play companion moment");
  });
  it("never auto-plays a video that finishes preparing later", async () => {
    vi.useFakeTimers();
    mocks.invoke.mockResolvedValueOnce({ data: { clip: { status: "queued", video_url: null } } }).mockResolvedValue(ready);
    render(<CompanionWellbeing {...props} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mind" })));
    expect(screen.getByText(/Preparing this form/)).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(8000));
    expect(screen.getByText("Play companion moment")).toBeInTheDocument();
    expect(props.onPlay).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.calls[1][1].body.action).toBe("status");
  });
  it("requires explicit Play when reduced motion is enabled", async () => {
    render(<CompanionWellbeing {...props} prefersReducedMotion />);
    fireEvent.click(screen.getByRole("button", { name: "Body" }));
    fireEvent.click(await screen.findByText("Play companion moment"));
    expect(props.onPlay).toHaveBeenCalledTimes(1);
  });
  it("ignores stale responses after the companion changes", async () => {
    let resolve!: (value: typeof ready) => void;
    mocks.invoke.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const view = render(<CompanionWellbeing {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Mind" }));
    view.rerender(<CompanionWellbeing {...props} sourceImageUrl="new.png" currentStage={13} />);
    await act(async () => resolve(ready));
    expect(props.onPlay).not.toHaveBeenCalled();
    expect(screen.queryByText("Play companion moment")).not.toBeInTheDocument();
  });
  it("ignores a pending response when the user navigates away", async () => {
    let resolve!: (value: typeof ready) => void;
    mocks.invoke.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const view = render(<CompanionWellbeing {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Mind" }));
    view.rerender(<CompanionWellbeing {...props} isVisible={false} />);
    await act(async () => resolve(ready));
    view.rerender(<CompanionWellbeing {...props} />);
    expect(props.onPlay).not.toHaveBeenCalled();
  });
  it("leaves activities usable if the video service is unavailable", async () => {
    mocks.invoke.mockResolvedValue({ error: new Error("offline") });
    render(<CompanionWellbeing {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Soul" }));
    expect(await screen.findByText(/Couldn't check video preparation/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Plan:/ })).toHaveLength(3);
  });
  it("does not request any videos before hatching", () => {
    render(<CompanionWellbeing {...props} currentStage={0} />);
    expect(screen.queryByRole("button", { name: "Mind" })).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("shows not-generated and portrait-pending states without a playback error", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { clip: null }, error: null })
      .mockResolvedValueOnce({ data: { clip: { status: "awaiting_portrait", video_url: null } }, error: null });
    render(<CompanionWellbeing {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Soul" }));
    expect(await screen.findByText(/hasn’t been prepared/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare video" }));
    expect(await screen.findByText(/portrait is still preparing/)).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
    expect(props.onPlay).not.toHaveBeenCalled();
  });
});

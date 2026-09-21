import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionVideoPreparation } from "./CompanionVideoPreparation";
const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  companion: { id: "companion-1", current_stage: 1, current_image_url: "portrait-1.png" },
  access: true, request: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useCompanion", () => ({ useCompanion: () => ({ companion: mocks.companion }) }));
vi.mock("@/hooks/useAccessState", () => ({ useAccessState: () => ({ accessState: { has_access: mocks.access }, isLoading: false }) }));
vi.mock("@/services/companionWellbeingVideo", () => ({ requestWellbeingClip: mocks.request }));

describe("Global companion video preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.access = true;
    mocks.companion = { id: "companion-1", current_stage: 1, current_image_url: "portrait-1.png" };
    mocks.request.mockResolvedValue({ status: "queued", video_url: null });
  });
  const setup = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const content = () => <QueryClientProvider client={client}><CompanionVideoPreparation /></QueryClientProvider>;
    return { ...render(content()), content };
  };
  it("prepares all seven clips for existing accounts without a selection", async () => {
    const view = setup();
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(7));
    expect(mocks.request.mock.calls.map(([request]) => request.category)).toEqual(["mind", "body", "soul", "idle_breathe", "idle_look", "idle_rest", "idle_greet"]);
    expect(mocks.request.mock.calls.every(([request]) => request.action === "prepare")).toBe(true);
    view.rerender(view.content());
    expect(mocks.request).toHaveBeenCalledTimes(7);
  });
  it("prepares once per new visual stage, not every XP level", async () => {
    const view = setup();
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(7));
    mocks.companion.current_stage = 2; view.rerender(view.content());
    expect(mocks.request).toHaveBeenCalledTimes(7);
    mocks.companion = { ...mocks.companion, current_stage: 5, current_image_url: "portrait-5.png" };
    view.rerender(view.content());
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(14));
    expect(mocks.request.mock.calls[7][0]).toMatchObject({ stage: 5, sourceImageUrl: "portrait-5.png" });
  });
  it("does not prepare wellbeing clips for an egg or without active access", () => {
    mocks.companion.current_stage = 0;
    const view = setup(); expect(mocks.request).not.toHaveBeenCalled();
    mocks.companion.current_stage = 1; mocks.access = false;
    view.rerender(view.content()); expect(mocks.request).not.toHaveBeenCalled();
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);

  return {
    chain,
    maybeSingle,
    from: vi.fn(() => chain),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    triggerEvent: vi.fn(),
    haptics: {
      light: vi.fn(),
      medium: vi.fn(),
      success: vi.fn(),
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    triggerEvent: mocks.triggerEvent,
  }),
}));

vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));

import { useCompanionInteractions } from "./useCompanionInteractions";

describe("useCompanionInteractions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.from.mockClear();
    mocks.rpc.mockClear();
    mocks.triggerEvent.mockClear();
    mocks.haptics.light.mockClear();
    mocks.haptics.medium.mockClear();
    mocks.haptics.success.mockClear();
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("keeps tap reactions without a daily stage or mood questionnaire", async () => {
    const { result, unmount } = renderHook(() => useCompanionInteractions({
      companionId: "companion-1",
      currentStage: 21,
      prefersReducedMotion: false,
    }));

    act(() => result.current.interact("tap"));
    expect(result.current.bubble?.prompt).toBeNull();
    expect(result.current.bubble?.message).toBeTruthy();
    expect(mocks.haptics.light).toHaveBeenCalledOnce();
    expect(mocks.triggerEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "touch" }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("record_companion_interaction", expect.objectContaining({
        p_companion_id: "companion-1",
        p_kind: "tap",
        p_prompt_key: null,
        p_answer_key: null,
        p_stage: 21,
        p_local_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }));
    });

    expect(
      Object.keys(window.localStorage).some((key) => key.includes("guardian-protect-v1")),
    ).toBe(false);
    unmount();
  });

  it("does not load retired daily answers even if server memory exists", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { answer_key: "focus" }, error: null });
    const { result, unmount } = renderHook(() => useCompanionInteractions({
      companionId: "companion-1",
      currentStage: 21,
      prefersReducedMotion: true,
    }));

    expect(mocks.from).not.toHaveBeenCalled();
    act(() => result.current.interact("tap"));

    expect(result.current.bubble?.prompt).toBeNull();
    expect(result.current.bubble?.message).toBeTruthy();
    unmount();
  });
});

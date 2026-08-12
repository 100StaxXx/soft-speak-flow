import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MainTabVisibilityProvider } from "@/contexts/MainTabVisibilityContext";

type CaptionWord = {
  word: string;
  start: number;
  end: number;
};

type MockPepTalk = {
  id: string;
  for_date: string;
  mentor_slug: string;
  title: string;
  summary: string;
  script: string;
  audio_url: string;
  topic_category: string;
  intensity: string;
  emotional_triggers: string[];
  transcript: CaptionWord[];
};

type InvokeResult = {
  data: unknown;
  error: unknown;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  const audioListeners = new Set<(muted: boolean) => void>();
  const state: {
    todayPepTalk: MockPepTalk | null;
    fallbackPepTalk: MockPepTalk | null;
    syncResponse: InvokeResult | Promise<InvokeResult>;
    generationResponse: InvokeResult | Promise<InvokeResult>;
    profileTimezone: string | null;
    effectiveDate: string;
    dailyPepTalkEqCalls: Array<[string, unknown]>;
    existingPepTalkXpEvent: boolean;
    isTabActive: boolean;
    isGloballyMuted: boolean;
    mentor: {
      id: string;
      slug: string;
      name: string;
      avatar_url: string | null;
      primary_color: string | null;
    };
    pepTalkWallpaper: {
      dateKey: string;
      imageUrl: string;
      background: { src: string; src2x: string };
      mobileObjectPosition: string;
      desktopObjectPosition: string;
      source: "remote";
      assignmentSource: null;
    } | null;
  } = {
    todayPepTalk: null,
    fallbackPepTalk: null,
    syncResponse: Promise.resolve({ data: {}, error: null }),
    generationResponse: Promise.resolve({ data: null, error: null }),
    profileTimezone: "America/Los_Angeles",
    effectiveDate: "2026-02-20",
    dailyPepTalkEqCalls: [],
    existingPepTalkXpEvent: false,
    isTabActive: true,
    isGloballyMuted: false,
    mentor: {
      id: "mentor-1",
      slug: "carmen",
      name: "Carmen",
      avatar_url: null,
      primary_color: "#376f4a",
    },
    pepTalkWallpaper: null,
  };

  const awardPepTalkListenedAsync = vi.fn();
  const checkFirstTimeAchievements = vi.fn();
  const checkPepTalkListeningAchievements = vi.fn();
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  const safePlayMock = vi.fn(async () => true);
  const registerAudioMock = vi.fn();
  const unregisterAudioMock = vi.fn();
  const reportWallpaperRenderError = vi.fn();
  const recordProgress = vi.fn(async () => ({ data: {}, error: null }));
  const updateDailyGuideThread = vi.fn(async () => null);

  const invoke = vi.fn(async (fnName: string) => {
    if (fnName === "sync-daily-pep-talk-transcript") {
      return await state.syncResponse;
    }
    if (fnName === "generate-single-daily-pep-talk") {
      return await state.generationResponse;
    }
    return { data: null, error: null };
  });

  const from = vi.fn((table: string) => {
    const filters = new Map<string, unknown>();
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.set(column, value);
        if (table === "daily_pep_talks") {
          state.dailyPepTalkEqCalls.push([column, value]);
        }
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        if (table === "mentors") {
          return { data: state.mentor, error: null };
        }
        if (table === "daily_pep_talks") {
          return {
            data: filters.has("for_date") ? state.todayPepTalk : state.fallbackPepTalk,
            error: null,
          };
        }
        if (table === "xp_events") {
          return {
            data: state.existingPepTalkXpEvent ? { id: "xp-1" } : null,
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };

    return builder;
  });

  return {
    state,
    awardPepTalkListenedAsync,
    checkFirstTimeAchievements,
    checkPepTalkListeningAchievements,
    toastError,
    toastSuccess,
    safePlayMock,
    registerAudioMock,
    unregisterAudioMock,
    reportWallpaperRenderError,
    recordProgress,
    updateDailyGuideThread,
    audioListeners,
    safeLocalStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        return true;
      },
      removeItem: (key: string) => {
        storage.delete(key);
        return true;
      },
      clear: () => {
        storage.clear();
        return true;
      },
    },
    supabase: {
      from,
      functions: { invoke },
      rpc: recordProgress,
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: mocks.safeLocalStorage,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: { id: "user-1", selected_mentor_id: "mentor-1", timezone: mocks.state.profileTimezone },
  }),
}));

vi.mock("@/hooks/useDailyGuideThread", () => ({
  useDailyGuideThread: () => ({
    thread: null,
    previousThread: null,
    isUpdating: false,
    updateThread: mocks.updateDailyGuideThread,
  }),
}));

vi.mock("@/utils/timezone", () => ({
  getEffectiveDailyDate: () => mocks.state.effectiveDate,
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: "mentor-1",
    status: "ready",
    refreshConnection: vi.fn(),
  }),
}));

vi.mock("@/contexts/WallpaperManifestContext", () => ({
  useResolvedWallpaper: () => mocks.state.pepTalkWallpaper,
  useWallpaperManifest: () => ({
    reportWallpaperRenderError: mocks.reportWallpaperRenderError,
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardPepTalkListenedAsync: mocks.awardPepTalkListenedAsync,
  }),
}));

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkFirstTimeAchievements: mocks.checkFirstTimeAchievements,
    checkPepTalkListeningAchievements: mocks.checkPepTalkListeningAchievements,
  }),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: () => <div data-testid="mock-slider" />,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    dismiss: vi.fn(),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
}));

vi.mock("@/utils/globalAudio", () => ({
  globalAudio: {
    getMuted: () => mocks.state.isGloballyMuted,
    setMuted: (muted: boolean) => {
      mocks.state.isGloballyMuted = muted;
      mocks.audioListeners.forEach((listener) => listener(muted));
    },
    subscribe: (listener: (muted: boolean) => void) => {
      mocks.audioListeners.add(listener);
      return () => {
        mocks.audioListeners.delete(listener);
      };
    },
  },
}));

vi.mock("@/utils/iosAudio", () => ({
  isIOS: false,
  createIOSOptimizedAudio: (src?: string) => {
    const audio = document.createElement("audio");
    if (src) {
      audio.src = src;
    }
    audio.preload = "auto";
    (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    (audio as HTMLAudioElement & { "webkit-playsinline"?: boolean })["webkit-playsinline"] = true;
    return audio;
  },
  iosAudioManager: {
    registerAudio: mocks.registerAudioMock,
    unregisterAudio: mocks.unregisterAudioMock,
  },
  safePlay: mocks.safePlayMock,
}));

import { TodaysPepTalk } from "./TodaysPepTalk";

function makePepTalk(overrides: Partial<MockPepTalk> = {}): MockPepTalk {
  return {
    id: "pep-talk-1",
    for_date: "2026-02-20",
    mentor_slug: "carmen",
    title: "Execute Your Vision",
    summary: "Take strategic action and build momentum.",
    script: "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24 word25",
    audio_url: "https://example.com/audio.mp3",
    topic_category: "focus",
    intensity: "high",
    emotional_triggers: ["drive"],
    transcript: [],
    ...overrides,
  };
}

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MainTabVisibilityProvider isTabActive={mocks.state.isTabActive}>
          <TodaysPepTalk />
        </MainTabVisibilityProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return {
    queryClient,
    ...view,
    rerenderComponent: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MainTabVisibilityProvider isTabActive={mocks.state.isTabActive}>
              <TodaysPepTalk />
            </MainTabVisibilityProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
  };
}

describe("TodaysPepTalk transcript expand behavior", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.safeLocalStorage.clear();
    mocks.awardPepTalkListenedAsync.mockReset();
    mocks.checkFirstTimeAchievements.mockReset();
    mocks.checkPepTalkListeningAchievements.mockReset();
    mocks.awardPepTalkListenedAsync.mockResolvedValue({
      xpAwarded: 8,
      duplicate: false,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
    });
    mocks.toastError.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.safePlayMock.mockClear();
    mocks.registerAudioMock.mockClear();
    mocks.unregisterAudioMock.mockClear();
    mocks.reportWallpaperRenderError.mockClear();
    mocks.recordProgress.mockClear();
    mocks.updateDailyGuideThread.mockClear();
    mocks.supabase.from.mockClear();
    mocks.supabase.functions.invoke.mockClear();
    mocks.state.syncResponse = Promise.resolve({ data: {}, error: null });
    mocks.state.generationResponse = Promise.resolve({ data: null, error: null });
    mocks.state.todayPepTalk = makePepTalk();
    mocks.state.fallbackPepTalk = makePepTalk({
      id: "pep-talk-fallback",
      for_date: "2026-02-19",
      title: "Fallback Message",
    });
    mocks.state.profileTimezone = "America/Los_Angeles";
    mocks.state.effectiveDate = "2026-02-20";
    mocks.state.dailyPepTalkEqCalls = [];
    mocks.state.existingPepTalkXpEvent = false;
    mocks.state.isTabActive = true;
    mocks.state.isGloballyMuted = false;
    mocks.state.mentor = {
      id: "mentor-1",
      slug: "carmen",
      name: "Carmen",
      avatar_url: null,
      primary_color: "#376f4a",
    };
    mocks.state.pepTalkWallpaper = null;
    mocks.audioListeners.clear();
  });

  it("queries the effective local date before the 2 AM reset", async () => {
    mocks.state.effectiveDate = "2026-03-09";
    mocks.state.todayPepTalk = makePepTalk({ for_date: "2026-03-09" });

    renderComponent();

    await waitFor(() => {
      expect(mocks.state.dailyPepTalkEqCalls).toContainEqual(["for_date", "2026-03-09"]);
    });

    expect(screen.getByText("Execute Your Vision")).toBeInTheDocument();
  });

  it("automatically records the received daily encouragement", async () => {
    renderComponent();

    await screen.findByText("Execute Your Vision");
    await waitFor(() => {
      expect(mocks.recordProgress).toHaveBeenCalledWith("record_daily_encouragement_progress", {
        p_daily_pep_talk_id: "pep-talk-1",
        p_event: "opened",
        p_progress: 0,
      });
    });
    expect(screen.getByRole("button", { name: /past encouragements/i })).toBeInTheDocument();
  });

  it("makes the encouragement feel Guide-led and carries the chosen focus forward", async () => {
    const focusEvent = vi.fn();
    window.addEventListener("daily-guide-focus-selected", focusEvent);

    try {
      renderComponent();

      expect(await screen.findByText("A word from Carmen")).toBeInTheDocument();
      expect(screen.getByText("Carmen asks")).toBeInTheDocument();
      expect(screen.getByText("Where would a little more direction help today?")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clarity" }));

      await waitFor(() => {
        expect(mocks.updateDailyGuideThread).toHaveBeenCalledWith(expect.objectContaining({
          mentor_id: "mentor-1",
          mentor_name: "Carmen",
          focus_option_id: "clarity",
          focus_label: "Clarity",
          focus_category: "Mind",
        }));
      });
      expect(focusEvent).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("daily-guide-focus-selected", focusEvent);
    }
  });

  it("resolves legacy mentor slugs before querying and refreshing daily pep talks", async () => {
    mocks.state.mentor = {
      id: "mentor-rival",
      slug: "eli",
      name: "The Rival",
      avatar_url: null,
      primary_color: "#375b8b",
    };
    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = makePepTalk({
      mentor_slug: "rival",
      title: "Prove It Today",
      for_date: "2026-03-08",
    });
    mocks.state.generationResponse = Promise.resolve({
      data: { pepTalk: makePepTalk({ mentor_slug: "rival", title: "Fresh Rival Message" }) },
      error: null,
    });

    renderComponent();

    expect(await screen.findByText("Prove It Today")).toBeInTheDocument();
    expect(mocks.state.dailyPepTalkEqCalls).toContainEqual(["mentor_slug", "rival"]);

    fireEvent.click(await screen.findByRole("button", { name: /refresh today's/i }));

    await waitFor(() => {
      expect(mocks.supabase.functions.invoke).toHaveBeenCalledWith("generate-single-daily-pep-talk", {
        body: { mentorSlug: "rival", forceRegenerate: true },
      });
    });
  });

  it("updates the daily query when the effective date changes while mounted", async () => {
    mocks.state.effectiveDate = "2026-04-25";
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-apr-25",
      for_date: "2026-04-25",
      title: "Last Week's Message",
    });

    renderComponent();

    expect(await screen.findByText("Last Week's Message")).toBeInTheDocument();
    expect(mocks.state.dailyPepTalkEqCalls).toContainEqual(["for_date", "2026-04-25"]);

    mocks.state.dailyPepTalkEqCalls = [];
    mocks.state.effectiveDate = "2026-05-02";
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-may-02",
      for_date: "2026-05-02",
      title: "Fresh Today's Message",
    });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(mocks.state.dailyPepTalkEqCalls).toContainEqual(["for_date", "2026-05-02"]);
    });
    expect(await screen.findByText("Fresh Today's Message")).toBeInTheDocument();
  });

  it("uses the Graceward card shell while loading", () => {
    renderComponent();

    const shell = screen.getByTestId("pep-talk-shell");

    expect(shell).toHaveClass("bg-card/[0.86]");
    expect(shell).toHaveClass("backdrop-blur-xl");
    expect(shell).toHaveClass("shadow-sm");
  });

  it("uses the Graceward card shell for the empty state", async () => {
    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = null;

    renderComponent();

    await screen.findByText("No daily encouragement is available yet");

    const shell = screen.getByTestId("pep-talk-shell");

    expect(shell).toHaveClass("bg-card/[0.86]");
    expect(shell).toHaveClass("backdrop-blur-xl");
    expect(shell).toHaveClass("shadow-sm");
    expect(shell.querySelector(".from-primary\\/10")).toBeNull();
  });

  it("uses the Graceward card shell for the loaded state while keeping the inner content panel", async () => {
    renderComponent();

    await screen.findByText("Execute Your Vision");

    const shell = screen.getByTestId("pep-talk-shell");

    expect(shell).toHaveClass("bg-card/[0.86]");
    expect(shell).toHaveClass("backdrop-blur-xl");
    expect(shell).toHaveClass("shadow-sm");
    expect(shell.querySelector(".animate-gradient-shift")).toBeNull();
    expect(shell.querySelector(".from-card\\/90")).not.toBeNull();
  });

  it("renders a remote pep talk backdrop when a live pep talk wallpaper exists", async () => {
    mocks.state.pepTalkWallpaper = {
      dateKey: "2026-02-20",
      imageUrl: "https://example.com/pep-talk-wallpaper.png",
      background: {
        src: "https://example.com/pep-talk-wallpaper.png",
        src2x: "https://example.com/pep-talk-wallpaper@2x.png",
      },
      mobileObjectPosition: "50% 48%",
      desktopObjectPosition: "50% 52%",
      source: "remote",
      assignmentSource: null,
    };

    renderComponent();

    await screen.findByText("Execute Your Vision");

    expect(screen.getByTestId("pep-talk-section-backdrop")).toHaveAttribute("data-pep-talk-backdrop", "remote");
    expect(screen.getByTestId("pep-talk-backdrop-image-mobile")).toHaveAttribute(
      "src",
      "https://example.com/pep-talk-wallpaper.png",
    );
    expect(screen.getByTestId("pep-talk-backdrop-image-desktop")).toHaveAttribute(
      "src",
      "https://example.com/pep-talk-wallpaper.png",
    );
  });

  it("uses the section gradient fallback when no pep talk wallpaper is available", async () => {
    renderComponent();

    await screen.findByText("Execute Your Vision");

    expect(screen.getByTestId("pep-talk-section-backdrop")).toHaveAttribute("data-pep-talk-backdrop", "fallback");
    expect(screen.queryByTestId("pep-talk-backdrop-image-mobile")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pep-talk-backdrop-image-desktop")).not.toBeInTheDocument();
  });

  it("shows full raw script when transcript array is empty", async () => {
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-empty",
      transcript: [],
    });

    renderComponent();

    await screen.findByText("Show Full Transcript");
    expect(screen.queryByText(/word21/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show full transcript/i }));

    expect(await screen.findByText(/word21/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("shows timed transcript words when word-level transcript exists", async () => {
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-timed",
      script: "SCRIPT_FALLBACK_ONLY",
      transcript: [
        { word: "Stay", start: 0, end: 0.5 },
        { word: "Focused", start: 0.5, end: 1.0 },
        { word: "Today", start: 1.0, end: 1.5 },
      ],
    });

    renderComponent();

    await screen.findByText("Show Full Transcript");
    fireEvent.click(screen.getByRole("button", { name: /show full transcript/i }));

    expect(await screen.findByText("Stay")).toBeInTheDocument();
    expect(screen.getByText("Focused")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("SCRIPT_FALLBACK_ONLY")).not.toBeInTheDocument();
    });
  });

  it("re-applies punctuation from script for timed transcript display", async () => {
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-punctuation",
      script: "Focus your gaze on what truly matters. Identify your priorities.",
      transcript: [
        { word: "Focus", start: 0, end: 0.5 },
        { word: "your", start: 0.5, end: 0.8 },
        { word: "gaze", start: 0.8, end: 1.0 },
        { word: "on", start: 1.0, end: 1.2 },
        { word: "what", start: 1.2, end: 1.4 },
        { word: "truly", start: 1.4, end: 1.7 },
        { word: "matters", start: 1.7, end: 2.0 },
        { word: "Identify", start: 2.0, end: 2.4 },
        { word: "your", start: 2.4, end: 2.7 },
        { word: "priorities", start: 2.7, end: 3.1 },
      ],
    });

    renderComponent();

    await screen.findByText("Show Full Transcript");
    fireEvent.click(screen.getByRole("button", { name: /show full transcript/i }));

    const transcriptContainer = await screen.findByTestId("pep-talk-transcript");
    expect(transcriptContainer.textContent).toContain("matters.");
    expect(transcriptContainer.textContent).toContain("priorities.");
  });

  it("returns to preview mode and label after collapsing", async () => {
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-toggle",
      transcript: [],
    });

    renderComponent();

    await screen.findByText("Show Full Transcript");
    fireEvent.click(screen.getByRole("button", { name: /show full transcript/i }));
    expect(await screen.findByText(/word21/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show less/i }));

    expect(await screen.findByRole("button", { name: /show full transcript/i })).toBeInTheDocument();
    expect(screen.queryByText(/word21/)).not.toBeInTheDocument();
  });

  it("keeps legacy scripts available without starting paid transcript repair from the client", async () => {
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-sync-success",
      script: "Original preview text stays intact before transcript expansion.",
      transcript: [],
    });
    renderComponent();

    expect(await screen.findByText(/Original preview text stays intact/i)).toBeInTheDocument();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalledWith(
      "sync-daily-pep-talk-transcript",
      expect.anything(),
    );

    fireEvent.click(await screen.findByRole("button", { name: /show full transcript/i }));
    expect(await screen.findByText(/Original preview text stays intact/i)).toBeInTheDocument();
  });

  it("auto-scrolls transcript container without calling word scrollIntoView", async () => {
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-autoscroll",
      script: "Stay Focused Today",
      transcript: [
        { word: "Stay", start: 0, end: 0.5 },
        { word: "Focused", start: 0.5, end: 1.0 },
        { word: "Today", start: 1.0, end: 1.5 },
      ],
    });

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(16);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewSpy,
    });

    try {
      renderComponent();

      await screen.findByText("Show Full Transcript");
      fireEvent.click(screen.getByRole("button", { name: /show full transcript/i }));

      const transcriptContainer = screen.getByTestId("pep-talk-transcript");
      const scrollToSpy = vi.fn();
      Object.defineProperty(transcriptContainer, "scrollTo", {
        configurable: true,
        writable: true,
        value: scrollToSpy,
      });

      Object.defineProperty(transcriptContainer, "scrollTop", {
        configurable: true,
        writable: true,
        value: 0,
      });
      Object.defineProperty(transcriptContainer, "clientHeight", {
        configurable: true,
        value: 120,
      });
      Object.defineProperty(transcriptContainer, "scrollHeight", {
        configurable: true,
        value: 900,
      });

      const activeWord = screen.getByText("Today");
      Object.defineProperty(activeWord, "offsetTop", {
        configurable: true,
        value: 640,
      });
      Object.defineProperty(activeWord, "offsetHeight", {
        configurable: true,
        value: 24,
      });

      const audio = screen.getByTestId("pep-talk-audio");
      expect(audio).toBeInstanceOf(HTMLAudioElement);
      Object.defineProperty(audio as HTMLAudioElement, "currentTime", {
        configurable: true,
        writable: true,
        value: 1.2,
      });
      Object.defineProperty(audio as HTMLAudioElement, "duration", {
        configurable: true,
        writable: true,
        value: 1.5,
      });

      fireEvent(audio as HTMLAudioElement, new Event("timeupdate"));

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalled();
      });

      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();

      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
      } else {
        delete (HTMLElement.prototype as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("shows backend error text for non-2xx pep talk refresh failures", async () => {
    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = null;
    mocks.state.generationResponse = Promise.resolve({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({ error: "No themes configured for mentor: solace" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    renderComponent();

    const refreshButton = await screen.findByRole("button", { name: /prepare today's encouragement/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mocks.supabase.functions.invoke).toHaveBeenCalledWith("generate-single-daily-pep-talk", {
        body: { mentorSlug: "icon", forceRegenerate: true },
      });
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled();
      expect(mocks.toastError.mock.calls.at(-1)?.[0]).toBe("No themes configured for mentor: solace");
    });
  });

  it("does not leave fallback refreshes in the recording state after rate limits", async () => {
    const generationDeferred = createDeferred<InvokeResult>();
    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = makePepTalk({
      id: "pep-talk-fallback",
      for_date: "2026-02-19",
      title: "Yesterday's Message",
    });
    mocks.state.generationResponse = generationDeferred.promise;
    const wasRecordingWhenToastFired: boolean[] = [];
    mocks.toastError.mockImplementationOnce(() => {
      wasRecordingWhenToastFired.push(screen.queryByText("Recording...") !== null);
    });

    renderComponent();

    fireEvent.click(await screen.findByRole("button", { name: /refresh today's/i }));

    expect(await screen.findByText("Recording...", {}, { timeout: 2_000 })).toBeInTheDocument();

    await act(async () => {
      generationDeferred.resolve({
        data: null,
        error: {
          name: "FunctionsHttpError",
          message: "Edge Function returned a non-2xx status code",
          context: new Response(
            JSON.stringify({ error: "Rate limit exceeded", retryAfterSeconds: 45 }),
            {
              status: 429,
              headers: { "Content-Type": "application/json" },
            },
          ),
        },
      });
      await generationDeferred.promise;
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled();
      expect(mocks.toastError.mock.calls.at(-1)?.[0]).toContain("45 seconds");
      expect(wasRecordingWhenToastFired).toEqual([false]);
    });

    expect(screen.queryByText("Recording...")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /refresh today's/i })).toBeEnabled();
  });

  it("forces generation when refreshing from a fallback even if today's pep talk appears", async () => {
    const oldFallback = makePepTalk({
      id: "pep-talk-old-fallback",
      for_date: "2026-04-25",
      title: "Old Fallback Message",
    });
    const freshToday = makePepTalk({
      id: "pep-talk-fresh-today",
      for_date: "2026-05-02",
      title: "Fresh Today's Message",
    });

    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = oldFallback;
    mocks.state.generationResponse = Promise.resolve({
      data: { pepTalk: freshToday },
      error: null,
    });

    renderComponent();

    expect(await screen.findByText("Old Fallback Message")).toBeInTheDocument();

    mocks.state.todayPepTalk = freshToday;
    fireEvent.click(await screen.findByRole("button", { name: /refresh today's/i }));

    expect(await screen.findByText("Fresh Today's Message")).toBeInTheDocument();

    const generationCalls = mocks.supabase.functions.invoke.mock.calls.filter(
      ([functionName]) => functionName === "generate-single-daily-pep-talk",
    );
    expect(generationCalls).toEqual([
      [
        "generate-single-daily-pep-talk",
        { body: { mentorSlug: "icon", forceRegenerate: true } },
      ],
    ]);
  });

  it("refetches when the mentor tab becomes active again", async () => {
    const rendered = renderComponent();

    expect(await screen.findByText("Execute Your Vision")).toBeInTheDocument();

    mocks.state.isTabActive = false;
    mocks.state.todayPepTalk = makePepTalk({
      id: "pep-talk-2",
      title: "Return to the Path",
    });
    rendered.rerenderComponent();

    expect(screen.queryByText("Return to the Path")).not.toBeInTheDocument();

    mocks.state.isTabActive = true;
    rendered.rerenderComponent();

    expect(await screen.findByText("Return to the Path")).toBeInTheDocument();
  });

  it("reloads server state after an interrupted refresh and tab return", async () => {
    const generationDeferred = createDeferred<InvokeResult>();
    const oldFallback = makePepTalk({
      id: "pep-talk-old-fallback",
      for_date: "2026-02-19",
      title: "Yesterday's Message",
    });
    const generatedLocal = makePepTalk({
      id: "pep-talk-generated",
      title: "Local Refresh Result",
    });
    const freshServer = makePepTalk({
      id: "pep-talk-fresh-server",
      title: "Fresh Server Result",
    });

    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = oldFallback;
    mocks.state.generationResponse = generationDeferred.promise;

    const rendered = renderComponent();

    expect(await screen.findByText("Yesterday's Message")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /refresh today's/i }));

    mocks.state.isTabActive = false;
    mocks.state.todayPepTalk = freshServer;
    rendered.rerenderComponent();

    await act(async () => {
      generationDeferred.resolve({
        data: { pepTalk: generatedLocal },
        error: null,
      });
      await generationDeferred.promise;
    });

    mocks.state.isTabActive = true;
    rendered.rerenderComponent();

    expect(await screen.findByText("Fresh Server Result")).toBeInTheDocument();
  });

  it("ignores duplicate refresh taps while a pep talk request is already running", async () => {
    const generationDeferred = createDeferred<InvokeResult>();
    const oldFallback = makePepTalk({
      id: "pep-talk-old-fallback",
      for_date: "2026-02-19",
      title: "Yesterday's Message",
    });
    const generatedPepTalk = makePepTalk({
      id: "pep-talk-generated",
      title: "Refreshed Message",
    });

    mocks.state.todayPepTalk = null;
    mocks.state.fallbackPepTalk = oldFallback;
    mocks.state.generationResponse = generationDeferred.promise;

    renderComponent();

    const refreshButton = await screen.findByRole("button", { name: /refresh today's/i });
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);

    await waitFor(() => {
      const generationCalls = mocks.supabase.functions.invoke.mock.calls.filter(
        ([functionName]) => functionName === "generate-single-daily-pep-talk",
      );
      expect(generationCalls).toHaveLength(1);
    });

    mocks.state.todayPepTalk = generatedPepTalk;

    await act(async () => {
      generationDeferred.resolve({
        data: { pepTalk: generatedPepTalk },
        error: null,
      });
      await generationDeferred.promise;
    });

    expect(await screen.findByText("Refreshed Message")).toBeInTheDocument();
  });

  it("keeps pep talk XP retriable after a failed award attempt", async () => {
    mocks.awardPepTalkListenedAsync
      .mockRejectedValueOnce(new Error("XP temporarily unavailable"))
      .mockResolvedValueOnce({
        xpAwarded: 8,
        duplicate: false,
        capApplied: false,
        nextThreshold: 120,
        shouldEvolve: false,
      });

    renderComponent();

    await screen.findByText("Execute Your Vision");

    const audio = screen.getByTestId("pep-talk-audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", {
      configurable: true,
      writable: true,
      value: 100,
    });
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 80,
    });

    fireEvent(audio, new Event("timeupdate"));

    await waitFor(() => {
      expect(mocks.awardPepTalkListenedAsync).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 90,
    });
    fireEvent(audio, new Event("timeupdate"));

    await waitFor(() => {
      expect(mocks.awardPepTalkListenedAsync).toHaveBeenCalledTimes(2);
    });

    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 95,
    });
    fireEvent(audio, new Event("timeupdate"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.awardPepTalkListenedAsync).toHaveBeenCalledTimes(2);
  });

  it("awards XP on ended when the last threshold-crossing timeupdate is missed", async () => {
    renderComponent();

    await screen.findByText("Execute Your Vision");

    const audio = screen.getByTestId("pep-talk-audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", {
      configurable: true,
      writable: true,
      value: 100,
    });
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 100,
    });

    fireEvent(audio, new Event("ended"));

    await waitFor(() => {
      expect(mocks.awardPepTalkListenedAsync).toHaveBeenCalledWith({ pep_talk_id: "pep-talk-1" });
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

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

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  const state: {
    dailyPepTalk: MockPepTalk | null;
    syncResponse: { data: unknown; error: unknown };
    generationResponse: { data: unknown; error: unknown };
  } = {
    dailyPepTalk: null,
    syncResponse: { data: {}, error: null },
    generationResponse: { data: null, error: null },
  };

  const awardPepTalkListened = vi.fn();
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  const invoke = vi.fn(async (fnName: string) => {
    if (fnName === "sync-daily-pep-talk-transcript") {
      return state.syncResponse;
    }
    if (fnName === "generate-single-daily-pep-talk") {
      return state.generationResponse;
    }
    return { data: null, error: null };
  });

  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        if (table === "mentors") {
          return { data: { slug: "carmen", name: "Carmen" }, error: null };
        }
        if (table === "daily_pep_talks") {
          return { data: state.dailyPepTalk, error: null };
        }
        if (table === "xp_events") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }),
    };

    return builder;
  });

  return {
    state,
    awardPepTalkListened,
    toastError,
    toastSuccess,
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
    profile: { id: "user-1", selected_mentor_id: "mentor-1" },
  }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => ({
    name: "Carmen",
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardPepTalkListened: mocks.awardPepTalkListened,
  }),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: () => <div data-testid="mock-slider" />,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
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
  return render(
    <MemoryRouter>
      <TodaysPepTalk />
    </MemoryRouter>,
  );
}

describe("TodaysPepTalk transcript expand behavior", () => {
  beforeEach(() => {
    mocks.safeLocalStorage.clear();
    mocks.awardPepTalkListened.mockClear();
    mocks.toastError.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.supabase.from.mockClear();
    mocks.supabase.functions.invoke.mockClear();
    mocks.state.syncResponse = { data: {}, error: null };
    mocks.state.generationResponse = { data: null, error: null };
    mocks.state.dailyPepTalk = makePepTalk();
  });

  it("shows full raw script when transcript array is empty", async () => {
    mocks.state.dailyPepTalk = makePepTalk({
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
    mocks.state.dailyPepTalk = makePepTalk({
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
    mocks.state.dailyPepTalk = makePepTalk({
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
    mocks.state.dailyPepTalk = makePepTalk({
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

  it("applies timed transcript returned by background sync without regressions", async () => {
    mocks.state.dailyPepTalk = makePepTalk({
      id: "pep-talk-sync-success",
      script: "INITIAL_SCRIPT_TEXT",
      transcript: [],
    });
    mocks.state.syncResponse = {
      data: {
        script: "SYNCED_SCRIPT_TEXT",
        transcript: [
          { word: "SYNCED", start: 0, end: 0.5 },
          { word: "CAPTION", start: 0.5, end: 1 },
        ],
      },
      error: null,
    };

    renderComponent();

    await waitFor(() => {
      expect(mocks.supabase.functions.invoke).toHaveBeenCalledWith("sync-daily-pep-talk-transcript", {
        body: { id: "pep-talk-sync-success" },
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: /show full transcript/i }));

    expect(await screen.findByText("SYNCED")).toBeInTheDocument();
    expect(screen.getByText("CAPTION")).toBeInTheDocument();
    expect(screen.queryByText("INITIAL_SCRIPT_TEXT")).not.toBeInTheDocument();
  });

  it("auto-scrolls transcript container without calling word scrollIntoView", async () => {
    mocks.state.dailyPepTalk = makePepTalk({
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

      const audio = document.querySelector("audio");
      expect(audio).toBeInstanceOf(HTMLAudioElement);
      Object.defineProperty(audio as HTMLAudioElement, "currentTime", {
        configurable: true,
        writable: true,
        value: 1.2,
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
    mocks.state.dailyPepTalk = null;
    mocks.state.generationResponse = {
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
    };

    renderComponent();

    const refreshButton = await screen.findByRole("button", { name: /prepare today's pep talk/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mocks.supabase.functions.invoke).toHaveBeenCalledWith("generate-single-daily-pep-talk", {
        body: { mentorSlug: "carmen" },
      });
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("No themes configured for mentor: solace");
    });
  });
});

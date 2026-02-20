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
  } = {
    dailyPepTalk: null,
    syncResponse: { data: {}, error: null },
  };

  const awardPepTalkListened = vi.fn();
  const invoke = vi.fn(async (fnName: string) => {
    if (fnName === "sync-daily-pep-talk-transcript") {
      return state.syncResponse;
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
    mocks.supabase.from.mockClear();
    mocks.supabase.functions.invoke.mockClear();
    mocks.state.syncResponse = { data: {}, error: null };
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
});

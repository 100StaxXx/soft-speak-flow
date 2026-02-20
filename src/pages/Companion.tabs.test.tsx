import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MainTabVisibilityProvider } from "@/contexts/MainTabVisibilityContext";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    current_xp: 120,
    current_stage: 3,
  },
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn().mockResolvedValue(undefined),
  user: { id: "user-1" },
  prefetchQuery: vi.fn().mockResolvedValue(undefined),
  focusMountCount: 0,
  navigate: vi.fn(),
  isTabActive: true,
  useCompanionCalls: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    prefetchQuery: mocks.prefetchQuery,
  }),
}));

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");

  interface TabsContextValue {
    value?: string;
    onValueChange?: (value: string) => void;
  }

  const TabsContext = React.createContext<TabsContextValue>({});

  const Tabs = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );

  const TabsList = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  );

  const TabsTrigger = ({
    value,
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;

    return (
      <button
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? "active" : "inactive"}
        onClick={(event) => {
          onClick?.(event);
          context.onValueChange?.(value);
        }}
        {...props}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({
    value,
    forceMount,
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { value: string; forceMount?: boolean }) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;
    if (!isActive && !forceMount) return null;

    return (
      <div data-state={isActive ? "active" : "inactive"} hidden={!isActive} {...props}>
        {children}
      </div>
    );
  };

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: (options?: Record<string, unknown>) => {
    mocks.useCompanionCalls.push(options);
    return {
      companion: mocks.companion,
      nextEvolutionXP: 200,
      progressToNext: 60,
      isLoading: mocks.isLoading,
      error: mocks.error,
      refetch: mocks.refetch,
    };
  },
}));

vi.mock("@/hooks/useCompanionStory", () => ({
  getCompanionStoriesAllQueryKey: (companionId?: string) => ["companion-stories-all", companionId],
  fetchCompanionStoriesAll: vi.fn().mockResolvedValue([]),
  useCompanionStory: () => ({
    story: null,
    allStories: [],
    isLoading: false,
    generateStory: {
      mutate: vi.fn(),
    },
  }),
}));

vi.mock("@/hooks/useCompanionPostcards", () => ({
  getCompanionPostcardsQueryKey: (userId?: string) => ["companion-postcards", userId],
  fetchCompanionPostcards: vi.fn().mockResolvedValue([]),
  useCompanionPostcards: () => ({
    postcards: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: "/companion" }),
}));

vi.mock("framer-motion", () => {
  const MotionDiv = ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
    <div {...props}>{children}</div>
  );

  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CompanionErrorBoundary", () => ({
  CompanionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/StarfieldBackground", () => ({
  StarfieldBackground: () => null,
}));

vi.mock("@/components/MentorGuidanceCard", () => ({
  MentorGuidanceCard: () => null,
}));

vi.mock("@/components/ui/parallax-card", () => ({
  ParallaxCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CompanionDisplay", () => ({
  CompanionDisplay: () => <div data-testid="companion-display" />,
}));

vi.mock("@/components/NextEvolutionPreview", () => ({
  NextEvolutionPreview: () => <div data-testid="next-evolution" />,
}));

vi.mock("@/components/XPBreakdown", () => ({
  XPBreakdown: () => <div data-testid="xp-breakdown" />,
}));

vi.mock("@/components/DailyMissions", () => ({
  DailyMissions: () => <div data-testid="daily-missions" />,
}));

vi.mock("@/components/companion/MemoryWhisper", () => ({
  MemoryWhisper: () => null,
}));

vi.mock("@/components/companion/CollectionTab", () => ({
  CollectionTab: () => <div data-testid="collection-tab">Collection content</div>,
}));

vi.mock("@/components/companion/FocusTab", async () => {
  const React = await import("react");
  return {
    FocusTab: () => {
      const [mode, setMode] = React.useState("focus");

      React.useEffect(() => {
        mocks.focusMountCount += 1;
      }, []);

      return (
        <div>
          <div data-testid="focus-mode">{mode}</div>
          <button onClick={() => setMode((previous) => (previous === "focus" ? "resist" : "focus"))}>
            Toggle Focus Mode
          </button>
        </div>
      );
    },
  };
});

import Companion from "@/pages/Companion";

const renderCompanion = (isTabActive = true) =>
  render(
    <MainTabVisibilityProvider isTabActive={isTabActive}>
      <Companion />
    </MainTabVisibilityProvider>,
  );

describe("Companion tabs performance behavior", () => {
  beforeEach(() => {
    mocks.companion = {
      id: "companion-1",
      current_xp: 120,
      current_stage: 3,
    };
    mocks.isLoading = false;
    mocks.error = null;
    mocks.user = { id: "user-1" };
    mocks.prefetchQuery.mockClear();
    mocks.focusMountCount = 0;
    mocks.navigate.mockClear();
    mocks.isTabActive = true;
    mocks.useCompanionCalls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps focus tab content mounted after first visit", async () => {
    renderCompanion();

    fireEvent.click(screen.getByRole("tab", { name: /focus/i }));
    await waitFor(() => {
      expect(screen.getByTestId("focus-mode")).toBeInTheDocument();
    });
    expect(mocks.focusMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: /overview/i }));
    fireEvent.click(screen.getByRole("tab", { name: /focus/i }));

    await waitFor(() => {
      expect(screen.getByTestId("focus-mode")).toBeInTheDocument();
    });
    expect(mocks.focusMountCount).toBe(1);
  });

  it("preserves focus tab local state across tab switches", async () => {
    renderCompanion();

    fireEvent.click(screen.getByRole("tab", { name: /focus/i }));
    expect(screen.getByTestId("focus-mode")).toHaveTextContent("focus");
    expect(mocks.focusMountCount).toBe(1);

    fireEvent.click(screen.getByText("Toggle Focus Mode"));
    expect(screen.getByTestId("focus-mode")).toHaveTextContent("resist");

    fireEvent.click(screen.getByRole("tab", { name: /overview/i }));
    fireEvent.click(screen.getByRole("tab", { name: /focus/i }));

    expect(screen.getByTestId("focus-mode")).toHaveTextContent("resist");
    expect(mocks.focusMountCount).toBe(1);
  });

  it("prefetches resources on idle and on stories/postcards trigger interactions", async () => {
    const originalRequestIdle = (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback;
    const originalCancelIdle = (window as Window & { cancelIdleCallback?: unknown }).cancelIdleCallback;
    (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback = undefined;
    (window as Window & { cancelIdleCallback?: unknown }).cancelIdleCallback = undefined;
    try {
      renderCompanion();
      expect(mocks.prefetchQuery).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(mocks.prefetchQuery).toHaveBeenCalledTimes(2);
      }, { timeout: 1500 });

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(mocks.prefetchQuery).toHaveBeenCalledTimes(2);

      const initialCalls = mocks.prefetchQuery.mock.calls.map(([config]) => config.queryKey);
      expect(initialCalls).toEqual(
        expect.arrayContaining([
          ["companion-stories-all", "companion-1"],
          ["companion-postcards", "user-1"],
        ]),
      );

      fireEvent.focus(screen.getByRole("tab", { name: /stories/i }));
      await waitFor(() => {
        expect(mocks.prefetchQuery).toHaveBeenCalledTimes(3);
      }, { timeout: 1500 });

      fireEvent.pointerDown(screen.getByRole("tab", { name: /postcards/i }));
      await waitFor(() => {
        expect(mocks.prefetchQuery).toHaveBeenCalledTimes(4);
      }, { timeout: 1500 });
    } finally {
      (window as Window & { requestIdleCallback?: unknown }).requestIdleCallback = originalRequestIdle;
      (window as Window & { cancelIdleCallback?: unknown }).cancelIdleCallback = originalCancelIdle;
    }
  });

  it("renders error and no-companion states as expected", () => {
    mocks.error = new Error("Broken load");
    const { rerender } = renderCompanion();

    expect(screen.getByText("Error Loading Companion")).toBeInTheDocument();
    expect(screen.getByText("Broken load")).toBeInTheDocument();

    mocks.error = null;
    mocks.companion = null;
    rerender(
      <MainTabVisibilityProvider isTabActive>
        <Companion />
      </MainTabVisibilityProvider>,
    );

    expect(screen.getByText("No Companion Found")).toBeInTheDocument();
  });

  it("renders loading skeleton while companion data is loading", () => {
    mocks.isLoading = true;
    mocks.companion = null;

    renderCompanion();

    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByText("No Companion Found")).not.toBeInTheDocument();
    expect(screen.queryByText("Error Loading Companion")).not.toBeInTheDocument();
  });

  it("keeps companion settings action clickable", () => {
    renderCompanion();

    fireEvent.click(screen.getByLabelText("Settings"));
    expect(mocks.navigate).toHaveBeenCalledWith("/profile");
  });

  it("disables companion query and idle prefetch while tab is inactive", async () => {
    vi.useFakeTimers();

    renderCompanion(false);

    expect(
      mocks.useCompanionCalls.some((value) => value?.enabled === false),
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.prefetchQuery).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  profile: "balanced" as "reduced" | "balanced" | "enhanced",
  prefersReducedMotion: false,
  triggerEventMock: vi.fn(),
  confettiMock: vi.fn(),
  playEvolutionStartMock: vi.fn(),
  playEvolutionSuccessMock: vi.fn(),
  hapticsLightMock: vi.fn(),
  hapticsMediumMock: vi.fn(),
  hapticsHeavyMock: vi.fn(),
  invokeMock: vi.fn().mockResolvedValue({
    data: { voiceLine: "A brighter form answers your journey." },
    error: null,
  }),
  getMutedMock: vi.fn(() => false),
  audioPlayMock: vi.fn().mockResolvedValue(undefined),
  audioPauseMock: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({
  default: mocks.confettiMock,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const componentCache = new Map<string, React.ForwardRefExoticComponent<Record<string, unknown>>>();

  const createMotionComponent = (tag: string) => {
    const cached = componentCache.get(tag);
    if (cached) return cached;

    const component = React.forwardRef<HTMLElement, {
      children?: ReactNode;
      [key: string]: unknown;
    }>(({ children, ...props }, ref) => {
      const {
        animate: _animate,
        exit: _exit,
        initial: _initial,
        layout: _layout,
        transition: _transition,
        variants: _variants,
        whileHover: _whileHover,
        whileTap: _whileTap,
        ...domProps
      } = props;

      return React.createElement(tag, { ...domProps, ref }, children);
    });

    componentCache.set(tag, component);
    return component;
  };

  const motion = new Proxy({}, {
    get: (_target, key: string) => createMotionComponent(key),
  });

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion,
  };
});

vi.mock("@/utils/haptics", () => ({
  haptics: {
    light: mocks.hapticsLightMock,
    medium: mocks.hapticsMediumMock,
    heavy: mocks.hapticsHeavyMock,
  },
}));

vi.mock("@/utils/soundEffects", () => ({
  playEvolutionStart: mocks.playEvolutionStartMock,
  playEvolutionSuccess: mocks.playEvolutionSuccessMock,
}));

vi.mock("@/utils/globalAudio", () => ({
  globalAudio: {
    getMuted: mocks.getMutedMock,
  },
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: mocks.profile,
    capabilities: {
      allowParallax: true,
      maxParticles: 10,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    },
    signals: {
      prefersReducedMotion: mocks.prefersReducedMotion,
      isLowPowerMode: false,
      isBackgrounded: false,
    },
  }),
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    triggerEvent: mocks.triggerEventMock,
  }),
}));

vi.mock("@/components/companion/motion/CompanionMotionLayer", () => ({
  CompanionMotionLayer: () => <div data-testid="companion-motion-layer" />,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    scope: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

import { CompanionEvolution } from "./CompanionEvolution";

const FULL_SEQUENCE_MS = {
  hold: 800,
  charge: 3200,
  conceal: 600,
  strobe: 900,
  reveal: 2400,
  dismissBuffer: 3000,
} as const;

const REDUCED_SEQUENCE_MS = {
  hold: 150,
  charge: 280,
  conceal: 150,
  reveal: 500,
  dismissBuffer: 120,
} as const;

class MockPreloadImage {
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private currentSrc = "";

  set src(value: string) {
    this.currentSrc = value;
    setTimeout(() => {
      if (value.includes("broken")) {
        this.onerror?.(new Event("error"));
        return;
      }
      this.onload?.(new Event("load"));
    }, 0);
  }

  get src() {
    return this.currentSrc;
  }
}

class MockAudio {
  currentTime = 0;
  src = "";

  pause = mocks.audioPauseMock;
  play = mocks.audioPlayMock;

  constructor(src?: string) {
    if (src) {
      this.src = src;
    }
  }
}

const originalImage = globalThis.Image;
const originalAudio = globalThis.Audio;

const flushTimers = async (ms = 0) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
};

const prepareEvolution = async () => {
  await flushTimers();
  await flushTimers();
};

const buildProps = () => ({
  isEvolving: true,
  previousStage: 4,
  newStage: 5,
  previousImageUrl: "https://example.com/stage-4.png",
  newImageUrl: "https://example.com/stage-5.png",
  mentorSlug: "sage",
  userId: "user-1",
  element: "fire",
  onComplete: vi.fn(),
});

describe("CompanionEvolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.profile = "balanced";
    mocks.prefersReducedMotion = false;
    mocks.getMutedMock.mockReturnValue(false);

    globalThis.Image = MockPreloadImage as unknown as typeof Image;
    globalThis.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.Image = originalImage;
    globalThis.Audio = originalAudio;
  });

  it("locks dismissal until the settle beat and dispatches completion events once", async () => {
    const props = buildProps();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("data-phase", "hold");

    fireEvent.click(dialog);
    expect(props.onComplete).not.toHaveBeenCalled();

    await flushTimers(FULL_SEQUENCE_MS.hold);
    expect(dialog).toHaveAttribute("data-phase", "charge");

    await flushTimers(FULL_SEQUENCE_MS.charge);
    expect(dialog).toHaveAttribute("data-phase", "conceal");

    fireEvent.click(dialog);
    expect(props.onComplete).not.toHaveBeenCalled();

    await flushTimers(FULL_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "strobe");
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-enabled", "true");

    await flushTimers(FULL_SEQUENCE_MS.strobe);
    expect(dialog).toHaveAttribute("data-phase", "reveal");
    expect(screen.getByText("Evolved!")).toBeInTheDocument();

    await flushTimers(FULL_SEQUENCE_MS.reveal);
    expect(dialog).toHaveAttribute("data-phase", "settle");

    fireEvent.click(dialog);
    expect(props.onComplete).not.toHaveBeenCalled();

    await flushTimers(FULL_SEQUENCE_MS.dismissBuffer);
    expect(screen.getByText("Tap anywhere to continue")).toBeInTheDocument();

    fireEvent.click(dialog);
    fireEvent.click(dialog);

    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(
      dispatchSpy.mock.calls
        .map(([event]) => event.type)
        .filter((type) =>
          ["companion-evolved", "evolution-complete", "evolution-modal-closed"].includes(type),
        ),
    ).toEqual(["companion-evolved", "evolution-complete", "evolution-modal-closed"]);
  });

  it("falls back to a single-image presentation when previous art fails to preload", async () => {
    const props = buildProps();

    render(
      <CompanionEvolution
        {...props}
        previousImageUrl="https://example.com/broken-previous.png"
      />,
    );
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    const artStage = screen.getByTestId("evolution-art-stage");

    expect(artStage).toHaveAttribute("data-art-presentation", "single");
    expect(artStage).toHaveAttribute("data-strobe-enabled", "false");
    expect(screen.queryByTestId("evolution-previous-art")).not.toBeInTheDocument();
    expect(screen.getByTestId("evolution-reveal-art")).toBeInTheDocument();

    await flushTimers(FULL_SEQUENCE_MS.hold);
    expect(dialog).toHaveAttribute("data-phase", "charge");

    await flushTimers(FULL_SEQUENCE_MS.charge);
    expect(dialog).toHaveAttribute("data-phase", "conceal");

    await flushTimers(FULL_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "reveal");
  });

  it("uses the reduced-motion fast path without convergence particles", async () => {
    mocks.profile = "reduced";
    mocks.prefersReducedMotion = true;
    const props = buildProps();

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-enabled", "false");
    expect(screen.queryByTestId("evolution-convergence-particles")).not.toBeInTheDocument();

    await flushTimers(REDUCED_SEQUENCE_MS.hold);
    expect(dialog).toHaveAttribute("data-phase", "charge");

    await flushTimers(REDUCED_SEQUENCE_MS.charge);
    expect(dialog).toHaveAttribute("data-phase", "conceal");

    await flushTimers(REDUCED_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "reveal");

    await flushTimers(1400);
    fireEvent.click(dialog);

    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(mocks.confettiMock).not.toHaveBeenCalled();
  });

  it("shows hatch visuals during first evolution", async () => {
    render(
      <CompanionEvolution
        {...buildProps()}
        previousStage={0}
        newStage={1}
        previousImageUrl="https://example.com/egg.png"
        newImageUrl="https://example.com/hatchling.png"
      />,
    );
    await prepareEvolution();
    await flushTimers(FULL_SEQUENCE_MS.hold);

    expect(screen.getByTestId("evolution-hatching-overlay")).toBeInTheDocument();
  });

  it("does not show hatch visuals for later evolutions", async () => {
    render(<CompanionEvolution {...buildProps()} />);
    await prepareEvolution();
    await flushTimers(FULL_SEQUENCE_MS.hold);

    expect(screen.queryByTestId("evolution-hatching-overlay")).not.toBeInTheDocument();
  });

  it("uses the silhouette strobe during first evolution when both art states are available", async () => {
    render(
      <CompanionEvolution
        {...buildProps()}
        previousStage={0}
        newStage={1}
        previousImageUrl="https://example.com/egg.png"
        newImageUrl="https://example.com/hatchling.png"
      />,
    );
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-enabled", "true");

    await flushTimers(FULL_SEQUENCE_MS.hold + FULL_SEQUENCE_MS.charge);
    expect(dialog).toHaveAttribute("data-phase", "conceal");

    await flushTimers(FULL_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "strobe");

    await flushTimers(FULL_SEQUENCE_MS.strobe);
    expect(dialog).toHaveAttribute("data-phase", "reveal");
  });

  it("plays animation side effects only once across rerenders", async () => {
    const props = buildProps();
    const { rerender } = render(<CompanionEvolution {...props} />);

    await prepareEvolution();
    await flushTimers(FULL_SEQUENCE_MS.hold);

    expect(mocks.playEvolutionStartMock).toHaveBeenCalledTimes(1);
    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);

    rerender(<CompanionEvolution {...props} />);

    await flushTimers(
      FULL_SEQUENCE_MS.charge +
      FULL_SEQUENCE_MS.conceal +
      FULL_SEQUENCE_MS.strobe +
      FULL_SEQUENCE_MS.reveal,
    );

    expect(mocks.playEvolutionStartMock).toHaveBeenCalledTimes(1);
    expect(mocks.playEvolutionSuccessMock).toHaveBeenCalledTimes(1);
    expect(mocks.triggerEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);
  });
});

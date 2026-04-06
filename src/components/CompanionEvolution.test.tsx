import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  profile: "balanced" as "reduced" | "balanced" | "enhanced",
  prefersReducedMotion: false,
  triggerEventMock: vi.fn(),
  confettiMock: vi.fn(),
  hapticsLightMock: vi.fn(),
  hapticsMediumMock: vi.fn(),
  hapticsHeavyMock: vi.fn(),
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
  conceal: 850,
  strobe: 2920,
  apex: 340,
  reveal: 2400,
  dismissBuffer: 3000,
} as const;

const REDUCED_SEQUENCE_MS = {
  hold: 150,
  charge: 280,
  conceal: 150,
  apex: 0,
  reveal: 500,
  dismissBuffer: 120,
} as const;

const STROBE_BEAT_OFFSETS_MS = [
  0,
  350,
  685,
  1005,
  1305,
  1585,
  1845,
  2085,
  2305,
  2495,
  2660,
  2800,
] as const;
const FULL_DISMISSABLE_SEQUENCE_MS =
  FULL_SEQUENCE_MS.hold
  + FULL_SEQUENCE_MS.charge
  + FULL_SEQUENCE_MS.conceal
  + FULL_SEQUENCE_MS.strobe
  + FULL_SEQUENCE_MS.apex
  + FULL_SEQUENCE_MS.reveal
  + FULL_SEQUENCE_MS.dismissBuffer;

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

const originalImage = globalThis.Image;

const installSilentEvolutionAudioGuards = () => {
  const originalAudio = globalThis.Audio;
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = (
    window as typeof window & { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;

  const audioConstructorMock = vi.fn(() => ({
    pause: vi.fn(),
    play: vi.fn(),
  }));
  const audioContextConstructorMock = vi.fn(() => ({
    createGain: vi.fn(),
    createOscillator: vi.fn(),
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    state: "running",
  }));

  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: audioConstructorMock as unknown as typeof Audio,
    writable: true,
  });
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: audioContextConstructorMock as unknown as typeof AudioContext,
    writable: true,
  });
  Object.defineProperty(window, "webkitAudioContext", {
    configurable: true,
    value: audioContextConstructorMock as unknown as typeof AudioContext,
    writable: true,
  });

  const restoreProperty = <K extends "Audio" | "AudioContext">(
    target: typeof globalThis | typeof window,
    key: K | "webkitAudioContext",
    value: unknown,
  ) => {
    if (typeof value === "undefined") {
      delete (target as Record<string, unknown>)[key];
      return;
    }

    Object.defineProperty(target, key, {
      configurable: true,
      value,
      writable: true,
    });
  };

  return {
    audioConstructorMock,
    audioContextConstructorMock,
    restore: () => {
      restoreProperty(globalThis, "Audio", originalAudio);
      restoreProperty(window, "AudioContext", originalAudioContext);
      restoreProperty(window, "webkitAudioContext", originalWebkitAudioContext);
    },
  };
};

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
  element: "fire",
  onComplete: vi.fn(),
});

describe("CompanionEvolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.profile = "balanced";
    mocks.prefersReducedMotion = false;

    globalThis.Image = MockPreloadImage as unknown as typeof Image;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.Image = originalImage;
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
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-beat", "0");
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-target", "previous");

    await flushTimers(FULL_SEQUENCE_MS.strobe);
    expect(dialog).toHaveAttribute("data-phase", "apex");
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-beat", "11");
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-target", "next");

    await flushTimers(FULL_SEQUENCE_MS.apex);
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
    expect(artStage).toHaveAttribute("data-strobe-beat", "-1");
    expect(artStage).toHaveAttribute("data-strobe-target", "none");
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
    const artStage = screen.getByTestId("evolution-art-stage");
    expect(dialog).toHaveAttribute("data-reduced-motion", "true");
    expect(artStage).toHaveAttribute("data-strobe-enabled", "false");
    expect(artStage).toHaveAttribute("data-strobe-beat", "-1");
    expect(artStage).toHaveAttribute("data-strobe-target", "none");
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
    expect(mocks.hapticsMediumMock).not.toHaveBeenCalled();
  });

  it("stays silent during the first hatch evolution while keeping haptics", async () => {
    const props = buildProps();
    const { audioConstructorMock, audioContextConstructorMock, restore } = installSilentEvolutionAudioGuards();

    try {
      render(
        <CompanionEvolution
          {...props}
          previousStage={0}
          newStage={1}
          previousImageUrl="https://example.com/egg.png"
          newImageUrl="https://example.com/hatchling.png"
        />,
      );
      await prepareEvolution();

      const dialog = screen.getByRole("alertdialog");
      await flushTimers(FULL_DISMISSABLE_SEQUENCE_MS);
      expect(screen.getByText("Tap anywhere to continue")).toBeInTheDocument();

      fireEvent.click(dialog);

      expect(props.onComplete).toHaveBeenCalledTimes(1);
      expect(audioConstructorMock).not.toHaveBeenCalled();
      expect(audioContextConstructorMock).not.toHaveBeenCalled();
      expect(mocks.hapticsLightMock).toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("stays silent during later evolution cinematics while keeping haptics", async () => {
    const props = buildProps();
    const { audioConstructorMock, audioContextConstructorMock, restore } = installSilentEvolutionAudioGuards();

    try {
      render(<CompanionEvolution {...props} />);
      await prepareEvolution();

      const dialog = screen.getByRole("alertdialog");
      await flushTimers(FULL_DISMISSABLE_SEQUENCE_MS);
      expect(screen.getByText("Tap anywhere to continue")).toBeInTheDocument();

      fireEvent.click(dialog);

      expect(props.onComplete).toHaveBeenCalledTimes(1);
      expect(audioConstructorMock).not.toHaveBeenCalled();
      expect(audioContextConstructorMock).not.toHaveBeenCalled();
      expect(mocks.hapticsLightMock).toHaveBeenCalled();
    } finally {
      restore();
    }
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

  it("uses the cinematic barrage and apex during first evolution when both art states are available", async () => {
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
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-target", "previous");

    await flushTimers(FULL_SEQUENCE_MS.strobe);
    expect(dialog).toHaveAttribute("data-phase", "apex");

    await flushTimers(FULL_SEQUENCE_MS.apex);
    expect(dialog).toHaveAttribute("data-phase", "reveal");
  });

  it("runs a deterministic slower 12-beat barrage before the apex", async () => {
    render(<CompanionEvolution {...buildProps()} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    const artStage = screen.getByTestId("evolution-art-stage");
    const gaps = STROBE_BEAT_OFFSETS_MS.slice(1).map((offset, index) => offset - STROBE_BEAT_OFFSETS_MS[index]);

    expect(gaps[0]).toBeGreaterThan(gaps[gaps.length - 1]);

    await flushTimers(FULL_SEQUENCE_MS.hold + FULL_SEQUENCE_MS.charge + FULL_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "strobe");
    expect(artStage).toHaveAttribute("data-strobe-beat", "0");
    expect(artStage).toHaveAttribute("data-strobe-target", "previous");

    let elapsed = 0;
    for (const [index, offset] of STROBE_BEAT_OFFSETS_MS.slice(1).entries()) {
      await flushTimers(offset - elapsed);
      elapsed = offset;

      const beatIndex = index + 1;
      const expectedTarget = beatIndex % 2 === 0 ? "previous" : "next";
      expect(dialog).toHaveAttribute("data-phase", "strobe");
      expect(artStage).toHaveAttribute("data-strobe-beat", String(beatIndex));
      expect(artStage).toHaveAttribute("data-strobe-target", expectedTarget);
    }

    await flushTimers(FULL_SEQUENCE_MS.strobe - elapsed);
    expect(dialog).toHaveAttribute("data-phase", "apex");
    expect(artStage).toHaveAttribute("data-strobe-beat", "11");
    expect(artStage).toHaveAttribute("data-strobe-target", "next");
  });

  it("syncs haptics to the cinematic barrage, apex, and reveal", async () => {
    render(<CompanionEvolution {...buildProps()} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");

    await flushTimers(FULL_SEQUENCE_MS.hold);
    expect(mocks.hapticsLightMock).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute("data-phase", "charge");

    await flushTimers(FULL_SEQUENCE_MS.charge);
    expect(mocks.hapticsHeavyMock).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute("data-phase", "conceal");

    await flushTimers(FULL_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "strobe");

    await flushTimers(FULL_SEQUENCE_MS.strobe - 1);
    expect(dialog).toHaveAttribute("data-phase", "strobe");
    expect(mocks.hapticsMediumMock).toHaveBeenCalledTimes(3);
    expect(mocks.hapticsHeavyMock).toHaveBeenCalledTimes(1);

    await flushTimers(1);
    expect(dialog).toHaveAttribute("data-phase", "apex");
    expect(mocks.hapticsHeavyMock).toHaveBeenCalledTimes(2);

    await flushTimers(FULL_SEQUENCE_MS.apex);
    expect(dialog).toHaveAttribute("data-phase", "reveal");
    expect(mocks.hapticsMediumMock).toHaveBeenCalledTimes(4);
  });

  it("still allows emergency exit during the longer cinematic sequence", async () => {
    const props = buildProps();
    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    await flushTimers(15_000);

    fireEvent.click(screen.getByRole("button", { name: "Close evolution modal" }));
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });

  it("plays animation side effects only once across rerenders", async () => {
    const props = buildProps();
    const { rerender } = render(<CompanionEvolution {...props} />);

    await prepareEvolution();
    await flushTimers(FULL_SEQUENCE_MS.hold);

    expect(mocks.hapticsLightMock).toHaveBeenCalledTimes(1);

    rerender(<CompanionEvolution {...props} />);

    await flushTimers(
      FULL_SEQUENCE_MS.charge +
      FULL_SEQUENCE_MS.conceal +
      FULL_SEQUENCE_MS.strobe +
      FULL_SEQUENCE_MS.apex +
      FULL_SEQUENCE_MS.reveal,
    );

    expect(mocks.hapticsLightMock).toHaveBeenCalledTimes(1);
    expect(mocks.triggerEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.confettiMock).toHaveBeenCalledTimes(1);
  });
});

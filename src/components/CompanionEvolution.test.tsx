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
  globalAudioMuted: false,
  ensureReadyMock: vi.fn(() => Promise.resolve()),
  globalAudioListeners: new Set<(muted: boolean) => void>(),
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

      return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
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

vi.mock("@/utils/globalAudio", () => ({
  globalAudio: {
    getMuted: () => mocks.globalAudioMuted,
    ensureReady: () => mocks.ensureReadyMock(),
    subscribe: (listener: (muted: boolean) => void) => {
      mocks.globalAudioListeners.add(listener);
      return () => {
        mocks.globalAudioListeners.delete(listener);
      };
    },
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
  520,
  1040,
  1560,
  2080,
  2600,
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
const originalMediaPlay = HTMLMediaElement.prototype.play;
const originalMediaPause = HTMLMediaElement.prototype.pause;

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
  presetId: "fox",
  element: "fire",
  onAnimationError: vi.fn(),
  onComplete: vi.fn(),
});

const buildFirstHatchProps = () => ({
  ...buildProps(),
  previousStage: 0,
  newStage: 1,
  previousImageUrl: "https://example.com/egg.png",
  newImageUrl: "https://example.com/hatchling.png",
});

describe("CompanionEvolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.profile = "balanced";
    mocks.prefersReducedMotion = false;
    mocks.globalAudioMuted = false;
    mocks.ensureReadyMock.mockResolvedValue(undefined);
    mocks.globalAudioListeners.clear();

    globalThis.Image = MockPreloadImage as unknown as typeof Image;
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    globalThis.Image = originalImage;
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: originalMediaPlay,
      writable: true,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: originalMediaPause,
      writable: true,
    });
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
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-beat", "5");
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

  it("falls back to a single-image presentation when the previous and next art match", async () => {
    const props = buildProps();

    render(
      <CompanionEvolution
        {...props}
        newImageUrl={props.previousImageUrl}
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

    await flushTimers(FULL_SEQUENCE_MS.hold + FULL_SEQUENCE_MS.charge + FULL_SEQUENCE_MS.conceal);
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
    expect(screen.queryByTestId("evolution-lightning-strike")).not.toBeInTheDocument();

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

  it("plays a ready evolution animation video after the flash reveal", async () => {
    const props = {
      ...buildProps(),
      animationVideoUrl: "https://example.com/evolution.mp4",
    };

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");

    const primedVideo = screen.getByTestId("evolution-animation-video");
    expect(primedVideo).toHaveAttribute("data-animation-visible", "false");
    expect(primedVideo).toHaveStyle({ opacity: "0" });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await flushTimers(
      FULL_SEQUENCE_MS.hold +
      FULL_SEQUENCE_MS.charge +
      FULL_SEQUENCE_MS.conceal +
      FULL_SEQUENCE_MS.strobe +
      FULL_SEQUENCE_MS.apex,
    );

    expect(dialog).toHaveAttribute("data-phase", "reveal");
    const video = screen.getByTestId("evolution-animation-video") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", props.animationVideoUrl);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video).toHaveAttribute("data-animation-ready", "true");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(video).toHaveStyle({ opacity: "1" });
    expect(screen.getByTestId("evolution-reveal-art")).toHaveAttribute("data-hold-for-animation", "true");

    await flushTimers(FULL_SEQUENCE_MS.reveal + FULL_SEQUENCE_MS.dismissBuffer);
    expect(screen.queryByText("Tap anywhere to continue")).not.toBeInTheDocument();
    fireEvent.click(dialog);
    expect(props.onComplete).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.ended(video);
    });

    expect(video).toHaveAttribute("data-animation-ended", "true");
    expect(video).toHaveAttribute("data-animation-visible", "false");
    expect(screen.getByTestId("evolution-reveal-art")).toHaveAttribute("data-hold-for-animation", "false");
    expect(screen.getByText("Tap anywhere to continue")).toBeInTheDocument();
  });

  it("does not fall back to a still reveal when the evolution animation video fails", async () => {
    const props = {
      ...buildProps(),
      animationVideoUrl: "https://example.com/broken-evolution.mp4",
    };

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    await flushTimers(
      FULL_SEQUENCE_MS.hold +
      FULL_SEQUENCE_MS.charge +
      FULL_SEQUENCE_MS.conceal +
      FULL_SEQUENCE_MS.strobe +
      FULL_SEQUENCE_MS.apex,
    );
    const video = screen.getByTestId("evolution-animation-video") as HTMLVideoElement;

    await act(async () => {
      fireEvent.error(video);
    });

    expect(props.onAnimationError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to a still reveal when evolution animation playback is rejected", async () => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("autoplay rejected")),
      writable: true,
    });

    const props = {
      ...buildProps(),
      animationVideoUrl: "https://example.com/evolution.mp4",
    };

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    await flushTimers(
      FULL_SEQUENCE_MS.hold +
      FULL_SEQUENCE_MS.charge +
      FULL_SEQUENCE_MS.conceal +
      FULL_SEQUENCE_MS.strobe +
      FULL_SEQUENCE_MS.apex,
    );
    await flushTimers();

    expect(props.onAnimationError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("still renders the Kling evolution animation video at the reduced-motion reveal", async () => {
    mocks.profile = "reduced";
    mocks.prefersReducedMotion = true;

    render(
      <CompanionEvolution
        {...buildProps()}
        animationVideoUrl="https://example.com/evolution.mp4"
      />,
    );
    await prepareEvolution();

    expect(screen.getByTestId("evolution-animation-video")).toHaveAttribute(
      "data-animation-visible",
      "false",
    );

    await flushTimers(
      REDUCED_SEQUENCE_MS.hold +
      REDUCED_SEQUENCE_MS.charge +
      REDUCED_SEQUENCE_MS.conceal +
      REDUCED_SEQUENCE_MS.apex,
    );

    expect(screen.getByTestId("evolution-animation-video")).toHaveAttribute(
      "data-animation-visible",
      "true",
    );
  });

  it("starts the first hatch reveal without a hatchery intro splash", async () => {
    render(<CompanionEvolution {...buildFirstHatchProps()} />);
    await prepareEvolution();

    expect(screen.queryByTestId("evolution-hatch-intro")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByTestId("evolution-previous-art")).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("uses the image silhouette strobe for generated first hatches without a mapped preset video", async () => {
    render(
      <CompanionEvolution
        {...buildFirstHatchProps()}
        presetId={undefined}
      />,
    );
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    const artStage = screen.getByTestId("evolution-art-stage");

    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(artStage).toHaveAttribute("data-art-presentation", "swap");
    expect(artStage).toHaveAttribute("data-strobe-enabled", "true");
    expect(screen.getByTestId("evolution-previous-art")).toBeInTheDocument();
    expect(screen.getByTestId("evolution-reveal-art")).toBeInTheDocument();
    expect(screen.getByTestId("evolution-reveal-art").querySelector("img")).toHaveAttribute(
      "data-companion-image-fit",
      "contain",
    );

    await flushTimers(FULL_SEQUENCE_MS.hold + FULL_SEQUENCE_MS.charge + FULL_SEQUENCE_MS.conceal);
    expect(dialog).toHaveAttribute("data-phase", "strobe");
    expect(artStage).toHaveAttribute("data-strobe-beat", "0");
    expect(artStage).toHaveAttribute("data-strobe-target", "previous");
    expect(screen.queryByTestId("evolution-lightning-strike")).not.toBeInTheDocument();

    await flushTimers(STROBE_BEAT_OFFSETS_MS[1]);
    expect(artStage).toHaveAttribute("data-strobe-beat", "1");
    expect(artStage).toHaveAttribute("data-strobe-target", "next");
  });

  it("uses the exact egg and infant images instead of an unverified legacy clip", async () => {
    const props = buildFirstHatchProps();

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute(
      "data-strobe-enabled",
      "true",
    );
    expect(screen.getByTestId("evolution-previous-art").querySelector("img")).toHaveAttribute(
      "src",
      props.previousImageUrl,
    );
    expect(screen.getByTestId("evolution-reveal-art").querySelector("img")).toHaveAttribute(
      "src",
      props.newImageUrl,
    );
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("uses a prewarmed evolution animation ahead of mapped first hatch videos", async () => {
    render(
      <CompanionEvolution
        {...buildFirstHatchProps()}
        animationVideoUrl="https://example.com/evolution.mp4"
      />,
    );
    await prepareEvolution();

    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();

    const dialog = screen.getByRole("alertdialog");
    expect(screen.getByTestId("evolution-animation-video")).toHaveAttribute(
      "data-animation-visible",
      "false",
    );

    await flushTimers(
      FULL_SEQUENCE_MS.hold +
      FULL_SEQUENCE_MS.charge +
      FULL_SEQUENCE_MS.conceal +
      FULL_SEQUENCE_MS.strobe +
      FULL_SEQUENCE_MS.apex,
    );

    expect(dialog).toHaveAttribute("data-phase", "reveal");
    const video = screen.getByTestId("evolution-animation-video") as HTMLVideoElement;
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(video).toHaveStyle({ opacity: "1" });
  });

  it("does not restore an unverified legacy hatch clip when global audio is disabled", async () => {
    mocks.globalAudioMuted = true;
    const props = buildFirstHatchProps();

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("keeps later evolution cinematics on the legacy image-based path without hatch video playback", async () => {
    const props = buildProps();

    render(<CompanionEvolution {...props} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    await flushTimers(FULL_DISMISSABLE_SEQUENCE_MS);
    expect(screen.getByText("Tap anywhere to continue")).toBeInTheDocument();

    fireEvent.click(dialog);

    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(mocks.hapticsLightMock).toHaveBeenCalled();
  });

  it("does not show the hatchery intro for later evolutions", async () => {
    render(<CompanionEvolution {...buildProps()} />);
    await prepareEvolution();

    expect(screen.queryByTestId("evolution-hatch-intro")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows hatch visuals during first evolution", async () => {
    render(
      <CompanionEvolution
        {...buildFirstHatchProps()}
        presetId="fox"
        element="storm"
      />,
    );
    await prepareEvolution();
    await flushTimers(FULL_SEQUENCE_MS.hold);

    expect(screen.getByTestId("evolution-hatching-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();
  });

  it("does not show hatch visuals for later evolutions", async () => {
    render(<CompanionEvolution {...buildProps()} />);
    await prepareEvolution();
    await flushTimers(FULL_SEQUENCE_MS.hold);

    expect(screen.queryByTestId("evolution-hatching-overlay")).not.toBeInTheDocument();
  });

  it("falls back to the legacy first-hatch barrage when no mapped hatch video exists", async () => {
    render(
      <CompanionEvolution
        {...buildProps()}
        previousStage={0}
        newStage={1}
        previousImageUrl="https://example.com/egg.png"
        newImageUrl="https://example.com/hatchling.png"
        presetId="fox"
        element="storm"
      />,
    );
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    expect(screen.queryByTestId("evolution-hatch-video")).not.toBeInTheDocument();
    expect(screen.getByTestId("evolution-art-stage")).toHaveAttribute("data-strobe-enabled", "true");
    const revealArtImage = screen.getByTestId("evolution-reveal-art").querySelector("img");
    expect(revealArtImage).toHaveAttribute("data-companion-image-fit", "contain");

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

  it("runs a deterministic six-beat silhouette swap at a flash-safe cadence before one apex strike", async () => {
    render(<CompanionEvolution {...buildProps()} />);
    await prepareEvolution();

    const dialog = screen.getByRole("alertdialog");
    const artStage = screen.getByTestId("evolution-art-stage");
    const gaps = STROBE_BEAT_OFFSETS_MS.slice(1).map((offset, index) => offset - STROBE_BEAT_OFFSETS_MS[index]);

    expect(gaps.every((gap) => gap >= 500)).toBe(true);

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
      expect(screen.queryByTestId("evolution-lightning-strike")).not.toBeInTheDocument();
    }

    await flushTimers(FULL_SEQUENCE_MS.strobe - elapsed);
    expect(dialog).toHaveAttribute("data-phase", "apex");
    expect(artStage).toHaveAttribute("data-strobe-beat", "5");
    expect(artStage).toHaveAttribute("data-strobe-target", "next");
    expect(screen.getByTestId("evolution-lightning-strike")).toHaveAttribute("data-apex", "true");
    expect(screen.getByTestId("evolution-lightning-strike")).toHaveAttribute("data-variant", "apex");
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
    expect(mocks.hapticsMediumMock).toHaveBeenCalledTimes(1);
    expect(mocks.hapticsHeavyMock).toHaveBeenCalledTimes(1);

    await flushTimers(1);
    expect(dialog).toHaveAttribute("data-phase", "apex");
    expect(mocks.hapticsHeavyMock).toHaveBeenCalledTimes(2);

    await flushTimers(FULL_SEQUENCE_MS.apex);
    expect(dialog).toHaveAttribute("data-phase", "reveal");
    expect(mocks.hapticsMediumMock).toHaveBeenCalledTimes(2);
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

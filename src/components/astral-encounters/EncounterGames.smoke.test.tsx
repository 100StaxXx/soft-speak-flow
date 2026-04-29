import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AstralFrequencyGame } from './AstralFrequencyGame';
import { EclipseTimingGame } from './EclipseTimingGame';
import { EnergyBeamGame } from './EnergyBeamGame';
import { GalacticMatchGame } from './GalacticMatchGame';
import { SoulSerpentGame } from './SoulSerpentGame';
import { StarfallDodgeGame } from './StarfallDodgeGame';
import { TapSequenceGame } from './TapSequenceGame';
import { afterEach, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchRandomTrack: vi.fn(),
  rateTrack: vi.fn(),
  incrementPlayCount: vi.fn(),
}));

vi.mock('framer-motion', () => {
  const passthrough = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
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

    return <div {...domProps}>{children}</div>;
  };

  const motionProxy = new Proxy(
    {},
    {
      get: () => passthrough,
    },
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

vi.mock('@/utils/soundEffects', () => ({
  playHabitComplete: vi.fn(),
  playMissionComplete: vi.fn(),
  playXPGain: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="mock-canvas" />,
  useFrame: vi.fn(),
  useThree: () => ({
    camera: {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
    },
  }),
}));

vi.mock('@/hooks/useRhythmTrack', () => ({
  useRhythmTrack: () => ({
    track: null,
    isLoading: false,
    isGenerating: false,
    error: null,
    userRating: null,
    fetchRandomTrack: mocks.fetchRandomTrack,
    rateTrack: mocks.rateTrack,
    incrementPlayCount: mocks.incrementPlayCount,
  }),
}));

vi.mock('@/utils/orientationLock', () => ({
  lockToLandscape: vi.fn().mockResolvedValue(undefined),
  lockToPortrait: vi.fn().mockResolvedValue(undefined),
}));

const baseProps = {
  companionStats: { mind: 50, body: 50, soul: 50 },
  onComplete: vi.fn(),
  difficulty: 'easy' as const,
  isPractice: true,
};

beforeEach(() => {
  mocks.fetchRandomTrack.mockReset();
  mocks.fetchRandomTrack.mockResolvedValue(null);
  mocks.rateTrack.mockReset();
  mocks.rateTrack.mockResolvedValue(true);
  mocks.incrementPlayCount.mockReset();
  mocks.incrementPlayCount.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('active encounter games smoke', () => {
  it('renders Energy Beam without crashing', () => {
    render(<EnergyBeamGame {...baseProps} />);

    expect(screen.getByText('SCORE')).toBeInTheDocument();
    expect(screen.getByText('WAVE 1')).toBeInTheDocument();
  });

  it('renders Tap Sequence without crashing', () => {
    render(<TapSequenceGame {...baseProps} />);

    expect(screen.getByText('Memory Sequence')).toBeInTheDocument();
    expect(screen.getByText('No time limit')).toBeInTheDocument();
  });

  it('renders Galactic Match without crashing', () => {
    render(<GalacticMatchGame {...baseProps} />);

    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Score:')).toBeInTheDocument();
  });

  it('renders Astral Frequency without crashing', () => {
    render(<AstralFrequencyGame {...baseProps} />);

    expect(screen.getByText('◀')).toBeInTheDocument();
    expect(screen.getByText('▶')).toBeInTheDocument();
  });

  it('renders Eclipse Timing without crashing', () => {
    render(<EclipseTimingGame {...baseProps} />);

    expect(screen.getByText('Loading music...')).toBeInTheDocument();
  });

  it('skips the rhythm track fetch in compact encounter mode and uses fallback notes', async () => {
    const audioConstructor = vi.fn();
    vi.stubGlobal('Audio', audioConstructor);

    render(
      <EclipseTimingGame
        {...baseProps}
        compact
        isPractice={false}
      />,
    );

    // Compact mode deliberately bypasses the rhythm-track loader so the
    // encounter can start immediately with fallback notes; battle music is
    // skipped to avoid the loading delay.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.fetchRandomTrack).not.toHaveBeenCalled();
    expect(audioConstructor).not.toHaveBeenCalled();
  });

  it('renders Starfall Dodge without crashing', () => {
    render(<StarfallDodgeGame {...baseProps} />);

    expect(screen.getByText('Rotate Your Phone')).toBeInTheDocument();
  });

  it('renders Tap Sequence compact encounter layout without crashing', () => {
    const { container } = render(<TapSequenceGame {...baseProps} compact />);

    expect(container.querySelectorAll('.touch-target').length).toBeGreaterThan(0);
  });

  it('renders Galactic Match compact encounter layout without crashing', () => {
    render(<GalacticMatchGame {...baseProps} compact />);

    expect(screen.getByText('Score:')).toBeInTheDocument();
  });

  it('renders Galactic Match with the fullscreen height shell and inline reveal chip', () => {
    vi.useFakeTimers();

    try {
      render(<GalacticMatchGame {...baseProps} compact />);

      const root = screen.getByTestId('galactic-match-root');
      expect(root.className).toContain('w-full');
      expect(root.className).toContain('h-full');

      let revealChip: HTMLElement | null = null;
      for (let i = 0; i < 8 && !revealChip; i++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        revealChip = screen.queryByTestId('galactic-match-reveal-chip');
      }

      expect(revealChip).not.toBeNull();
      expect(revealChip?.className).not.toContain('-top-12');
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('renders Soul Serpent without crashing', () => {
    render(<SoulSerpentGame {...baseProps} />);

    expect(screen.getByText('Soul Serpent')).toBeInTheDocument();
  });
});

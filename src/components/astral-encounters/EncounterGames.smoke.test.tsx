import React from 'react';
import { render, screen } from '@testing-library/react';
import { AstralFrequencyGame } from './AstralFrequencyGame';
import { EclipseTimingGame } from './EclipseTimingGame';
import { EnergyBeamGame } from './EnergyBeamGame';
import { GalacticMatchGame } from './GalacticMatchGame';
import { SoulSerpentGame } from './SoulSerpentGame';
import { StarfallDodgeGame } from './StarfallDodgeGame';
import { TapSequenceGame } from './TapSequenceGame';

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
    fetchRandomTrack: vi.fn().mockResolvedValue(null),
    rateTrack: vi.fn().mockResolvedValue(true),
    incrementPlayCount: vi.fn().mockResolvedValue(undefined),
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

  it('renders Soul Serpent without crashing', () => {
    render(<SoulSerpentGame {...baseProps} />);

    expect(screen.getByText('Soul Serpent')).toBeInTheDocument();
  });
});

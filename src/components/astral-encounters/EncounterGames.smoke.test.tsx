import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnergyBeamGame } from './EnergyBeamGame';
import { GalacticMatchGame } from './GalacticMatchGame';
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
});

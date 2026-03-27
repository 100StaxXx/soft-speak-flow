import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PracticeRoundWrapper } from './PracticeRoundWrapper';

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

vi.mock('./EnergyBeamGame', () => ({
  EnergyBeamGame: ({
    compact,
    isPractice,
    maxTimer,
  }: {
    compact?: boolean;
    isPractice?: boolean;
    maxTimer?: number;
  }) => (
    <div
      data-testid="energy-beam-game"
      data-compact={String(compact)}
      data-is-practice={String(isPractice)}
      data-max-timer={String(maxTimer)}
    />
  ),
}));

vi.mock('./TapSequenceGame', () => ({
  TapSequenceGame: () => <div data-testid="tap-sequence-game" />,
}));

vi.mock('./AstralFrequencyGame', () => ({
  AstralFrequencyGame: () => <div data-testid="astral-frequency-game" />,
}));

vi.mock('./EclipseTimingGame', () => ({
  EclipseTimingGame: () => <div data-testid="eclipse-timing-game" />,
}));

vi.mock('./StarfallDodgeGame', () => ({
  StarfallDodgeGame: () => <div data-testid="starfall-dodge-game" />,
}));

vi.mock('./SoulSerpentGame', () => ({
  SoulSerpentGame: () => <div data-testid="soul-serpent-game" />,
}));

vi.mock('./OrbMatchGame', () => ({
  OrbMatchGame: () => <div data-testid="orb-match-game" />,
}));

vi.mock('./GalacticMatchGame', () => ({
  GalacticMatchGame: () => <div data-testid="galactic-match-game" />,
}));

describe('PracticeRoundWrapper', () => {
  it('uses the shared fullscreen shell and compact fullscreen practice props', async () => {
    render(
      <PracticeRoundWrapper
        gameType="energy_beam"
        companionStats={{ mind: 50, body: 50, soul: 50 }}
        onPracticeComplete={vi.fn()}
        onSkipPractice={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));

    const fullscreenShell = await screen.findByTestId('practice-fullscreen-shell');
    const game = await screen.findByTestId('energy-beam-game');

    expect(fullscreenShell).toBeInTheDocument();
    expect(screen.getByTestId('practice-inline-chip')).toHaveTextContent('Practice');
    expect(game).toHaveAttribute('data-compact', 'true');
    expect(game).toHaveAttribute('data-is-practice', 'true');
    expect(game).toHaveAttribute('data-max-timer', '12');
  });
});

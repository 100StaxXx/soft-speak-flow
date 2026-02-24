import React, { useEffect } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OrbMatchGame } from './OrbMatchGame';
import { GalacticMatchGame } from './GalacticMatchGame';
import { TapSequenceGame } from './TapSequenceGame';
import { EnergyBeamGame } from './EnergyBeamGame';
import { useSingleCompletion } from './gameLifecycle';

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
  difficulty: 'master' as const,
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('active encounter lifecycle hardening', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useSingleCompletion emits only once', () => {
    const onComplete = vi.fn();

    const Harness = () => {
      const { completeOnce } = useSingleCompletion(onComplete);

      useEffect(() => {
        completeOnce('first');
        completeOnce('second');
      }, [completeOnce]);

      return null;
    };

    render(<Harness />);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('first');
  });

  it('OrbMatch never emits duplicate completion during extended timer advancement', () => {
    const onComplete = vi.fn();
    render(
      <OrbMatchGame
        {...baseProps}
        difficulty="easy"
        onComplete={onComplete}
        isPractice
        maxTimer={1}
      />,
    );

    advance(25000);
    expect(onComplete.mock.calls.length).toBeLessThanOrEqual(1);

    advance(10000);
    expect(onComplete.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('TapSequence never emits duplicate completion during extended interaction', () => {
    const onComplete = vi.fn();
    const { container } = render(
      <TapSequenceGame
        {...baseProps}
        onComplete={onComplete}
      />,
    );

    // Countdown + show sequence
    advance(11000);

    for (let i = 0; i < 6 && onComplete.mock.calls.length === 0; i++) {
      const orbButtons = Array.from(container.querySelectorAll('.touch-target'))
        .filter((btn) => !(btn as HTMLButtonElement).disabled) as HTMLButtonElement[];
      orbButtons.forEach((button) => {
        fireEvent.click(button);
      });
      advance(2500);
    }

    advance(10000);
    expect(onComplete.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('GalacticMatch never emits duplicate completion during extended interaction', () => {
    const onComplete = vi.fn();
    const { container } = render(
      <GalacticMatchGame
        {...baseProps}
        onComplete={onComplete}
      />,
    );

    // Countdown + reveal + hide
    advance(9000);

    for (let i = 0; i < 8 && onComplete.mock.calls.length === 0; i++) {
      const cardButtons = Array.from(container.querySelectorAll('button[style*="perspective"]'))
        .filter((btn) => !(btn as HTMLButtonElement).disabled) as HTMLButtonElement[];
      if (cardButtons.length < 2) {
        advance(1200);
        continue;
      }

      fireEvent.click(cardButtons[0]);
      fireEvent.click(cardButtons[1]);
      advance(2200);
    }

    advance(10000);
    expect(onComplete.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('cleans up timers safely on unmount for all active games', () => {
    const orbComplete = vi.fn();
    const tapComplete = vi.fn();
    const galacticComplete = vi.fn();
    const energyComplete = vi.fn();

    const orb = render(
      <OrbMatchGame {...baseProps} difficulty="easy" onComplete={orbComplete} isPractice maxTimer={1} />,
    );
    const tap = render(
      <TapSequenceGame {...baseProps} onComplete={tapComplete} />,
    );
    const galactic = render(
      <GalacticMatchGame {...baseProps} onComplete={galacticComplete} />,
    );
    const energy = render(
      <EnergyBeamGame {...baseProps} onComplete={energyComplete} isPractice />,
    );

    advance(2500);
    orb.unmount();
    tap.unmount();
    galactic.unmount();
    energy.unmount();

    advance(15000);

    expect(orbComplete).toHaveBeenCalledTimes(0);
    expect(tapComplete).toHaveBeenCalledTimes(0);
    expect(galacticComplete).toHaveBeenCalledTimes(0);
    expect(energyComplete).toHaveBeenCalledTimes(0);
  });

  it('EnergyBeam keyboard listeners are not reattached during play and are removed on unmount', () => {
    const onComplete = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const view = render(
      <EnergyBeamGame
        {...baseProps}
        difficulty="easy"
        onComplete={onComplete}
      />,
    );

    advance(4000); // countdown -> playing and listener registration

    const keydownAdds = addSpy.mock.calls.filter(([eventName]) => eventName === 'keydown').length;
    const keyupAdds = addSpy.mock.calls.filter(([eventName]) => eventName === 'keyup').length;

    advance(300); // short in-play window to avoid expected phase transitions

    const keydownAddsAfter = addSpy.mock.calls.filter(([eventName]) => eventName === 'keydown').length;
    const keyupAddsAfter = addSpy.mock.calls.filter(([eventName]) => eventName === 'keyup').length;

    expect(keydownAddsAfter).toBe(keydownAdds);
    expect(keyupAddsAfter).toBe(keyupAdds);

    view.unmount();

    const keydownRemoves = removeSpy.mock.calls.filter(([eventName]) => eventName === 'keydown').length;
    const keyupRemoves = removeSpy.mock.calls.filter(([eventName]) => eventName === 'keyup').length;

    expect(keydownRemoves).toBeGreaterThan(0);
    expect(keyupRemoves).toBeGreaterThan(0);
  });
});

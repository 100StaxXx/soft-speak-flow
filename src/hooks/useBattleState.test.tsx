import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBattleState } from './useBattleState';

describe('useBattleState', () => {
  it('holds the player at the configured floor HP instead of triggering defeat', () => {
    const onPlayerDefeated = vi.fn();

    const { result } = renderHook(() =>
      useBattleState({
        tier: 'common',
        onPlayerDefeated,
        playerFloorHP: 1,
      }),
    );

    act(() => {
      result.current.dealDamage({ target: 'player', amount: 999, source: 'test' });
    });

    expect(result.current.battleState.playerHP).toBe(1);
    expect(result.current.battleState.isPlayerDefeated).toBe(false);
    expect(onPlayerDefeated).not.toHaveBeenCalled();
  });

  it('still allows a true defeat when no floor HP is configured', () => {
    const onPlayerDefeated = vi.fn();

    const { result } = renderHook(() =>
      useBattleState({
        tier: 'common',
        onPlayerDefeated,
      }),
    );

    act(() => {
      result.current.dealDamage({ target: 'player', amount: 999, source: 'test' });
    });

    expect(result.current.battleState.playerHP).toBe(0);
    expect(result.current.battleState.isPlayerDefeated).toBe(true);
  });
});

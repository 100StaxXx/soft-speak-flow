import { describe, expect, it } from 'vitest';
import { TIER_BATTLE_DURATION } from './battleSystem';

describe('TIER_BATTLE_DURATION', () => {
  it('uses a 90-second baseline for standard encounter tiers', () => {
    expect(TIER_BATTLE_DURATION.common).toBe(90);
    expect(TIER_BATTLE_DURATION.uncommon).toBe(90);
    expect(TIER_BATTLE_DURATION.rare).toBe(90);
    expect(TIER_BATTLE_DURATION.epic).toBe(90);
  });

  it('keeps legendary encounters at 120 seconds', () => {
    expect(TIER_BATTLE_DURATION.legendary).toBe(120);
  });
});

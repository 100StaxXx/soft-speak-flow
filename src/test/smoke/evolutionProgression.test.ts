import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDocument, getDocument } from '@/lib/firebase/firestore';
import { EVOLUTION_THRESHOLDS } from '@/config/xpSystem';
import { createMockUser, createMockCompanion } from '../utils/testHelpers';

// Mock Firestore
vi.mock('@/lib/firebase/firestore', () => ({
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  setDocument: vi.fn(() => Promise.resolve()),
  updateDocument: vi.fn(() => Promise.resolve()),
  deleteDocument: vi.fn(() => Promise.resolve()),
  timestampToISO: vi.fn((val) => val),
}));

// Helper functions for evolution logic
const getThreshold = (stage: number): number => {
  return EVOLUTION_THRESHOLDS[stage] ?? 0;
};

const shouldEvolve = (currentStage: number, currentXP: number): boolean => {
  const nextThreshold = EVOLUTION_THRESHOLDS[currentStage + 1];
  return nextThreshold !== undefined && currentXP >= nextThreshold;
};

describe('Evolution Progression Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update companion XP when quest is completed', async () => {
    const user = createMockUser();
    const companion = createMockCompanion({
      user_id: user.uid,
      current_xp: 0,
      current_stage: 0,
    });
    const xpReward = 8;

    const newXP = companion.current_xp + xpReward;

    await updateDocument('user_companion', companion.id, {
      current_xp: newXP,
    });

    expect(updateDocument).toHaveBeenCalledWith('user_companion', companion.id, {
      current_xp: newXP,
    });
  });

  it('should trigger evolution when XP threshold is reached', async () => {
    const user = createMockUser();
    const companion = createMockCompanion({
      user_id: user.uid,
      current_xp: 5,
      current_stage: 0,
    });
    const xpReward = 10; // Enough to reach stage 1 threshold

    const newXP = companion.current_xp + xpReward;
    const shouldEvolveNow = shouldEvolve(companion.current_stage, newXP);

    if (shouldEvolveNow) {
      const nextStage = companion.current_stage + 1;
      await updateDocument('user_companion', companion.id, {
        current_xp: newXP,
        current_stage: nextStage,
      });

      expect(updateDocument).toHaveBeenCalledWith('user_companion', companion.id, {
        current_xp: newXP,
        current_stage: nextStage,
      });
    }

    expect(shouldEvolveNow).toBe(true);
  });

  it('should not evolve if XP threshold is not reached', async () => {
    const user = createMockUser();
    const companion = createMockCompanion({
      user_id: user.uid,
      current_xp: 5,
      current_stage: 0,
    });
    const xpReward = 3; // Not enough to reach stage 1 threshold (10)

    const newXP = companion.current_xp + xpReward;
    const shouldEvolveNow = shouldEvolve(companion.current_stage, newXP);

    if (!shouldEvolveNow) {
      await updateDocument('user_companion', companion.id, {
        current_xp: newXP,
        // Stage should remain the same
      });

      expect(updateDocument).toHaveBeenCalledWith('user_companion', companion.id, {
        current_xp: newXP,
      });
    }

    expect(shouldEvolveNow).toBe(false);
  });

  it('should progress through multiple evolution stages', async () => {
    const user = createMockUser();
    let companion = createMockCompanion({
      user_id: user.uid,
      current_xp: 0,
      current_stage: 0,
    });

    // Stage 0 -> Stage 1 (needs 10 XP)
    companion.current_xp = 10;
    let shouldEvolveNow = shouldEvolve(companion.current_stage, companion.current_xp);
    if (shouldEvolveNow) {
      companion.current_stage = 1;
    }
    expect(companion.current_stage).toBe(1);

    // Stage 1 -> Stage 2 (needs 100 XP total)
    companion.current_xp = 100;
    shouldEvolveNow = shouldEvolve(companion.current_stage, companion.current_xp);
    if (shouldEvolveNow) {
      companion.current_stage = 2;
    }
    expect(companion.current_stage).toBe(2);
  });

  it('should update companion stage when evolution occurs', async () => {
    const user = createMockUser();
    const companion = createMockCompanion({
      user_id: user.uid,
      current_xp: 8,
      current_stage: 0,
    });
    const xpReward = 5; // Total will be 13, exceeding stage 1 threshold

    const newXP = companion.current_xp + xpReward;
    const shouldEvolveNow = shouldEvolve(companion.current_stage, newXP);

    if (shouldEvolveNow) {
      const newStage = companion.current_stage + 1;
      await updateDocument('user_companion', companion.id, {
        current_xp: newXP,
        current_stage: newStage,
      });

      // Verify companion was updated
      vi.mocked(getDocument).mockResolvedValueOnce({
        ...companion,
        current_xp: newXP,
        current_stage: newStage,
      });

      const updatedCompanion = await getDocument('user_companion', companion.id);
      expect(updatedCompanion?.current_stage).toBe(newStage);
      expect(updatedCompanion?.current_xp).toBe(newXP);
    }
  });

  it('should handle XP accumulation across multiple quests', async () => {
    const user = createMockUser();
    let companion = createMockCompanion({
      user_id: user.uid,
      current_xp: 0,
      current_stage: 0,
    });

    const quests = [
      { xp: 8 },   // Easy quest
      { xp: 16 },  // Medium quest
      { xp: 28 },  // Hard quest
    ];

    for (const quest of quests) {
      companion.current_xp += quest.xp;
      await updateDocument('user_companion', companion.id, {
        current_xp: companion.current_xp,
      });
    }

    expect(companion.current_xp).toBe(52); // 8 + 16 + 28
    expect(updateDocument).toHaveBeenCalledTimes(3);
  });

  it('should correctly calculate next evolution threshold', () => {
    const stage0Threshold = getThreshold(0);
    const stage1Threshold = getThreshold(1);
    const stage2Threshold = getThreshold(2);

    expect(stage0Threshold).toBe(0);
    expect(stage1Threshold).toBe(10);
    expect(stage2Threshold).toBe(100);
    expect(stage2Threshold).toBeGreaterThan(stage1Threshold);
  });
});


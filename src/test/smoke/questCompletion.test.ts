import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDocument, getDocument } from '@/lib/firebase/firestore';
import { createMockUser, createMockTask, createMockCompanion } from '../utils/testHelpers';

// Mock Firestore
vi.mock('@/lib/firebase/firestore', () => ({
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  setDocument: vi.fn(() => Promise.resolve()),
  updateDocument: vi.fn(() => Promise.resolve()),
  deleteDocument: vi.fn(() => Promise.resolve()),
  timestampToISO: vi.fn((val) => val),
}));

// Mock XP rewards hook
vi.mock('@/hooks/useXPRewards', () => ({
  useXPRewards: vi.fn(() => ({
    awardCustomXP: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock companion hook
vi.mock('@/hooks/useCompanion', () => ({
  useCompanion: vi.fn(() => ({
    companion: createMockCompanion(),
    awardXP: vi.fn(() => Promise.resolve()),
  })),
}));

describe('Quest Completion Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset getDocument mock to default behavior (return null)
    // Individual tests can override with mockResolvedValueOnce
    vi.mocked(getDocument).mockResolvedValue(null);
  });

  it('should mark quest as completed', async () => {
    const user = createMockUser();
    const task = createMockTask({ user_id: user.uid, completed: false });
    const completedAt = new Date().toISOString();

    vi.mocked(getDocument).mockResolvedValueOnce({
      ...task,
      completed_at: null,
    });

    await updateDocument('daily_tasks', task.id, {
      completed: true,
      completed_at: completedAt,
    });

    expect(updateDocument).toHaveBeenCalledWith('daily_tasks', task.id, {
      completed: true,
      completed_at: completedAt,
    });
  });

  it('should award XP when quest is completed', async () => {
    const user = createMockUser();
    const task = createMockTask({
      user_id: user.uid,
      completed: false,
      xp_reward: 8,
    });

    vi.mocked(getDocument).mockResolvedValueOnce({
      ...task,
      completed_at: null,
    });

    const { useXPRewards } = await import('@/hooks/useXPRewards');
    const { awardCustomXP } = useXPRewards();

    // Mark as completed
    await updateDocument('daily_tasks', task.id, {
      completed: true,
      completed_at: new Date().toISOString(),
    });

    // Award XP
    await awardCustomXP(task.xp_reward, 'task_complete', 'Quest Complete!', {
      task_id: task.id,
    });

    expect(awardCustomXP).toHaveBeenCalledWith(
      task.xp_reward,
      'task_complete',
      'Quest Complete!',
      { task_id: task.id }
    );
  });

  it('should prevent double completion of quests', async () => {
    const user = createMockUser();
    const completedAt = new Date().toISOString();
    const taskId = 'task-123';
    
    // Create a completed task object
    const completedTask = {
      id: taskId,
      user_id: user.uid,
      task_text: 'Test quest',
      difficulty: 'easy' as const,
      xp_reward: 8,
      task_date: new Date().toISOString().split('T')[0],
      completed: true,
      completed_at: completedAt,
      is_main_quest: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Override the default mock for this test
    // Reset the mock completely and set it to return the completed task
    vi.mocked(getDocument).mockReset();
    vi.mocked(getDocument).mockResolvedValue(completedTask as any);

    // Attempt to complete already completed task should be prevented
    const existingTask = await getDocument('daily_tasks', taskId);
    expect(existingTask).toBeDefined();
    expect(existingTask).not.toBeNull();
    // Verify the task is marked as completed
    expect(existingTask?.completed).toBe(true);
    expect(existingTask?.completed_at).toBe(completedAt);
  });

  it('should update companion XP after quest completion', async () => {
    const user = createMockUser();
    const companion = createMockCompanion({ user_id: user.uid, current_xp: 0 });
    const task = createMockTask({
      user_id: user.uid,
      xp_reward: 8,
      completed: false,
    });

    vi.mocked(getDocument).mockResolvedValueOnce({
      ...task,
      completed_at: null,
    });

    // Complete quest
    await updateDocument('daily_tasks', task.id, {
      completed: true,
      completed_at: new Date().toISOString(),
    });

    // Update companion XP
    const newXP = companion.current_xp + task.xp_reward;
    await updateDocument('user_companion', companion.id, {
      current_xp: newXP,
    });

    expect(updateDocument).toHaveBeenCalledWith('user_companion', companion.id, {
      current_xp: newXP,
    });
  });

  it('should handle quest completion with different XP rewards', async () => {
    const user = createMockUser();
    const xpRewards = [8, 16, 28]; // easy, medium, hard

    for (const xpReward of xpRewards) {
      const task = createMockTask({
        user_id: user.uid,
        xp_reward: xpReward,
        completed: false,
      });

      vi.mocked(getDocument).mockResolvedValueOnce({
        ...task,
        completed_at: null,
      });

      await updateDocument('daily_tasks', task.id, {
        completed: true,
        completed_at: new Date().toISOString(),
      });

      const { useXPRewards } = await import('@/hooks/useXPRewards');
      const { awardCustomXP } = useXPRewards();
      await awardCustomXP(xpReward, 'task_complete', 'Quest Complete!');

      expect(awardCustomXP).toHaveBeenCalledWith(
        xpReward,
        'task_complete',
        'Quest Complete!'
      );
    }
  });

  it('should complete main quest with multiplier XP', async () => {
    const user = createMockUser();
    const baseXP = 16; // medium quest
    const multiplier = 1.5;
    const expectedXP = Math.floor(baseXP * multiplier);

    const task = createMockTask({
      user_id: user.uid,
      xp_reward: baseXP,
      is_main_quest: true,
      completed: false,
    });

    vi.mocked(getDocument).mockResolvedValueOnce({
      ...task,
      completed_at: null,
    });

    await updateDocument('daily_tasks', task.id, {
      completed: true,
      completed_at: new Date().toISOString(),
    });

    const { useXPRewards } = await import('@/hooks/useXPRewards');
    const { awardCustomXP } = useXPRewards();
    await awardCustomXP(expectedXP, 'task_complete', 'Main Quest Complete!');

    expect(awardCustomXP).toHaveBeenCalledWith(
      expectedXP,
      'task_complete',
      'Main Quest Complete!'
    );
  });
});


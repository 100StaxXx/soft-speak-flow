import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDailyTask, getDailyTasks } from '@/lib/firebase/dailyTasks';
import { createMockUser, createMockTask } from '../utils/testHelpers';

// Mock Firestore
vi.mock('@/lib/firebase/firestore', () => ({
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  setDocument: vi.fn(() => Promise.resolve()),
  updateDocument: vi.fn(() => Promise.resolve()),
  deleteDocument: vi.fn(() => Promise.resolve()),
  timestampToISO: vi.fn((val) => val),
}));

describe('Quest Creation Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new quest successfully', async () => {
    const user = createMockUser();
    const today = new Date().toISOString().split('T')[0];
    const taskData = {
      user_id: user.uid,
      task_text: 'Complete morning meditation',
      difficulty: 'easy' as const,
      xp_reward: 8,
      task_date: today,
      completed: false,
      is_main_quest: false,
    };

    const { setDocument } = await import('@/lib/firebase/firestore');
    const result = await createDailyTask(taskData);

    expect(setDocument).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.task_text).toBe(taskData.task_text);
    expect(result.user_id).toBe(user.uid);
    expect(result.difficulty).toBe(taskData.difficulty);
    expect(result.xp_reward).toBe(taskData.xp_reward);
  });

  it('should create quest with different difficulty levels', async () => {
    const user = createMockUser();
    const today = new Date().toISOString().split('T')[0];

    const difficulties = ['easy', 'medium', 'hard'] as const;
    const xpRewards = { easy: 8, medium: 16, hard: 28 };

    for (const difficulty of difficulties) {
      const taskData = {
        user_id: user.uid,
        task_text: `Test ${difficulty} quest`,
        difficulty,
        xp_reward: xpRewards[difficulty],
        task_date: today,
        completed: false,
        is_main_quest: false,
      };

      const result = await createDailyTask(taskData);
      expect(result.difficulty).toBe(difficulty);
      expect(result.xp_reward).toBe(xpRewards[difficulty]);
    }
  });

  it('should create main quest with correct flag', async () => {
    const user = createMockUser();
    const today = new Date().toISOString().split('T')[0];
    const taskData = {
      user_id: user.uid,
      task_text: 'Main quest: Complete all daily tasks',
      difficulty: 'medium' as const,
      xp_reward: 24, // 16 * 1.5 multiplier
      task_date: today,
      completed: false,
      is_main_quest: true,
    };

    const result = await createDailyTask(taskData);

    expect(result.is_main_quest).toBe(true);
    expect(result.xp_reward).toBeGreaterThan(16); // Should have multiplier applied
  });

  it('should retrieve quests for a specific date', async () => {
    const user = createMockUser();
    const today = new Date().toISOString().split('T')[0];
    const mockTasks = [
      createMockTask({ user_id: user.uid, task_date: today }),
      createMockTask({ user_id: user.uid, task_date: today }),
    ];

    const { getDocuments } = await import('@/lib/firebase/firestore');
    vi.mocked(getDocuments).mockResolvedValueOnce(mockTasks);

    const tasks = await getDailyTasks(user.uid, today);

    expect(getDocuments).toHaveBeenCalled();
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBe(2);
    expect(tasks.every(task => task.user_id === user.uid)).toBe(true);
    expect(tasks.every(task => task.task_date === today)).toBe(true);
  });

  it('should create quest with scheduled time', async () => {
    const user = createMockUser();
    const today = new Date().toISOString().split('T')[0];
    const taskData = {
      user_id: user.uid,
      task_text: 'Scheduled quest',
      difficulty: 'easy' as const,
      xp_reward: 8,
      task_date: today,
      completed: false,
      is_main_quest: false,
      scheduled_time: '09:00',
    };

    const result = await createDailyTask(taskData);

    expect(result.scheduled_time).toBe('09:00');
  });

  it('should assign unique IDs to each quest', async () => {
    const user = createMockUser();
    const today = new Date().toISOString().split('T')[0];
    const taskData = {
      user_id: user.uid,
      task_text: 'Test quest',
      difficulty: 'easy' as const,
      xp_reward: 8,
      task_date: today,
      completed: false,
      is_main_quest: false,
    };

    const task1 = await createDailyTask(taskData);
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamp
    const task2 = await createDailyTask({ ...taskData, task_text: 'Another quest' });

    expect(task1.id).toBeDefined();
    expect(task2.id).toBeDefined();
    expect(task1.id).not.toBe(task2.id);
  });
});


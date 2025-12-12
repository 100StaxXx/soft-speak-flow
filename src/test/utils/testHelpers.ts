import { vi } from 'vitest';
import type { AuthUser } from '@/lib/firebase/auth';
import type { DailyTask } from '@/lib/firebase/dailyTasks';
import type { Companion } from '@/hooks/useCompanion';

/**
 * Test helper utilities for creating mock data
 */

export const createMockUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  uid: 'test-user-123',
  id: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  ...overrides,
});

export const createMockTask = (overrides: Partial<DailyTask> = {}): DailyTask => {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: `task-${Date.now()}`,
    user_id: 'test-user-123',
    task_text: 'Test quest',
    difficulty: 'easy',
    xp_reward: 8,
    task_date: today,
    completed: false,
    is_main_quest: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
};

export const createMockCompanion = (overrides: Partial<Companion> = {}): Companion => ({
  id: 'companion-123',
  user_id: 'test-user-123',
  favorite_color: 'blue',
  spirit_animal: 'wolf',
  core_element: 'fire',
  current_stage: 0,
  current_xp: 0,
  current_image_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProfile = (overrides: any = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  onboarding_completed: false,
  selected_mentor_id: null,
  ...overrides,
});

export const createMockMentor = (overrides: any = {}) => ({
  id: 'mentor-123',
  name: 'Test Mentor',
  slug: 'test-mentor',
  description: 'A test mentor',
  tone_description: 'Supportive and encouraging',
  avatar_url: null,
  tags: ['supportive', 'motivational'],
  ...overrides,
});

/**
 * Wait for async operations to complete
 */
export const waitFor = (ms: number = 0) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock console methods to suppress output during tests
 */
export const suppressConsole = () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
  };
};


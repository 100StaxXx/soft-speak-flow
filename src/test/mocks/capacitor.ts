import { vi } from 'vitest';

// Mock Capacitor Core
export const mockCapacitor = {
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => false),
};

// Mock Push Notifications
export const mockPushNotifications = {
  requestPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
  register: vi.fn(() => Promise.resolve()),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  removeAllListeners: vi.fn(() => Promise.resolve()),
  getDeliveredNotifications: vi.fn(() => Promise.resolve([])),
};


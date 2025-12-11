import { vi } from 'vitest';

// Mock Firebase Auth
export const mockFirebaseAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((callback) => {
    // Return unsubscribe function
    return vi.fn();
  }),
  signOut: vi.fn(() => Promise.resolve()),
};

// Mock Firebase User
export const createMockFirebaseUser = (overrides = {}) => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  getIdToken: vi.fn(() => Promise.resolve('mock-id-token')),
  ...overrides,
});

// Mock Firebase Firestore
export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
};

// Mock Firestore document snapshot
export const createMockDocSnapshot = (data: any, id: string = 'test-doc-id') => ({
  id,
  data: () => data,
  exists: () => !!data,
  ref: { id },
});

// Mock Firestore query snapshot
export const createMockQuerySnapshot = (docs: any[]) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
  forEach: (callback: (doc: any) => void) => docs.forEach(callback),
});

// Mock Firebase functions
export const mockFirebaseFunctions = {
  httpsCallable: vi.fn((name: string) => {
    return vi.fn((data: any) => {
      // Return mock response based on function name
      if (name === 'generateDailyMissions') {
        return Promise.resolve({
          data: {
            missions: [
              {
                id: 'mission-1',
                mission_text: 'Test mission',
                xp_reward: 10,
                completed: false,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  }),
};


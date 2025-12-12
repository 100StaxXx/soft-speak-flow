import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, signUp, signInWithGoogle } from '@/lib/firebase/auth';
import { ensureProfile } from '@/utils/authRedirect';
import { createMockUser } from '../utils/testHelpers';

// Mock Firebase Auth
vi.mock('firebase/auth', () => {
  return {
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: vi.fn(() => ({
      addScope: vi.fn(),
    })),
    getAuth: vi.fn(() => ({
      currentUser: null,
      onAuthStateChanged: vi.fn(),
    })),
  };
});

// Mock ensureProfile
vi.mock('@/utils/authRedirect', () => ({
  ensureProfile: vi.fn(() => Promise.resolve()),
}));

// Mock Firebase instance
vi.mock('@/lib/firebase', () => ({
  firebaseAuth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
  },
}));

describe('Sign-In Smoke Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Setup default mock implementations
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } = await import('firebase/auth');
    const mockUser = createMockUser();
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(signInWithPopup).mockResolvedValue({ user: mockUser } as any);
  });

  it('should successfully sign in with email and password', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockUser = createMockUser({ email });

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({ user: mockUser } as any);
    const result = await signIn(email, password);

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      email,
      password
    );
    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(email);
  });

  it('should successfully sign up with email and password', async () => {
    const email = 'newuser@example.com';
    const password = 'password123';
    const mockUser = createMockUser({ email });

    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({ user: mockUser } as any);
    const result = await signUp(email, password);

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      email,
      password
    );
    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(email);
    expect(ensureProfile).toHaveBeenCalledWith(
      result.user.uid,
      email,
      undefined
    );
  });

  it('should successfully sign in with Google', async () => {
    const mockUser = createMockUser();
    const { signInWithPopup } = await import('firebase/auth');
    vi.mocked(signInWithPopup).mockResolvedValueOnce({ user: mockUser } as any);
    const result = await signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.user).toBeDefined();
  });

  it('should handle sign-in errors gracefully', async () => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error('Invalid credentials')
    );

    await expect(signIn('wrong@example.com', 'wrongpassword')).rejects.toThrow();
  });

  it('should create profile after sign up', async () => {
    const email = 'newuser@example.com';
    const password = 'password123';
    const metadata = { timezone: 'America/New_York' };
    const mockUser = createMockUser({ email });

    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({ user: mockUser } as any);
    await signUp(email, password, metadata);

    expect(ensureProfile).toHaveBeenCalledWith(
      expect.any(String),
      email,
      metadata
    );
  });
});


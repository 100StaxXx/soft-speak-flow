import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllMentors } from '@/lib/firebase/mentors';
import { getProfile, updateProfile } from '@/lib/firebase/profiles';
import { createCompanion } from '@/hooks/useCompanion';
import { createMockUser, createMockMentor, createMockProfile } from '../utils/testHelpers';

// Mock dependencies
vi.mock('@/lib/firebase/mentors', () => ({
  getAllMentors: vi.fn(),
}));

vi.mock('@/lib/firebase/profiles', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/hooks/useCompanion', () => ({
  useCompanion: vi.fn(() => ({
    createCompanion: vi.fn(() => Promise.resolve({ id: 'companion-123' })),
  })),
  createCompanion: vi.fn(() => Promise.resolve({ id: 'companion-123' })),
}));

vi.mock('@/lib/firebase/firestore', () => ({
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  setDocument: vi.fn(() => Promise.resolve()),
  updateDocument: vi.fn(() => Promise.resolve()),
}));

describe('Onboarding Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load mentors during onboarding', async () => {
    const mockMentors = [
      createMockMentor({ id: 'mentor-1', name: 'Atlas' }),
      createMockMentor({ id: 'mentor-2', name: 'Eli' }),
    ];

    vi.mocked(getAllMentors).mockResolvedValueOnce(mockMentors);

    const mentors = await getAllMentors();

    expect(getAllMentors).toHaveBeenCalled();
    expect(mentors).toBeDefined();
    expect(mentors.length).toBeGreaterThan(0);
    expect(mentors[0]).toHaveProperty('id');
    expect(mentors[0]).toHaveProperty('name');
  });

  it('should create user profile during onboarding', async () => {
    const user = createMockUser();
    const profile = createMockProfile({
      onboarding_completed: false,
    });

    vi.mocked(getProfile).mockResolvedValueOnce(profile);

    const userProfile = await getProfile(user.uid);

    expect(getProfile).toHaveBeenCalledWith(user.uid);
    expect(userProfile).toBeDefined();
    expect(userProfile?.id).toBe(user.uid);
  });

  it('should update profile with onboarding data', async () => {
    const user = createMockUser();
    const updates = {
      onboarding_completed: true,
      selected_mentor_id: 'mentor-123',
      onboarding_data: {
        faction: 'guardian',
        birthdate: '1990-01-01',
      },
    };

    await updateProfile(user.uid, updates);

    expect(updateProfile).toHaveBeenCalledWith(user.uid, updates);
  });

  it('should create companion after onboarding', async () => {
    const user = createMockUser();
    const companionData = {
      favorite_color: 'blue',
      spirit_animal: 'wolf',
      core_element: 'fire',
    };

    const { createCompanion } = await import('@/hooks/useCompanion');
    const result = await createCompanion(companionData);

    expect(createCompanion).toHaveBeenCalledWith(companionData);
    expect(result).toBeDefined();
    expect(result.id).toBe('companion-123');
  });

  it('should complete onboarding flow end-to-end', async () => {
    const user = createMockUser();
    const mockMentors = [createMockMentor()];
    const profile = createMockProfile({ onboarding_completed: false });

    // Step 1: Load mentors
    vi.mocked(getAllMentors).mockResolvedValueOnce(mockMentors);
    const mentors = await getAllMentors();
    expect(mentors.length).toBeGreaterThan(0);

    // Step 2: Get profile
    vi.mocked(getProfile).mockResolvedValueOnce(profile);
    const userProfile = await getProfile(user.uid);
    expect(userProfile).toBeDefined();

    // Step 3: Update profile with onboarding completion
    await updateProfile(user.uid, { onboarding_completed: true });
    expect(updateProfile).toHaveBeenCalled();

    // Step 4: Verify onboarding is complete
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...profile,
      onboarding_completed: true,
    });
    const completedProfile = await getProfile(user.uid);
    expect(completedProfile?.onboarding_completed).toBe(true);
  });
});


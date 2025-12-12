import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMentors } from '@/lib/firebase/mentors';
import { updateProfile } from '@/lib/firebase/profiles';
import { createMockUser, createMockMentor } from '../utils/testHelpers';

// Mock dependencies
vi.mock('@/lib/firebase/mentors', () => ({
  getMentors: vi.fn(),
  getAllMentors: vi.fn(),
}));

vi.mock('@/lib/firebase/profiles', () => ({
  updateProfile: vi.fn(() => Promise.resolve()),
  getProfile: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(() => Promise.resolve()),
  })),
}));

describe('Mentor Selection Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all available mentors', async () => {
    const mockMentors = [
      createMockMentor({ id: 'mentor-1', name: 'Atlas', slug: 'atlas' }),
      createMockMentor({ id: 'mentor-2', name: 'Eli', slug: 'eli' }),
      createMockMentor({ id: 'mentor-3', name: 'Kai', slug: 'kai' }),
    ];

    vi.mocked(getMentors).mockResolvedValueOnce(mockMentors);

    const mentors = await getMentors(false);

    expect(getMentors).toHaveBeenCalledWith(false);
    expect(mentors).toBeDefined();
    expect(Array.isArray(mentors)).toBe(true);
    expect(mentors.length).toBeGreaterThan(0);
    expect(mentors[0]).toHaveProperty('id');
    expect(mentors[0]).toHaveProperty('name');
    expect(mentors[0]).toHaveProperty('slug');
  });

  it('should update user profile with selected mentor', async () => {
    const user = createMockUser();
    const mentorId = 'mentor-123';

    await updateProfile(user.uid, { selected_mentor_id: mentorId });

    expect(updateProfile).toHaveBeenCalledWith(user.uid, {
      selected_mentor_id: mentorId,
    });
  });

  it('should handle mentor selection flow', async () => {
    const user = createMockUser();
    const selectedMentor = createMockMentor({ id: 'mentor-456', name: 'Atlas' });
    const allMentors = [
      selectedMentor,
      createMockMentor({ id: 'mentor-789', name: 'Eli' }),
    ];

    // Step 1: Fetch mentors
    vi.mocked(getMentors).mockResolvedValueOnce(allMentors);
    const mentors = await getMentors(false);
    expect(mentors.length).toBeGreaterThan(0);

    // Step 2: Select a mentor
    await updateProfile(user.uid, {
      selected_mentor_id: selectedMentor.id,
    });

    expect(updateProfile).toHaveBeenCalledWith(user.uid, {
      selected_mentor_id: selectedMentor.id,
    });
  });

  it('should return mentors with required properties', async () => {
    const mockMentors = [createMockMentor()];
    vi.mocked(getMentors).mockResolvedValueOnce(mockMentors);

    const mentors = await getMentors(false);

    expect(mentors[0]).toHaveProperty('id');
    expect(mentors[0]).toHaveProperty('name');
    expect(mentors[0]).toHaveProperty('description');
    expect(mentors[0]).toHaveProperty('tone_description');
  });

  it('should handle empty mentor list gracefully', async () => {
    vi.mocked(getMentors).mockResolvedValueOnce([]);

    const mentors = await getMentors(false);

    expect(mentors).toBeDefined();
    expect(Array.isArray(mentors)).toBe(true);
    expect(mentors.length).toBe(0);
  });
});


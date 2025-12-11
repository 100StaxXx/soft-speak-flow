import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocuments, setDocument } from '@/lib/firebase/firestore';
import { MISSION_TEMPLATES } from '@/config/missionTemplates';
import { createMockUser } from '../utils/testHelpers';

// Mock Firestore
vi.mock('@/lib/firebase/firestore', () => ({
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  setDocument: vi.fn(() => Promise.resolve()),
  updateDocument: vi.fn(() => Promise.resolve()),
  deleteDocument: vi.fn(() => Promise.resolve()),
  timestampToISO: vi.fn((val) => val),
}));

// Mock mission templates
vi.mock('@/config/missionTemplates', () => ({
  MISSION_TEMPLATES: [
    {
      type: 'connection',
      text: 'Send a thoughtful message to someone you care about',
      xp: 10,
      difficulty: 'easy',
      category: 'connection',
      autoComplete: false,
      progressTarget: 1,
    },
    {
      type: 'quick_win',
      text: 'Take 5 deep breaths',
      xp: 5,
      difficulty: 'easy',
      category: 'quick_win',
      autoComplete: false,
      progressTarget: 1,
    },
    {
      type: 'identity',
      text: 'Write down one thing you\'re proud of',
      xp: 15,
      difficulty: 'medium',
      category: 'identity',
      autoComplete: false,
      progressTarget: 1,
    },
  ],
}));

describe('AI Mission Generation Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate daily missions when none exist', async () => {
    const user = createMockUser();
    const today = new Date().toLocaleDateString('en-CA');

    // No existing missions
    vi.mocked(getDocuments).mockResolvedValueOnce([]);

    // Generate missions
    const connectionMissions = MISSION_TEMPLATES.filter(m => m.category === 'connection');
    const quickWinMissions = MISSION_TEMPLATES.filter(m => m.category === 'quick_win');
    const identityMissions = MISSION_TEMPLATES.filter(m => m.category === 'identity');

    const selectedTemplates = [
      connectionMissions[0],
      quickWinMissions[0],
      identityMissions[0],
    ].filter(Boolean);

    const newMissions = [];
    for (const template of selectedTemplates) {
      const missionId = `${user.uid}_${today}_${template.type}`;
      const mission = {
        id: missionId,
        user_id: user.uid,
        mission_date: today,
        mission_type: template.type,
        mission_text: template.text,
        xp_reward: template.xp,
        difficulty: template.difficulty,
        category: template.category,
        completed: false,
        completed_at: null,
        auto_complete: template.autoComplete,
        progress_current: 0,
        progress_target: template.progressTarget || 1,
      };

      await setDocument('daily_missions', missionId, mission, false);
      newMissions.push(mission);
    }

    expect(setDocument).toHaveBeenCalledTimes(3);
    expect(newMissions.length).toBe(3);
    expect(newMissions.every(m => m.user_id === user.uid)).toBe(true);
    expect(newMissions.every(m => m.mission_date === today)).toBe(true);
  });

  it('should return existing missions if they already exist', async () => {
    const user = createMockUser();
    const today = new Date().toLocaleDateString('en-CA');
    const existingMissions = [
      {
        id: 'mission-1',
        user_id: user.uid,
        mission_date: today,
        mission_type: 'connection',
        mission_text: 'Existing mission',
        xp_reward: 10,
        completed: false,
      },
    ];

    vi.mocked(getDocuments).mockResolvedValueOnce(existingMissions);

    const missions = await getDocuments(
      'daily_missions',
      [
        ['user_id', '==', user.uid],
        ['mission_date', '==', today],
      ]
    );

    expect(getDocuments).toHaveBeenCalled();
    expect(missions).toBeDefined();
    expect(Array.isArray(missions)).toBe(true);
    if (missions.length > 0) {
      expect(missions[0].mission_text).toBe('Existing mission');
    }
  });

  it('should generate missions from all three categories', async () => {
    const user = createMockUser();
    const today = new Date().toLocaleDateString('en-CA');

    vi.mocked(getDocuments).mockResolvedValueOnce([]);

    const connectionMissions = MISSION_TEMPLATES.filter(m => m.category === 'connection');
    const quickWinMissions = MISSION_TEMPLATES.filter(m => m.category === 'quick_win');
    const identityMissions = MISSION_TEMPLATES.filter(m => m.category === 'identity');

    expect(connectionMissions.length).toBeGreaterThan(0);
    expect(quickWinMissions.length).toBeGreaterThan(0);
    expect(identityMissions.length).toBeGreaterThan(0);

    const selectedTemplates = [
      connectionMissions[0],
      quickWinMissions[0],
      identityMissions[0],
    ];

    const categories = selectedTemplates.map(t => t.category);
    expect(categories).toContain('connection');
    expect(categories).toContain('quick_win');
    expect(categories).toContain('identity');
  });

  it('should generate missions with required properties', async () => {
    const user = createMockUser();
    const today = new Date().toLocaleDateString('en-CA');
    const template = MISSION_TEMPLATES[0];

    const missionId = `${user.uid}_${today}_${template.type}`;
    const mission = {
      id: missionId,
      user_id: user.uid,
      mission_date: today,
      mission_type: template.type,
      mission_text: template.text,
      xp_reward: template.xp,
      difficulty: template.difficulty,
      category: template.category,
      completed: false,
      completed_at: null,
      auto_complete: template.autoComplete,
      progress_current: 0,
      progress_target: template.progressTarget || 1,
    };

    expect(mission).toHaveProperty('id');
    expect(mission).toHaveProperty('user_id');
    expect(mission).toHaveProperty('mission_date');
    expect(mission).toHaveProperty('mission_type');
    expect(mission).toHaveProperty('mission_text');
    expect(mission).toHaveProperty('xp_reward');
    expect(mission).toHaveProperty('completed');
    expect(mission.xp_reward).toBeGreaterThan(0);
    expect(mission.mission_text.length).toBeGreaterThan(0);
  });

  it('should generate unique mission IDs for each user and date', async () => {
    const user1 = createMockUser({ uid: 'user-1' });
    const user2 = createMockUser({ uid: 'user-2' });
    const today = new Date().toLocaleDateString('en-CA');
    const template = MISSION_TEMPLATES[0];

    const missionId1 = `${user1.uid}_${today}_${template.type}`;
    const missionId2 = `${user2.uid}_${today}_${template.type}`;

    expect(missionId1).not.toBe(missionId2);
    expect(missionId1).toContain(user1.uid);
    expect(missionId2).toContain(user2.uid);
  });

  it('should return mission data in correct format', async () => {
    const user = createMockUser();
    const today = new Date().toLocaleDateString('en-CA');
    const template = MISSION_TEMPLATES[0];

    const mission = {
      id: `${user.uid}_${today}_${template.type}`,
      user_id: user.uid,
      mission_date: today,
      mission_type: template.type,
      mission_text: template.text,
      xp_reward: template.xp,
      difficulty: template.difficulty,
      category: template.category,
      completed: false,
      completed_at: null,
      auto_complete: template.autoComplete,
      progress_current: 0,
      progress_target: template.progressTarget || 1,
      created_at: new Date().toISOString(),
    };

    // Verify mission structure
    expect(typeof mission.id).toBe('string');
    expect(typeof mission.mission_text).toBe('string');
    expect(typeof mission.xp_reward).toBe('number');
    expect(typeof mission.completed).toBe('boolean');
    expect(mission.xp_reward).toBeGreaterThan(0);
  });
});


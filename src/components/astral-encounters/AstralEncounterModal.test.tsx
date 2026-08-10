import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AstralEncounterModal } from './AstralEncounterModal';
import { getBundledCompanionImageFocalPoint } from '@/lib/companionImageFocal';

const battleVsPropsSpy = vi.hoisted(() => vi.fn());
const resultPropsSpy = vi.hoisted(() => vi.fn());
const useCompanionMock = vi.hoisted(() => vi.fn());
const refetchCompanionMock = vi.hoisted(() => vi.fn());
const onCompleteMock = vi.hoisted(() =>
  vi.fn(async () => ({
    persisted: true,
    xpAwarded: 42,
    xpCapApplied: false,
  })),
);
const battleStateHookValue = vi.hoisted(() => ({
  battleState: {
    playerHP: 100,
    playerMaxHP: 100,
    adversaryHP: 0,
    adversaryMaxHP: 100,
    isPlayerDefeated: false,
    isAdversaryDefeated: false,
    playerHPPercent: 100,
    adversaryHPPercent: 0,
  },
  dealDamage: vi.fn(),
  resetBattle: vi.fn(),
  getResult: vi.fn(() => 'good'),
  tierAttackDamage: 10,
  damageEvents: [],
}));

vi.mock('framer-motion', () => {
  const passthrough = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const {
      animate: _animate,
      exit: _exit,
      initial: _initial,
      layout: _layout,
      transition: _transition,
      variants: _variants,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...domProps
    } = props;

    return <div {...domProps}>{children}</div>;
  };

  const motionProxy = new Proxy(
    {},
    {
      get: () => passthrough,
    },
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: React.PropsWithChildren<{ open?: boolean }>) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('./BattleVSScreen', () => ({
  BattleVSScreen: (props: Record<string, unknown> & { onReady: () => void }) => {
    battleVsPropsSpy(props);
    return (
      <button data-testid="battle-vs-ready" onClick={props.onReady}>
        Battle VS
      </button>
    );
  },
}));

vi.mock('./EncounterResult', () => ({
  EncounterResultScreen: (props: Record<string, unknown>) => {
    resultPropsSpy(props);
    return <div data-testid="encounter-result-screen">Encounter Result</div>;
  },
}));

vi.mock('./GameInstructionsOverlay', () => ({
  GameInstructionsOverlay: ({ onReady }: { onReady: () => void }) => (
    <button data-testid="instructions-ready" onClick={onReady}>
      Instructions Ready
    </button>
  ),
}));

vi.mock('./PracticeRoundWrapper', () => ({
  PracticeRoundWrapper: ({ onPracticeComplete }: { onPracticeComplete: () => void }) => (
    <button data-testid="practice-complete" onClick={onPracticeComplete}>
      Practice Complete
    </button>
  ),
}));

vi.mock('./EnergyBeamGame', () => ({
  EnergyBeamGame: () => <div data-testid="energy-beam-game">Energy Beam</div>,
}));

vi.mock('./battle', () => ({
  BattleOverlay: () => null,
  DamageNumberContainer: () => null,
}));

vi.mock('@/components/narrative/BossBattleIntro', () => ({
  BossBattleIntro: () => <div>Boss Intro</div>,
}));

vi.mock('@/components/skeletons', () => ({
  MiniGameSkeleton: () => <div>Loading Game</div>,
}));

vi.mock('./fullscreenGames', () => ({
  isFullscreenEncounterGame: () => false,
}));

vi.mock('@/hooks/useCompanion', () => ({
  useCompanion: (...args: unknown[]) => useCompanionMock(...args),
}));

vi.mock('@/hooks/useAdversaryImage', () => ({
  useAdversaryImage: () => ({ imageUrl: '/adversaries/slumber-wraith.png' }),
}));

vi.mock('@/hooks/useBattleState', () => ({
  useBattleState: () => battleStateHookValue,
}));

vi.mock('@/utils/adversaryGenerator', () => ({
  calculateXPReward: () => 42,
}));

vi.mock('@/types/battleSystem', () => ({
  TIER_BATTLE_DURATION: {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  },
}));

const baseEncounter = {
  id: 'encounter-1',
  user_id: 'user-1',
  companion_id: 'companion-1',
  adversary_name: 'Slumber Wraith',
  adversary_theme: 'laziness',
  adversary_tier: 'uncommon',
  adversary_lore: null,
  mini_game_type: 'energy_beam',
  trigger_type: 'quest_milestone',
  trigger_source_id: null,
  result: null,
  accuracy_score: null,
  xp_earned: 0,
  essence_earned: null,
  stat_boost_type: null,
  stat_boost_amount: 0,
  phases_completed: 0,
  total_phases: 1,
  started_at: '2026-04-06T00:00:00.000Z',
  completed_at: null,
  retry_available_at: null,
  created_at: '2026-04-06T00:00:00.000Z',
};

const baseAdversary = {
  name: 'Slumber Wraith',
  theme: 'laziness',
  tier: 'uncommon',
  lore: 'Feeds on hesitation.',
  miniGameType: 'energy_beam',
  phases: 1,
  essenceName: 'Body',
  essenceDescription: 'Momentum over inertia.',
  statType: 'body',
  statBoost: 2,
} as const;

const baseCompanion = {
  id: 'companion-1',
  user_id: 'user-1',
  preset_id: 'fox',
  favorite_color: '#33cc66',
  spirit_animal: 'Fox',
  core_element: 'nature',
  story_tone: 'epic_adventure',
  current_stage: 1,
  current_xp: 14,
  current_image_url: '/companion-eggs/egg__t0_egg__normal__nature.png',
  current_image_focal_x: 0.12,
  current_image_focal_y: 0.34,
  initial_image_url: '/companion-eggs/egg__t0_egg__normal__nature.png',
  initial_image_focal_x: 0.5,
  initial_image_focal_y: 0.45,
  created_at: '2026-04-06T00:00:00.000Z',
  updated_at: '2026-04-06T00:00:00.000Z',
};

const renderModal = (companionOverrides: Record<string, unknown> = {}) => {
  useCompanionMock.mockReturnValue({
    companion: {
      ...baseCompanion,
      ...companionOverrides,
    },
    refetch: refetchCompanionMock,
  });

  return render(
    <AstralEncounterModal
      open
      onOpenChange={vi.fn()}
      encounter={baseEncounter}
      adversary={baseAdversary}
      onComplete={onCompleteMock}
    />,
  );
};

const getLastBattleProps = () => {
  const lastCall = battleVsPropsSpy.mock.calls.at(-1);
  expect(lastCall).toBeTruthy();
  return lastCall?.[0] as Record<string, unknown>;
};

const getLastResultProps = () => {
  const lastCall = resultPropsSpy.mock.calls.at(-1);
  expect(lastCall).toBeTruthy();
  return lastCall?.[0] as Record<string, unknown>;
};

const progressToResult = async () => {
  fireEvent.click(screen.getByTestId('battle-vs-ready'));

  await waitFor(() => {
    expect(screen.getByTestId('instructions-ready')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId('instructions-ready'));

  const practiceButton = screen.queryByTestId('practice-complete');
  if (practiceButton) {
    fireEvent.click(practiceButton);
  }

  await waitFor(() => {
    expect(screen.getByTestId('encounter-result-screen')).toBeInTheDocument();
  });
};

describe('AstralEncounterModal companion portrait resolution', () => {
  beforeEach(() => {
    battleVsPropsSpy.mockClear();
    resultPropsSpy.mockClear();
    useCompanionMock.mockReset();
    refetchCompanionMock.mockReset();
    onCompleteMock.mockClear();
    onCompleteMock.mockResolvedValue({
      persisted: true,
      xpAwarded: 42,
      xpCapApplied: false,
    });
    battleStateHookValue.dealDamage.mockReset();
    battleStateHookValue.resetBattle.mockReset();
    battleStateHookValue.getResult.mockClear();
  });

  it('uses hatchling preset art on the reveal screen when stage 1 data still stores egg art', () => {
    renderModal();

    const expectedImageUrl = '/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png';
    const expectedFocal = getBundledCompanionImageFocalPoint(expectedImageUrl);
    const props = getLastBattleProps();

    expect(props.companionImageUrl).toBe(expectedImageUrl);
    expect(props.companionImageFocalX).toBe(expectedFocal?.x ?? null);
    expect(props.companionImageFocalY).toBe(expectedFocal?.y ?? null);
  });

  it('keeps hatchling preset art on the result screen when stage 1 data still stores egg art', async () => {
    renderModal();

    await progressToResult();

    const expectedImageUrl = '/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png';
    const expectedFocal = getBundledCompanionImageFocalPoint(expectedImageUrl);
    const props = getLastResultProps();

    expect(props.companionImageUrl).toBe(expectedImageUrl);
    expect(props.companionImageFocalX).toBe(expectedFocal?.x ?? null);
    expect(props.companionImageFocalY).toBe(expectedFocal?.y ?? null);
  });

  it('keeps stage 0 companions on shared egg art even when a preset-backed image URL is stale', () => {
    renderModal({
      current_stage: 0,
      current_image_url:
        'https://example.supabase.co/storage/v1/object/public/companion-presets/dragon/t0_egg/normal/dragon__t0_egg__normal__light.png',
      preset_id: 'dragon',
      core_element: 'light',
    });

    const props = getLastBattleProps();
    expect(props.companionImageUrl).toBe('/companion-eggs/v2/egg__t0_egg__normal__light.webp');
  });

  it('passes through already-correct stage 1 hatchling art', () => {
    renderModal({
      current_image_url: '/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png',
    });

    const props = getLastBattleProps();
    expect(props.companionImageUrl).toBe('/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png');
  });
});

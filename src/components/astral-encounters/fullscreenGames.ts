import { MiniGameType } from '@/types/astralEncounters';

export const FULLSCREEN_ENCOUNTER_GAMES: MiniGameType[] = [
  'energy_beam',
  'tap_sequence',
  'orb_match',
  'galactic_match',
  'astral_frequency',
  'starfall_dodge',
];

export const FLOW_LAYOUT_FULLSCREEN_ENCOUNTER_GAMES: MiniGameType[] = [
  'energy_beam',
  'tap_sequence',
  'orb_match',
  'galactic_match',
];

const fullscreenEncounterGameSet = new Set<MiniGameType>(FULLSCREEN_ENCOUNTER_GAMES);
const flowLayoutFullscreenEncounterGameSet = new Set<MiniGameType>(FLOW_LAYOUT_FULLSCREEN_ENCOUNTER_GAMES);

export const isFullscreenEncounterGame = (gameType: MiniGameType): boolean =>
  fullscreenEncounterGameSet.has(gameType);

export const usesFlowLayoutFullscreenShell = (gameType: MiniGameType): boolean =>
  flowLayoutFullscreenEncounterGameSet.has(gameType);

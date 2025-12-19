// Core encounter components (always needed when using encounters)
export { AstralEncounterModal } from './AstralEncounterModal';
export { AdversaryReveal } from './AdversaryReveal';
export { EncounterResultScreen } from './EncounterResult';
export { GameInstructionsOverlay } from './GameInstructionsOverlay';
export { PracticeRoundWrapper } from './PracticeRoundWrapper';
export { BattleSceneHeader } from './BattleSceneHeader';
export { BattleVSScreen } from './BattleVSScreen';
export { AstralEncounterTriggerOverlay } from './AstralEncounterTriggerOverlay';

// Supporting components
export { CosmicCodex } from './CosmicCodex';
export { EncounterHistory } from './EncounterHistory';
export { AstralEncounterProvider } from './AstralEncounterProvider';
export { GameHUD, CountdownOverlay, ScorePopup, PauseOverlay } from './GameHUD';

// Utilities (tree-shakeable)
export { 
  useScreenShake, 
  triggerHaptic, 
  useGameLoop, 
  useGameTimer, 
  useParticleSystem, 
  useStaticStars,
  useDebouncedCallback,
  getGridPositions
} from './gameUtils';

// ⚠️ MINI-GAMES ARE NOT EXPORTED HERE FOR BUNDLE SIZE OPTIMIZATION
// Import them directly when needed:
// const EnergyBeamGame = lazy(() => import('@/components/astral-encounters/EnergyBeamGame'));

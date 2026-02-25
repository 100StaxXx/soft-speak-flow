export const NEAR_EVOLUTION_PROGRESS_THRESHOLD = 97;

interface NearEvolutionArgs {
  progressToNext: number;
  canEvolve: boolean;
}

export const isNearEvolution = ({ progressToNext, canEvolve }: NearEvolutionArgs): boolean => (
  !canEvolve && progressToNext >= NEAR_EVOLUTION_PROGRESS_THRESHOLD
);

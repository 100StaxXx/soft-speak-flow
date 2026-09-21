import { createContext, useContext } from 'react';
import { QUEST_FORM_STYLES, DIFFICULTY_COLORS } from '@/components/quest-shared';
import { usePlannerPathfinderAppearance } from '@/hooks/usePlannerPathfinderAppearance';
import { plannerPathfinderTheme } from './plannerPathfinderTheme';

// Only Pathfinder opts in. Shared planner/chat controls retain their existing theme.
export const PathfinderSurfaceContext = createContext(false);
export const pathfinderSurface = {
  ...plannerPathfinderTheme,
  shell: `${QUEST_FORM_STYLES.sheet} relative min-w-0 overflow-hidden rounded-2xl`,
  shellGloss: 'hidden',
  shellGlow: 'hidden',
  shellBody: 'relative flex min-h-0 min-w-0 flex-col',
  headerBar: 'flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4',
  contentWell: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
  footerBar: 'shrink-0 border-t border-white/10 bg-[#171c24] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
  raisedPanel: 'rounded-xl border border-white/10 bg-white/[0.03] text-foreground shadow-none',
  mutedPanel: 'rounded-xl bg-white/[0.03] text-foreground shadow-none',
  successCard: 'rounded-xl border border-white/10 bg-white/5 text-foreground shadow-none',
  primaryButton: `min-h-11 rounded-xl ${DIFFICULTY_COLORS.medium.primaryButton}`,
  outlineButton: `min-h-11 ${QUEST_FORM_STYLES.secondaryButton}`,
  headerIconButton: QUEST_FORM_STYLES.mobileHeaderUtilityButton,
  textField: 'rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-base text-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0',
  portalSurface: QUEST_FORM_STYLES.popover,
  chip: QUEST_FORM_STYLES.subtleBadge,
  sectionEyebrow: 'text-xs font-medium text-muted-foreground',
};

export function usePlannerSurface() {
  const isPathfinder = useContext(PathfinderSurfaceContext);
  const appearance = usePlannerPathfinderAppearance();
  return {
    plannerPathfinderTheme: isPathfinder ? pathfinderSurface : plannerPathfinderTheme,
    themeModeClassName: isPathfinder ? 'agenda-quest-theme' : appearance.themeModeClassName,
  };
}

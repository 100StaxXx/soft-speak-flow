import { Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Difficulty color helpers ---
export const DIFFICULTY_COLORS = {
  easy: {
    bg: "bg-[radial-gradient(circle_at_top_left,hsl(var(--epic-nature)_/_0.14),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] shadow-[0_8px_0_hsl(var(--epic-nature)_/_0.42),0_18px_34px_-28px_hsl(var(--category-soul)_/_0.45)]",
    text: "text-foreground",
    pill: "border-epic-nature/60 bg-[linear-gradient(180deg,hsl(var(--epic-nature)_/_0.22)_0%,hsl(var(--category-soul)_/_0.14)_100%)] text-foreground",
    border: "border-epic-nature/60",
    difficultyActive: "border-epic-nature/70 bg-[linear-gradient(180deg,hsl(var(--epic-nature)_/_0.28)_0%,hsl(var(--category-soul)_/_0.18)_100%)] text-foreground shadow-[0_5px_0_hsl(var(--epic-nature)_/_0.38)]",
    iconBubble: "border-epic-nature/50 bg-background/45 text-epic-nature",
    primaryButton: "border-[3px] border-epic-nature/75 bg-[linear-gradient(180deg,hsl(var(--epic-nature))_0%,hsl(var(--category-soul))_100%)] text-[hsl(var(--deep-space))] shadow-[0_6px_0_hsl(var(--epic-nature)_/_0.44)] hover:bg-[linear-gradient(180deg,hsl(var(--epic-nature))_0%,hsl(var(--category-soul))_100%)]",
    primaryButtonDisabled: "border-[3px] border-stage-tier-2/25 bg-muted/35 text-muted-foreground shadow-none",
    highlightBadge: "border-epic-nature/40 bg-epic-nature/15",
  },
  medium: {
    bg: "bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.14),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.4),0_18px_34px_-28px_hsl(var(--nebula-pink)_/_0.42)]",
    text: "text-foreground",
    pill: "border-stardust-gold/65 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.24)_0%,hsl(var(--nebula-pink)_/_0.16)_100%)] text-foreground",
    border: "border-stardust-gold/65",
    difficultyActive: "border-stardust-gold/75 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.28)_0%,hsl(var(--nebula-pink)_/_0.18)_100%)] text-foreground shadow-[0_5px_0_hsl(var(--stardust-gold)_/_0.36)]",
    iconBubble: "border-stardust-gold/55 bg-background/45 text-stardust-gold",
    primaryButton: "border-[3px] border-stardust-gold/75 bg-[linear-gradient(180deg,hsl(var(--stardust-gold))_0%,hsl(var(--nebula-pink))_100%)] text-[hsl(var(--deep-space))] shadow-[0_6px_0_hsl(var(--stardust-gold)_/_0.44)] hover:bg-[linear-gradient(180deg,hsl(var(--stardust-gold))_0%,hsl(var(--nebula-pink))_100%)]",
    primaryButtonDisabled: "border-[3px] border-stage-tier-2/25 bg-muted/35 text-muted-foreground shadow-none",
    highlightBadge: "border-stardust-gold/40 bg-stardust-gold/15",
  },
  hard: {
    bg: "bg-[radial-gradient(circle_at_top_left,hsl(var(--category-body)_/_0.14),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] shadow-[0_8px_0_hsl(var(--category-body)_/_0.4),0_18px_34px_-28px_hsl(var(--destructive)_/_0.42)]",
    text: "text-foreground",
    pill: "border-category-body/65 bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.22)_0%,hsl(var(--destructive)_/_0.16)_100%)] text-foreground",
    border: "border-category-body/65",
    difficultyActive: "border-category-body/75 bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.26)_0%,hsl(var(--destructive)_/_0.18)_100%)] text-foreground shadow-[0_5px_0_hsl(var(--category-body)_/_0.36)]",
    iconBubble: "border-category-body/55 bg-background/45 text-category-body",
    primaryButton: "border-[3px] border-category-body/75 bg-[linear-gradient(180deg,hsl(var(--category-body))_0%,hsl(var(--epic-warrior))_100%)] text-[hsl(var(--deep-space))] shadow-[0_6px_0_hsl(var(--category-body)_/_0.44)] hover:bg-[linear-gradient(180deg,hsl(var(--category-body))_0%,hsl(var(--epic-warrior))_100%)]",
    primaryButtonDisabled: "border-[3px] border-stage-tier-2/25 bg-muted/35 text-muted-foreground shadow-none",
    highlightBadge: "border-category-body/40 bg-category-body/12",
  },
} as const;

export type QuestFormDifficulty = keyof typeof DIFFICULTY_COLORS;
export type QuestComposerPresentation = "mobile-sheet" | "desktop-panel";

export const DifficultyIconMap = {
  easy: Zap,
  medium: Flame,
  hard: Mountain,
} as const;

export const QUEST_FORM_STYLES = {
  sheet:
    "border-[4px] border-celestial-blue/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.22),transparent_24%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.16),transparent_28%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.18),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_62%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_-14px_0_hsl(var(--stardust-gold)_/_0.42),0_-28px_70px_-36px_hsl(var(--celestial-blue)_/_0.5)]",
  body:
    "bg-[radial-gradient(circle_at_top_right,hsl(var(--category-soul)_/_0.08),transparent_30%),radial-gradient(circle_at_bottom_left,hsl(var(--epic-nature)_/_0.08),transparent_34%),linear-gradient(180deg,hsl(var(--card)_/_0.98),hsl(var(--secondary)_/_0.92))] text-foreground",
  sectionCard:
    "rounded-[1.6rem] border-[3px] border-stardust-gold/45 bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.1),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--nebula-pink)_/_0.1),transparent_34%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] text-foreground shadow-[0_8px_0_hsl(var(--epic-nature)_/_0.34),0_18px_34px_-28px_hsl(var(--stardust-gold)_/_0.38)]",
  sectionCardSoft:
    "rounded-[1.35rem] border-[3px] border-celestial-blue/30 bg-card/70 text-foreground shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.16)]",
  insetPanel:
    "rounded-[1.15rem] border-2 border-category-soul/35 bg-background/50 shadow-[inset_0_3px_0_hsl(var(--stardust-gold)_/_0.1)]",
  heroIcon:
    "inline-flex h-11 w-11 items-center justify-center rounded-[14px] border-[3px] border-stardust-gold/60 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.28)_0%,hsl(var(--nebula-pink)_/_0.16)_55%,hsl(var(--epic-nature)_/_0.14)_100%)] text-stardust-gold shadow-[0_5px_0_hsl(var(--stardust-gold)_/_0.36)]",
  heroAction:
    "inline-flex items-center gap-1.5 rounded-[15px] border-[3px] border-stardust-gold/55 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.26)_0%,hsl(var(--nebula-pink)_/_0.16)_50%,hsl(var(--category-soul)_/_0.14)_100%)] px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.34)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.32)_0%,hsl(var(--nebula-pink)_/_0.22)_55%,hsl(var(--category-soul)_/_0.18)_100%)] active:translate-y-0 active:shadow-[0_2px_0_hsl(var(--stardust-gold)_/_0.34)] motion-reduce:transition-none",
  titleFieldShell:
    "w-full rounded-[20px] border-[3px] border-celestial-blue/50 bg-background/35 p-[2px] shadow-[inset_0_3px_0_hsl(var(--stardust-gold)_/_0.1)]",
  titleFieldInner:
    "rounded-[17px] border border-border/60 bg-card/80 px-2.5 py-1",
  titleInput:
    "h-9 border-0 bg-transparent px-3 text-[15px] font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
  selectorChip:
    "rounded-[18px] border-[3px] border-category-soul/50 bg-[linear-gradient(180deg,hsl(var(--card)_/_0.92),hsl(var(--secondary)_/_0.84))] px-4 py-3 text-foreground shadow-[0_5px_0_hsl(var(--stardust-gold)_/_0.22),inset_0_3px_0_hsl(var(--celestial-blue)_/_0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-stardust-gold/55 hover:bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--secondary)_/_0.92))] motion-reduce:transition-none",
  selectorChipMuted:
    "border-dashed text-muted-foreground",
  timeWheel:
    "relative h-[180px] overflow-y-auto rounded-[20px] border-[3px] border-celestial-blue/45 bg-background/60 shadow-[0_8px_0_hsl(var(--category-soul)_/_0.18)] snap-y snap-mandatory scrollbar-none",
  timeWheelFadeTop:
    "sticky top-0 h-12 bg-gradient-to-b from-[hsl(var(--card)_/_0.98)] via-[hsl(var(--card)_/_0.82)] to-transparent z-10 pointer-events-none",
  timeWheelFadeBottom:
    "sticky bottom-0 h-12 bg-gradient-to-t from-[hsl(var(--card)_/_0.98)] via-[hsl(var(--card)_/_0.82)] to-transparent z-10 pointer-events-none",
  optionPill:
    "rounded-[14px] border-[3px] border-border/70 bg-card/70 px-4 py-2 text-sm font-semibold text-foreground shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.16)] transition-all duration-200 ease-out hover:bg-card motion-reduce:transition-none",
  optionPillCompact:
    "rounded-[13px] border-[3px] border-border/70 bg-card/70 px-3 py-2 text-sm font-semibold text-foreground shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.16)] transition-all duration-200 ease-out hover:bg-card motion-reduce:transition-none",
  difficultyButton:
    "relative flex min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-[16px] border-[3px] px-2.5 py-2 text-center transition-all duration-200 ease-out active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  difficultyButtonInactive:
    "border-stage-tier-2/35 bg-card/70 text-muted-foreground shadow-[0_4px_0_hsl(var(--category-soul)_/_0.14)] hover:bg-card hover:text-foreground",
  difficultyIconBubble:
    "flex h-6.5 w-6.5 items-center justify-center rounded-[999px] border-2 border-border/60 bg-background/45",
  footerReview:
    "rounded-[18px] border-[3px] border-stardust-gold/35 bg-card/70 px-4 py-3 text-foreground shadow-[0_5px_0_hsl(var(--epic-nature)_/_0.16)]",
  secondaryButton:
    "rounded-[18px] border-[3px] border-celestial-blue/35 bg-card/70 text-foreground shadow-[0_5px_0_hsl(var(--stardust-gold)_/_0.16)] transition-all duration-200 ease-out hover:border-stardust-gold/45 hover:bg-card hover:text-foreground motion-reduce:transition-none",
  iconSecondaryButton:
    "rounded-[18px] border-[3px] border-celestial-blue/35 bg-card/70 text-foreground shadow-[0_5px_0_hsl(var(--stardust-gold)_/_0.16)] transition-all duration-200 ease-out hover:border-stardust-gold/45 hover:bg-card hover:text-foreground motion-reduce:transition-none",
  advancedTrigger:
    "w-full justify-between rounded-[18px] border-[3px] border-nebula-pink/35 bg-card/70 px-4 py-3 text-foreground shadow-[0_5px_0_hsl(var(--category-soul)_/_0.16)] hover:border-stardust-gold/45 hover:bg-card",
  helperText: "text-[12px] leading-5 text-muted-foreground",
  label: "text-[13px] font-semibold tracking-[0.01em] text-foreground",
  divider: "border-border/50",
  subtleBadge:
    "inline-flex items-center rounded-full border border-border/60 bg-secondary/45 px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
  popover:
    "rounded-[20px] border-[3px] border-nebula-pink/45 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.12),transparent_32%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] p-2 text-foreground shadow-[0_10px_0_hsl(var(--category-soul)_/_0.34),0_22px_34px_-28px_hsl(var(--nebula-pink)_/_0.38)]",
  footerLink:
    "text-sm text-stardust-gold transition-colors hover:text-foreground",
  mobileHeader:
    "relative isolate overflow-hidden border-b-[3px] border-category-soul/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.22),transparent_30%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.18),transparent_34%),linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.2),hsl(var(--epic-nature)_/_0.1))]",
  mobileHeaderGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.28),transparent_70%)]",
  mobileHeaderUtilityButton:
    "rounded-[14px] border-[3px] border-nebula-pink/45 bg-[linear-gradient(180deg,hsl(var(--nebula-pink)_/_0.2),hsl(var(--category-soul)_/_0.14))] p-2 text-foreground shadow-[0_4px_0_hsl(var(--nebula-pink)_/_0.38)] transition-all duration-200 ease-out hover:bg-[linear-gradient(180deg,hsl(var(--nebula-pink)_/_0.26),hsl(var(--category-soul)_/_0.2))] active:translate-y-0.5 motion-reduce:transition-none",
  mobileHeaderKicker:
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-stardust-gold/90",
  mobileHeaderSummary:
    "mt-1 text-sm text-muted-foreground",
  mobileHeaderToolbar:
    "mt-2 flex items-center justify-between gap-2",
  mobileDifficultyGroup:
    "mt-3 inline-flex w-full items-stretch gap-1.5 rounded-[20px] border-[3px] border-stardust-gold/45 bg-background/35 p-1.5 shadow-[inset_0_3px_0_hsl(var(--category-soul)_/_0.08)]",
  desktopPanelShell:
    "border-[4px] border-celestial-blue/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.22),transparent_24%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.16),transparent_28%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.18),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_62%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_18px_0_hsl(var(--stardust-gold)_/_0.42),0_34px_90px_-36px_hsl(var(--celestial-blue)_/_0.5)]",
  desktopPanelHeader:
    "border-b-[3px] border-category-soul/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.2),transparent_30%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.16),transparent_34%),linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.18),hsl(var(--epic-nature)_/_0.1))]",
  desktopPanelHeaderCard:
    "rounded-[22px] border-[3px] border-stardust-gold/45 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.16),hsl(var(--nebula-pink)_/_0.1),hsl(var(--category-soul)_/_0.08))] p-4 shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.38)]",
  desktopPanelFooter:
    "border-t-[3px] border-category-soul/45 bg-[linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.12),hsl(var(--stardust-gold)_/_0.08),hsl(var(--epic-nature)_/_0.08))]",
  desktopPanelCloseButton:
    "rounded-[14px] border-[3px] border-nebula-pink/45 bg-[linear-gradient(180deg,hsl(var(--nebula-pink)_/_0.2),hsl(var(--category-soul)_/_0.14))] p-2 text-foreground shadow-[0_4px_0_hsl(var(--nebula-pink)_/_0.38)] transition-all duration-200 ease-out hover:bg-[linear-gradient(180deg,hsl(var(--nebula-pink)_/_0.26),hsl(var(--category-soul)_/_0.2))] active:translate-y-0.5 motion-reduce:transition-none",
  desktopPanelToolbarButton:
    "inline-flex items-center gap-2 rounded-[14px] border-[3px] border-stardust-gold/55 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.26)_0%,hsl(var(--nebula-pink)_/_0.16)_55%,hsl(var(--category-soul)_/_0.14)_100%)] px-3 py-2 text-sm font-semibold text-foreground shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.34)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.32)_0%,hsl(var(--nebula-pink)_/_0.22)_55%,hsl(var(--category-soul)_/_0.18)_100%)] motion-reduce:transition-none",
  desktopPanelInput:
    "h-11 rounded-[16px] border-[3px] border-celestial-blue/45 bg-card/80 px-4 text-[15px] font-semibold text-foreground placeholder:text-muted-foreground focus-visible:border-stardust-gold/70 focus-visible:ring-2 focus-visible:ring-stardust-gold/35 focus-visible:ring-offset-0",
} as const;

export const QUEST_TEMPLATE_BROWSER_STYLES = {
  header:
    "border-b-[3px] border-category-soul/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.2),transparent_30%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.16),transparent_34%),linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.18),hsl(var(--epic-nature)_/_0.1))] shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.38)]",
  tabList:
    "grid w-full grid-cols-2 rounded-[22px] border-[3px] border-celestial-blue/35 bg-background/45 p-1 shadow-[inset_0_3px_0_hsl(var(--stardust-gold)_/_0.08)]",
  tabTrigger:
    "rounded-[18px] text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:border-[3px] data-[state=active]:border-stardust-gold/55 data-[state=active]:bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.26)_0%,hsl(var(--nebula-pink)_/_0.16)_55%,hsl(var(--category-soul)_/_0.14)_100%)] data-[state=active]:text-foreground data-[state=active]:shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.28)]",
  searchInput: "border-[3px] border-celestial-blue/45 bg-card/80 text-foreground placeholder:text-muted-foreground focus-visible:border-stardust-gold/65 focus-visible:ring-stardust-gold/35",
  filterChip:
    "shrink-0 rounded-full border-[3px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
  filterChipActive: "border-stardust-gold/55 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.26)_0%,hsl(var(--nebula-pink)_/_0.16)_55%,hsl(var(--category-soul)_/_0.14)_100%)] text-foreground shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.28)]",
  filterChipInactive: "border-border/70 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground",
  row:
    "w-full rounded-[22px] border-[3px] px-4 py-4 text-left transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  rowHighlighted:
    "border-stardust-gold/45 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.12),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--nebula-pink)_/_0.1),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] text-foreground shadow-[0_8px_0_hsl(var(--epic-nature)_/_0.34),0_18px_34px_-28px_hsl(var(--stardust-gold)_/_0.38)]",
  rowDefault:
    "border-celestial-blue/30 bg-card/70 text-foreground shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.16)]",
  emptyState:
    "rounded-[22px] border-[3px] border-dashed border-border/70 bg-card/45 px-5 py-10 text-center shadow-[inset_0_3px_0_hsl(var(--foreground)_/_0.06)]",
} as const;

export function getQuestDifficultyOptionClasses(
  difficulty: QuestFormDifficulty,
  active: boolean,
): string {
  return cn(
    QUEST_FORM_STYLES.difficultyButton,
    active ? DIFFICULTY_COLORS[difficulty].difficultyActive : QUEST_FORM_STYLES.difficultyButtonInactive,
  );
}

export function getQuestDifficultyIconClasses(
  difficulty: QuestFormDifficulty,
  active: boolean,
): string {
  return cn(
    QUEST_FORM_STYLES.difficultyIconBubble,
    active ? DIFFICULTY_COLORS[difficulty].iconBubble : "border-border/60 bg-background/45 text-muted-foreground",
  );
}

export function getQuestOptionPillClasses(
  active: boolean,
  activeTone?: string,
  compact = false,
): string {
  return cn(
    compact ? QUEST_FORM_STYLES.optionPillCompact : QUEST_FORM_STYLES.optionPill,
    active
      ? cn(activeTone ?? DIFFICULTY_COLORS.medium.pill, "shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.18)]")
      : "",
  );
}

export function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export function getNextHalfHourTime(baseDate: Date = new Date()): string {
  const rounded = new Date(baseDate);
  rounded.setSeconds(0, 0);

  const minutes = rounded.getMinutes();
  const remainder = minutes % 30;

  if (remainder !== 0) {
    rounded.setMinutes(minutes + (30 - remainder));
  }

  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`;
}

export function centerSelectedTimeInWheel(
  wheelElement: HTMLDivElement | null,
  selectedTime: string | null,
  behavior: ScrollBehavior = "smooth",
): void {
  if (!wheelElement || !selectedTime) return;

  const selectedSlot = wheelElement.querySelector<HTMLButtonElement>(`[data-time-slot="${selectedTime}"]`);
  if (!selectedSlot) return;

  const containerHeight = wheelElement.clientHeight;
  const slotCenter = selectedSlot.offsetTop + selectedSlot.offsetHeight / 2;
  const targetTop = slotCenter - containerHeight / 2;
  const maxTop = Math.max(0, wheelElement.scrollHeight - containerHeight);
  const clampedTop = Math.min(Math.max(0, targetTop), maxTop);

  wheelElement.scrollTo({ top: clampedTop, behavior });
}

export const TIME_SLOTS = generateTimeSlots();

export const DURATION_OPTIONS = [
  { label: "1m", value: 1 },
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "All Day", value: 1440 },
  { label: "Custom", value: -1 },
];

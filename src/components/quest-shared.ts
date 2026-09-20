import { Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

const surface = "rounded-xl border border-white/10 bg-white/5 shadow-none";
const control = "rounded-xl border border-white/10 bg-white/5 text-foreground shadow-none transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70";
const active = "border-primary/50 bg-primary/15 text-foreground shadow-none";
const primary = "border border-primary/40 bg-primary text-white shadow-none hover:bg-primary/90";
const disabled = "border border-white/10 bg-white/5 text-muted-foreground shadow-none";
const difficulty = {
  bg: "bg-white/5 shadow-none", text: "text-foreground", pill: active,
  border: "border-white/15", difficultyActive: active,
  iconBubble: "border-transparent bg-transparent text-primary",
  primaryButton: primary, primaryButtonDisabled: disabled,
  highlightBadge: "border-white/10 bg-white/5",
};
export const DIFFICULTY_COLORS = { easy: difficulty, medium: difficulty, hard: difficulty } as const;
export type QuestFormDifficulty = keyof typeof DIFFICULTY_COLORS;
export type QuestComposerPresentation = "mobile-sheet" | "desktop-panel";
export const DifficultyIconMap = { easy: Zap, medium: Flame, hard: Mountain } as const;

export const QUEST_FORM_STYLES = {
  sheet: "agenda-quest-theme border border-white/10 bg-[#171c24]/95 text-foreground shadow-2xl backdrop-blur-2xl font-body",
  body: "bg-transparent text-foreground",
  sectionCard: cn("agenda-quest-theme", surface, "bg-[#202630]/95 text-foreground"),
  sectionCardSoft: cn(surface, "text-foreground"),
  insetPanel: "rounded-lg border border-white/10 bg-black/10",
  heroIcon: "inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-muted-foreground",
  heroAction: cn(control, "inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-medium"),
  titleFieldShell: "w-full border-b border-white/15 pb-1",
  titleFieldInner: "bg-transparent",
  titleInput: "h-11 border-0 bg-transparent px-1 text-lg font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
  selectorChip: cn(control, "min-h-11 px-4 py-3"),
  selectorChipMuted: "text-muted-foreground",
  timeWheel: cn(surface, "relative h-[180px] overflow-y-auto snap-y snap-mandatory scrollbar-none"),
  timeWheelFadeTop: "sticky top-0 h-12 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none",
  timeWheelFadeBottom: "sticky bottom-0 h-12 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none",
  optionPill: cn(control, "px-4 py-2 text-sm font-medium"),
  optionPillCompact: cn(control, "px-3 py-2 text-sm font-medium"),
  difficultyButton: "relative flex min-h-11 min-w-[72px] flex-row items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  difficultyButtonInactive: "border-transparent bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
  difficultyIconBubble: "flex h-5 w-5 items-center justify-center",
  footerReview: cn(surface, "px-4 py-3 text-foreground"),
  secondaryButton: control,
  iconSecondaryButton: control,
  advancedTrigger: cn(control, "w-full justify-between px-4 py-3"),
  helperText: "text-xs leading-5 text-muted-foreground",
  label: "text-sm font-medium text-foreground",
  divider: "border-white/10",
  subtleBadge: "inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-muted-foreground",
  popover: cn("agenda-quest-theme rounded-xl border border-white/15 bg-[#202630] p-2 text-foreground shadow-xl font-body"),
  footerLink: "min-h-11 text-sm text-muted-foreground transition-colors hover:text-foreground",
  mobileHeader: "relative border-b border-white/10 bg-transparent",
  mobileHeaderGlow: "hidden",
  mobileHeaderUtilityButton: "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary",
  mobileHeaderKicker: "text-xs font-medium text-muted-foreground",
  mobileHeaderSummary: "mt-2 text-sm text-muted-foreground",
  mobileHeaderToolbar: "mt-2 flex items-center justify-between gap-2",
  mobileDifficultyGroup: "mt-3 inline-flex w-full items-stretch gap-1 rounded-xl bg-black/15 p-1",
  desktopPanelShell: "agenda-quest-theme border border-white/10 bg-[#171c24]/95 text-foreground shadow-2xl backdrop-blur-2xl font-body",
  desktopPanelHeader: "border-b border-white/10 bg-transparent",
  desktopPanelHeaderCard: "space-y-3 py-3",
  desktopPanelFooter: "border-t border-white/10 bg-[#171c24]/95",
  desktopPanelCloseButton: cn(control, "min-h-11 min-w-11 p-2"),
  desktopPanelToolbarButton: cn(control, "inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium"),
  desktopPanelInput: "h-11 rounded-none border-0 border-b border-white/15 bg-transparent px-1 text-lg font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50",
} as const;
export const QUEST_TEMPLATE_BROWSER_STYLES = {
  header: "border-b border-white/10 bg-transparent",
  tabList: "grid w-full grid-cols-2 rounded-xl bg-black/15 p-1",
  tabTrigger: "rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none",
  searchInput: cn(control, "placeholder:text-muted-foreground"),
  filterChip: "shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
  filterChipActive: active,
  filterChipInactive: "border-white/10 bg-transparent text-muted-foreground hover:bg-white/5",
  row: "w-full rounded-xl border px-4 py-4 text-left transition-colors",
  rowHighlighted: "border-primary/30 bg-primary/10 text-foreground",
  rowDefault: "border-white/10 bg-white/5 text-foreground hover:bg-white/10",
  emptyState: "rounded-xl px-5 py-8 text-center text-muted-foreground",
} as const;
export function getQuestDifficultyOptionClasses(difficulty: QuestFormDifficulty, selected: boolean): string {
  return cn(QUEST_FORM_STYLES.difficultyButton, selected ? DIFFICULTY_COLORS[difficulty].difficultyActive : QUEST_FORM_STYLES.difficultyButtonInactive);
}
export function getQuestDifficultyIconClasses(difficulty: QuestFormDifficulty, selected: boolean): string {
  return cn(QUEST_FORM_STYLES.difficultyIconBubble, selected ? DIFFICULTY_COLORS[difficulty].iconBubble : "text-muted-foreground");
}
export function getQuestOptionPillClasses(selected: boolean, activeTone?: string, compact = false): string {
  return cn(compact ? QUEST_FORM_STYLES.optionPillCompact : QUEST_FORM_STYLES.optionPill, selected ? activeTone ?? active : "");
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

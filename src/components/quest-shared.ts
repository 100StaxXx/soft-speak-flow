import { Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Difficulty color helpers ---
export const DIFFICULTY_COLORS = {
  easy: {
    bg: "bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.5)]",
    text: "text-[#183304]",
    pill: "border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304]",
    border: "border-[#315114]",
    difficultyActive: "border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304] shadow-[0_5px_0_rgba(49,81,20,0.45)]",
    iconBubble: "border-[#315114]/40 bg-white/55 text-[#183304]",
    primaryButton: "border-[3px] border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304] shadow-[0_6px_0_rgba(49,81,20,0.45)] hover:bg-[linear-gradient(180deg,#e3ff9e_0%,#a6e145_100%)]",
    primaryButtonDisabled: "border-[3px] border-[#315114]/30 bg-white/45 text-[#315114]/45 shadow-none",
    highlightBadge: "border-[#315114]/35 bg-[#d7ff86]/45",
  },
  medium: {
    bg: "bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.5)]",
    text: "text-[#4f240c]",
    pill: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10]",
    border: "border-[#6b3416]",
    difficultyActive: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10] shadow-[0_5px_0_rgba(95,50,18,0.72)]",
    iconBubble: "border-[#6b3416]/35 bg-[#fff7dc] text-[#b04b12]",
    primaryButton: "border-[3px] border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304] shadow-[0_6px_0_rgba(49,81,20,0.45)] hover:bg-[linear-gradient(180deg,#e3ff9e_0%,#a6e145_100%)]",
    primaryButtonDisabled: "border-[3px] border-[#315114]/30 bg-white/45 text-[#315114]/45 shadow-none",
    highlightBadge: "border-[#6b3416]/24 bg-[#ffd77d]/45",
  },
  hard: {
    bg: "bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.5)]",
    text: "text-[#5b2608]",
    pill: "border-[#7a3b14] bg-[linear-gradient(180deg,#ffd7aa_0%,#ffae52_100%)] text-[#5b2608]",
    border: "border-[#7a3b14]",
    difficultyActive: "border-[#7a3b14] bg-[linear-gradient(180deg,#ffd7aa_0%,#ffae52_100%)] text-[#5b2608] shadow-[0_5px_0_rgba(95,50,18,0.72)]",
    iconBubble: "border-[#7a3b14]/35 bg-white/55 text-[#5b2608]",
    primaryButton: "border-[3px] border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304] shadow-[0_6px_0_rgba(49,81,20,0.45)] hover:bg-[linear-gradient(180deg,#e3ff9e_0%,#a6e145_100%)]",
    primaryButtonDisabled: "border-[3px] border-[#315114]/30 bg-white/45 text-[#315114]/45 shadow-none",
    highlightBadge: "border-[#7a3b14]/24 bg-[#ffae52]/38",
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
    "border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,247,199,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(254,151,54,0.18),transparent_28%),linear-gradient(180deg,#a23518_0%,#701d0d_62%,#4a1209_100%)] text-[#4f240c] shadow-[0_-14px_0_#4d2811,0_-28px_70px_-36px_rgba(38,12,5,0.62)]",
  body:
    "bg-[linear-gradient(180deg,rgba(255,248,225,0.95),rgba(255,216,128,0.88))] text-[#4f240c]",
  sectionCard:
    "rounded-[1.6rem] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] text-[#4f240c] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.5)]",
  sectionCardSoft:
    "rounded-[1.35rem] border-[3px] border-[#6b3416] bg-white/60 text-[#5d2a0f] shadow-[0_8px_0_rgba(77,40,17,0.16)]",
  insetPanel:
    "rounded-[1.15rem] border-2 border-[#6b3416]/45 bg-white/60 shadow-[inset_0_3px_0_rgba(255,255,255,0.55)]",
  heroIcon:
    "inline-flex h-11 w-11 items-center justify-center rounded-[14px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#b04b12] shadow-[0_5px_0_rgba(95,50,18,0.72)]",
  heroAction:
    "inline-flex items-center gap-1.5 rounded-[15px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] px-3 py-1.5 text-[12px] font-semibold text-[#3c1f10] shadow-[0_4px_0_rgba(95,50,18,0.72)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#fffdf7_0%,#ffe19b_100%)] active:translate-y-0 active:shadow-[0_2px_0_rgba(95,50,18,0.72)] motion-reduce:transition-none",
  titleFieldShell:
    "w-full rounded-[20px] border-[3px] border-[#6b3416] bg-white/60 p-[2px] shadow-[inset_0_3px_0_rgba(255,255,255,0.55)]",
  titleFieldInner:
    "rounded-[17px] border border-[#6b3416]/20 bg-white/80 px-2.5 py-1",
  titleInput:
    "h-9 border-0 bg-transparent px-3 text-[15px] font-semibold text-[#4d2811] placeholder:text-[#9a6d47] focus-visible:ring-0 focus-visible:ring-offset-0",
  selectorChip:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,238,188,0.9))] px-4 py-3 text-[#4f240c] shadow-[0_5px_0_rgba(95,50,18,0.42),inset_0_3px_0_rgba(255,255,255,0.55)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#fffdf7_0%,#ffe19b_100%)] motion-reduce:transition-none",
  selectorChipMuted:
    "border-dashed text-[#7f4a1d]/62",
  timeWheel:
    "relative h-[180px] overflow-y-auto rounded-[20px] border-[3px] border-[#6b3416] bg-white/70 shadow-[0_8px_0_rgba(77,40,17,0.16)] snap-y snap-mandatory scrollbar-none",
  timeWheelFadeTop:
    "sticky top-0 h-12 bg-gradient-to-b from-[rgba(255,248,232,0.98)] via-[rgba(255,248,232,0.82)] to-transparent z-10 pointer-events-none",
  timeWheelFadeBottom:
    "sticky bottom-0 h-12 bg-gradient-to-t from-[rgba(255,248,232,0.98)] via-[rgba(255,248,232,0.82)] to-transparent z-10 pointer-events-none",
  optionPill:
    "rounded-[14px] border-[3px] border-[#6b3416] bg-white/60 px-4 py-2 text-sm font-semibold text-[#5d2a0f] shadow-[0_4px_0_rgba(77,40,17,0.16)] transition-all duration-200 ease-out hover:bg-white/75 motion-reduce:transition-none",
  optionPillCompact:
    "rounded-[13px] border-[3px] border-[#6b3416] bg-white/60 px-3 py-2 text-sm font-semibold text-[#5d2a0f] shadow-[0_4px_0_rgba(77,40,17,0.16)] transition-all duration-200 ease-out hover:bg-white/75 motion-reduce:transition-none",
  difficultyButton:
    "relative flex min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-[16px] border-[3px] px-2.5 py-2 text-center transition-all duration-200 ease-out active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  difficultyButtonInactive:
    "border-[#6b3416] bg-white/60 text-[#6b3416]/82 shadow-[0_4px_0_rgba(77,40,17,0.16)] hover:bg-white/75 hover:text-[#4f240c]",
  difficultyIconBubble:
    "flex h-6.5 w-6.5 items-center justify-center rounded-[999px] border-2 border-[#6b3416]/35 bg-white/55",
  footerReview:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-white/60 px-4 py-3 text-[#5d2a0f] shadow-[0_5px_0_rgba(77,40,17,0.16)]",
  secondaryButton:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-white/60 text-[#6b3416] shadow-[0_5px_0_rgba(77,40,17,0.16)] transition-all duration-200 ease-out hover:bg-white/75 hover:text-[#4f240c] motion-reduce:transition-none",
  iconSecondaryButton:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-white/60 text-[#6b3416] shadow-[0_5px_0_rgba(77,40,17,0.16)] transition-all duration-200 ease-out hover:bg-white/75 hover:text-[#4f240c] motion-reduce:transition-none",
  advancedTrigger:
    "w-full justify-between rounded-[18px] border-[3px] border-[#6b3416] bg-white/60 px-4 py-3 text-[#6b3416] shadow-[0_5px_0_rgba(77,40,17,0.16)] hover:bg-white/75",
  helperText: "text-[12px] leading-5 text-[#7f4a1d]/80",
  label: "text-[13px] font-semibold tracking-[0.01em] text-[#5d2a0f]",
  divider: "border-[#6b3416]/20",
  subtleBadge:
    "inline-flex items-center rounded-full border border-[#6b3416]/25 bg-white/55 px-2.5 py-1 text-[11px] font-medium text-[#7f4a1d]",
  popover:
    "rounded-[20px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] p-2 text-[#4f240c] shadow-[0_10px_0_rgba(77,40,17,0.8),0_22px_34px_-28px_rgba(36,12,4,0.5)]",
  footerLink:
    "text-sm text-[#6b3416] transition-colors hover:text-[#4f240c]",
  mobileHeader:
    "relative isolate overflow-hidden border-b-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,251,239,0.22),rgba(255,206,105,0.16))]",
  mobileHeaderGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(255,248,212,0.36),transparent_70%)]",
  mobileHeaderUtilityButton:
    "rounded-[14px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,246,221,0.22),rgba(255,191,89,0.18))] p-2 text-[#fff8e8] shadow-[0_4px_0_rgba(77,40,17,0.85)] transition-all duration-200 ease-out hover:bg-[linear-gradient(180deg,rgba(255,250,236,0.28),rgba(255,191,89,0.24))] active:translate-y-0.5 motion-reduce:transition-none",
  mobileHeaderKicker:
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ffd77d]/78",
  mobileHeaderSummary:
    "mt-1 text-sm text-[#ffe9ba]/78",
  mobileHeaderToolbar:
    "mt-2 flex items-center justify-between gap-2",
  mobileDifficultyGroup:
    "mt-3 inline-flex w-full items-stretch gap-1.5 rounded-[20px] border-[3px] border-[#4d2811] bg-white/35 p-1.5 shadow-[inset_0_3px_0_rgba(255,255,255,0.22)]",
  desktopPanelShell:
    "border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,247,199,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(254,151,54,0.18),transparent_28%),linear-gradient(180deg,#a23518_0%,#701d0d_62%,#4a1209_100%)] text-[#4f240c] shadow-[0_18px_0_#4d2811,0_34px_90px_-36px_rgba(38,12,5,0.62)]",
  desktopPanelHeader:
    "border-b-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,251,239,0.22),rgba(255,206,105,0.16))]",
  desktopPanelHeaderCard:
    "rounded-[22px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,251,239,0.2),rgba(255,206,105,0.14))] p-4 shadow-[0_8px_0_rgba(77,40,17,0.85)]",
  desktopPanelFooter:
    "border-t-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,248,225,0.18),rgba(255,193,90,0.14))]",
  desktopPanelCloseButton:
    "rounded-[14px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,246,221,0.22),rgba(255,191,89,0.18))] p-2 text-[#fff8e8] shadow-[0_4px_0_rgba(77,40,17,0.85)] transition-all duration-200 ease-out hover:bg-[linear-gradient(180deg,rgba(255,250,236,0.28),rgba(255,191,89,0.24))] active:translate-y-0.5 motion-reduce:transition-none",
  desktopPanelToolbarButton:
    "inline-flex items-center gap-2 rounded-[14px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] px-3 py-2 text-sm font-semibold text-[#3c1f10] shadow-[0_4px_0_rgba(95,50,18,0.72)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#fffdf7_0%,#ffe19b_100%)] motion-reduce:transition-none",
  desktopPanelInput:
    "h-11 rounded-[16px] border-[3px] border-[#6b3416] bg-white/80 px-4 text-[15px] font-semibold text-[#4d2811] placeholder:text-[#9a6d47] focus-visible:border-[#d48635] focus-visible:ring-2 focus-visible:ring-[#f3be54] focus-visible:ring-offset-0",
} as const;

export const QUEST_TEMPLATE_BROWSER_STYLES = {
  header:
    "border-b-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,251,239,0.22),rgba(255,206,105,0.16))] shadow-[0_8px_0_rgba(77,40,17,0.85)]",
  tabList:
    "grid w-full grid-cols-2 rounded-[22px] border-[3px] border-[#6b3416] bg-white/45 p-1 shadow-[inset_0_3px_0_rgba(255,255,255,0.28)]",
  tabTrigger:
    "rounded-[18px] text-sm font-semibold text-[#6b3416] transition-all duration-200 data-[state=active]:border-[3px] data-[state=active]:border-[#6b3416] data-[state=active]:bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] data-[state=active]:text-[#3c1f10] data-[state=active]:shadow-[0_4px_0_rgba(95,50,18,0.42)]",
  searchInput: "border-[3px] border-[#6b3416] bg-white/80 text-[#4d2811] placeholder:text-[#9a6d47]",
  filterChip:
    "shrink-0 rounded-full border-[3px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
  filterChipActive: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10] shadow-[0_4px_0_rgba(95,50,18,0.42)]",
  filterChipInactive: "border-[#6b3416] bg-white/55 text-[#6b3416] hover:bg-white/75 hover:text-[#4f240c]",
  row:
    "w-full rounded-[22px] border-[3px] px-4 py-4 text-left transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  rowHighlighted:
    "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] text-[#4f240c] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.5)]",
  rowDefault:
    "border-[#6b3416] bg-white/60 text-[#5d2a0f] shadow-[0_8px_0_rgba(77,40,17,0.16)]",
  emptyState:
    "rounded-[22px] border-[3px] border-dashed border-[#6b3416] bg-white/45 px-5 py-10 text-center shadow-[inset_0_3px_0_rgba(255,255,255,0.28)]",
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
    active ? DIFFICULTY_COLORS[difficulty].iconBubble : "border-[#6b3416]/35 bg-white/55 text-[#7f4a1d]/80",
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
      ? cn(activeTone ?? DIFFICULTY_COLORS.medium.pill, "shadow-[0_4px_0_rgba(77,40,17,0.2)]")
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

import { Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Difficulty color helpers ---
export const DIFFICULTY_COLORS = {
  easy: {
    bg: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_52%),linear-gradient(180deg,rgba(35,48,45,0.98),rgba(24,34,31,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_40px_rgba(0,0,0,0.26)]",
    text: "text-emerald-50",
    pill: "bg-[linear-gradient(180deg,rgba(90,192,145,0.9),rgba(47,146,105,0.95))]",
    border: "border-emerald-300/28",
    difficultyActive: "border-emerald-300/40 bg-emerald-400/[0.14] text-emerald-50 shadow-[0_12px_22px_rgba(7,44,31,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]",
    iconBubble: "border-emerald-300/20 bg-emerald-400/[0.12] text-emerald-50",
    primaryButton: "bg-[linear-gradient(180deg,#65d8a5_0%,#38bf86_55%,#239a67_100%)] text-[#0e261d] shadow-[0_16px_28px_rgba(17,85,58,0.26)]",
    primaryButtonDisabled: "bg-[linear-gradient(180deg,rgba(101,216,165,0.18),rgba(35,154,103,0.18))] text-[#dff8ed]/45 shadow-none",
    highlightBadge: "border-emerald-300/20 bg-emerald-400/[0.10]",
  },
  medium: {
    bg: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_52%),linear-gradient(180deg,rgba(47,39,33,0.98),rgba(34,28,24,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_40px_rgba(0,0,0,0.26)]",
    text: "text-amber-50",
    pill: "bg-[linear-gradient(180deg,rgba(237,166,103,0.92),rgba(185,108,57,0.96))]",
    border: "border-amber-300/28",
    difficultyActive: "border-amber-300/40 bg-amber-400/[0.14] text-amber-50 shadow-[0_12px_22px_rgba(64,35,13,0.24),inset_0_1px_0_rgba(255,255,255,0.08)]",
    iconBubble: "border-amber-300/20 bg-amber-400/[0.12] text-amber-50",
    primaryButton: "bg-[linear-gradient(180deg,#f2c39d_0%,#df965f_52%,#bf6d38_100%)] text-[#2f180a] shadow-[0_16px_28px_rgba(98,54,25,0.28)]",
    primaryButtonDisabled: "bg-[linear-gradient(180deg,rgba(242,195,157,0.18),rgba(191,109,56,0.18))] text-[#fff1e5]/45 shadow-none",
    highlightBadge: "border-amber-300/20 bg-amber-400/[0.10]",
  },
  hard: {
    bg: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_52%),linear-gradient(180deg,rgba(43,33,50,0.98),rgba(31,24,37,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_40px_rgba(0,0,0,0.26)]",
    text: "text-fuchsia-50",
    pill: "bg-[linear-gradient(180deg,rgba(191,133,236,0.92),rgba(128,78,185,0.96))]",
    border: "border-fuchsia-300/28",
    difficultyActive: "border-fuchsia-300/38 bg-fuchsia-400/[0.14] text-fuchsia-50 shadow-[0_12px_22px_rgba(44,20,67,0.26),inset_0_1px_0_rgba(255,255,255,0.08)]",
    iconBubble: "border-fuchsia-300/20 bg-fuchsia-400/[0.12] text-fuchsia-50",
    primaryButton: "bg-[linear-gradient(180deg,#d9b5f0_0%,#b77fe1_52%,#8e5bbb_100%)] text-[#261332] shadow-[0_16px_28px_rgba(73,38,105,0.28)]",
    primaryButtonDisabled: "bg-[linear-gradient(180deg,rgba(217,181,240,0.18),rgba(142,91,187,0.18))] text-[#f4eafe]/45 shadow-none",
    highlightBadge: "border-fuchsia-300/20 bg-fuchsia-400/[0.10]",
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
    "border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,248,214,0.28),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,164,78,0.2),transparent_30%),linear-gradient(180deg,#a23518_0%,#701d0d_62%,#4a1209_100%)] text-[#fff8ea] shadow-[0_-18px_0_#4d2811,0_-34px_64px_rgba(38,12,5,0.34)]",
  body:
    "bg-[radial-gradient(circle_at_top,rgba(255,247,199,0.16),transparent_24%),linear-gradient(180deg,rgba(143,47,21,0.28),rgba(95,24,11,0.12))]",
  sectionCard:
    "rounded-[24px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e8_0%,#ffd98a_100%)] text-[#4f240c] shadow-[0_10px_0_rgba(77,40,17,0.8),0_20px_28px_rgba(36,12,4,0.18)] backdrop-blur-xl",
  sectionCardSoft:
    "rounded-[20px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,251,239,0.98),rgba(255,231,171,0.98))] text-[#5d2a0f] shadow-[0_8px_0_rgba(77,40,17,0.22),0_16px_22px_rgba(36,12,4,0.14)] backdrop-blur-lg",
  insetPanel:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,252,242,0.9),rgba(255,237,194,0.9))] shadow-[inset_0_2px_0_rgba(255,255,255,0.5)]",
  heroIcon:
    "inline-flex h-11 w-11 items-center justify-center rounded-[16px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff9ed_0%,#ffe5a8_100%)] text-[#b04b12] shadow-[0_6px_0_#7a3a14,0_10px_18px_rgba(74,31,8,0.16)] backdrop-blur-md",
  heroAction:
    "inline-flex items-center gap-1.5 rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,233,183,0.96))] px-3 py-2 text-[12px] font-semibold text-[#6b3416] shadow-[0_6px_0_#7a3a14] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#4f240c] active:translate-y-[1px] active:shadow-[0_3px_0_#7a3a14] motion-reduce:transition-none",
  titleFieldShell:
    "w-full rounded-[22px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fffaf0_0%,#ffe1a0_100%)] p-[2px] shadow-[0_8px_0_rgba(77,40,17,0.24),inset_0_2px_0_rgba(255,255,255,0.58)] backdrop-blur-md",
  titleFieldInner:
    "rounded-[18px] border-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,244,214,0.96))] px-2.5 py-1 shadow-[inset_0_2px_0_rgba(255,255,255,0.65)]",
  titleInput:
    "h-9 border-0 bg-transparent px-3 text-[15px] font-semibold text-[#4d2811] placeholder:text-[#9a6d47] focus-visible:ring-0 focus-visible:ring-offset-0",
  selectorChip:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] px-4 py-3 text-[#4f240c] shadow-[0_8px_0_#7a3a14,0_14px_20px_rgba(74,31,8,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#fffaf0_0%,#ffd77d_100%)] motion-reduce:transition-none",
  selectorChipMuted:
    "border-dashed text-[#9a6d47]",
  timeWheel:
    "relative h-[180px] overflow-y-auto rounded-[20px] border border-white/7 bg-[linear-gradient(180deg,rgba(38,33,52,0.98),rgba(28,24,40,0.98))] shadow-[0_12px_24px_rgba(0,0,0,0.18)] snap-y snap-mandatory scrollbar-none",
  timeWheelFadeTop:
    "sticky top-0 h-12 bg-gradient-to-b from-[rgba(31,27,43,0.98)] via-[rgba(31,27,43,0.82)] to-transparent z-10 pointer-events-none",
  timeWheelFadeBottom:
    "sticky bottom-0 h-12 bg-gradient-to-t from-[rgba(31,27,43,0.98)] via-[rgba(31,27,43,0.82)] to-transparent z-10 pointer-events-none",
  optionPill:
    "rounded-[14px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff9ef_0%,#ffe3a7_100%)] px-4 py-2 text-sm font-semibold text-[#6b3416] shadow-[0_6px_0_rgba(122,58,20,0.48)] transition-all duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none",
  optionPillCompact:
    "rounded-[13px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff9ef_0%,#ffe3a7_100%)] px-3 py-2 text-sm font-semibold text-[#6b3416] shadow-[0_6px_0_rgba(122,58,20,0.48)] transition-all duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none",
  difficultyButton:
    "relative flex min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-[16px] border px-2.5 py-2 text-center transition-all duration-200 ease-out active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  difficultyButtonInactive:
    "border-[#6b3416] bg-[linear-gradient(180deg,#fff7e8_0%,#ffe5b3_100%)] text-[#7a431d] shadow-[0_6px_0_rgba(122,58,20,0.42)] hover:-translate-y-0.5 hover:text-[#4f240c]",
  difficultyIconBubble:
    "flex h-6.5 w-6.5 items-center justify-center rounded-[999px] border-[2px] border-[#6b3416] bg-white/60",
  footerReview:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8ea_0%,#ffd893_100%)] px-4 py-3 text-[#7a431d] shadow-[0_8px_0_rgba(77,40,17,0.24)]",
  secondaryButton:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff9ee_0%,#ffe7b8_100%)] text-[#6b3416] shadow-[0_6px_0_#7a3a14] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#4f240c] motion-reduce:transition-none",
  iconSecondaryButton:
    "rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff9ee_0%,#ffe7b8_100%)] text-[#6b3416] shadow-[0_6px_0_#7a3a14] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#4f240c] motion-reduce:transition-none",
  advancedTrigger:
    "w-full justify-between rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff8e8_0%,#ffd98a_100%)] px-4 py-3 text-[#6b3416] shadow-[0_8px_0_rgba(122,58,20,0.38)] hover:-translate-y-0.5 hover:text-[#4f240c]",
  helperText: "text-[12px] leading-5 text-[#8d481c]",
  label: "text-[13px] font-semibold tracking-[0.01em] text-[#5d2a0f]",
  divider: "border-[#d8ba7f]",
  subtleBadge:
    "inline-flex items-center rounded-full border-[2px] border-[#6b3416] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[#7a431d]",
  popover:
    "rounded-[20px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e8_0%,#ffdc92_100%)] p-2 text-[#4f240c] shadow-[0_10px_0_#7a3a14,0_20px_32px_rgba(74,31,8,0.22)] backdrop-blur-2xl",
  footerLink:
    "text-sm text-[#8d481c] transition-colors hover:text-[#4f240c]",
  mobileHeader:
    "relative isolate overflow-hidden border-b-[3px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,245,194,0.22),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(254,138,44,0.18),transparent_30%),linear-gradient(180deg,#8f2f15_0%,#5f180b_100%)]",
  mobileHeaderGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,248,212,0.36),transparent_70%)]",
  mobileHeaderUtilityButton:
    "rounded-[14px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,233,183,0.96))] p-2 text-[#b04b12] shadow-[0_4px_0_#7a3a14] backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#8d481c] active:translate-y-[1px] active:shadow-[0_2px_0_#7a3a14] motion-reduce:transition-none",
  mobileHeaderKicker:
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ffd8a4]/76",
  mobileHeaderSummary:
    "mt-1 text-sm text-[#ffe7c0]",
  mobileHeaderToolbar:
    "mt-3 flex items-center justify-between gap-2",
  mobileDifficultyGroup:
    "mt-4 inline-flex w-full items-stretch gap-2 rounded-[22px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,248,225,0.14),rgba(255,187,88,0.1))] p-2 shadow-[0_8px_0_rgba(77,40,17,0.28)]",
  desktopPanelShell:
    "border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,247,199,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(254,151,54,0.18),transparent_28%),linear-gradient(180deg,#a23518_0%,#701d0d_62%,#4a1209_100%)] shadow-[0_18px_0_#4d2811,0_34px_90px_-36px_rgba(38,12,5,0.62)]",
  desktopPanelHeader:
    "border-b-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,251,239,0.2),rgba(255,206,105,0.14))]",
  desktopPanelHeaderCard:
    "rounded-[22px] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] p-4 text-[#4f240c] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_24px_rgba(36,12,4,0.18)]",
  desktopPanelFooter:
    "border-t-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,248,225,0.18),rgba(255,193,90,0.14))] backdrop-blur-xl",
  desktopPanelCloseButton:
    "rounded-[14px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,233,183,0.96))] p-2 text-[#b04b12] shadow-[0_4px_0_#7a3a14] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#8d481c] active:translate-y-[1px] active:shadow-[0_2px_0_#7a3a14] motion-reduce:transition-none",
  desktopPanelToolbarButton:
    "inline-flex items-center gap-2 rounded-[16px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fff9ee_0%,#ffe7b8_100%)] px-3 py-2 text-sm font-semibold text-[#6b3416] shadow-[0_6px_0_#7a3a14] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#4f240c] motion-reduce:transition-none",
  desktopPanelInput:
    "h-11 rounded-[18px] border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,#fffaf0_0%,#ffe4af_100%)] px-4 text-[15px] font-semibold text-[#4d2811] placeholder:text-[#9a6d47] focus-visible:ring-2 focus-visible:ring-[#f3be54] focus-visible:ring-offset-0",
  textStrong: "text-[#4f240c]",
  textMuted: "text-[#8d481c]",
  textOnDarkStrong: "text-white",
  textOnDarkMuted: "text-[#ffe7c0]",
  bareInput:
    "bg-transparent text-sm text-[#4f240c] outline-none placeholder:text-[#9a6d47]",
  bareTextarea:
    "min-h-[88px] border-0 rounded-none bg-transparent resize-none px-4 py-4 text-sm text-[#4f240c] placeholder:text-[#9a6d47] focus-visible:ring-0 focus-visible:ring-offset-0",
  iconGhostButton:
    "rounded-full p-1 text-[#8d481c] transition-all hover:bg-[#fff0c8] hover:text-[#4f240c]",
} as const;

export const QUEST_TEMPLATE_BROWSER_STYLES = {
  header:
    "border-b border-white/8 bg-[linear-gradient(180deg,rgba(35,31,48,0.98),rgba(27,24,38,0.98))] shadow-[0_10px_20px_rgba(0,0,0,0.16)]",
  tabList:
    "grid w-full grid-cols-2 rounded-[22px] border border-white/8 bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  tabTrigger:
    "rounded-[18px] text-sm font-semibold text-white/66 transition-all duration-200 data-[state=active]:border data-[state=active]:border-white/12 data-[state=active]:bg-white/[0.12] data-[state=active]:text-white data-[state=active]:shadow-[0_8px_14px_rgba(0,0,0,0.12)]",
  searchInput: "border-white/10 bg-white/[0.06] text-white placeholder:text-white/45",
  filterChip:
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
  filterChipActive: "border-white/20 bg-white/[0.14] text-white shadow-[0_8px_14px_rgba(0,0,0,0.12)]",
  filterChipInactive: "border-white/10 bg-white/[0.05] text-white/66 hover:text-white hover:bg-white/[0.1]",
  row:
    "w-full rounded-[22px] border px-4 py-4 text-left transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  rowHighlighted:
    "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_14px_24px_rgba(0,0,0,0.18)]",
  rowDefault:
    "border-white/8 bg-[linear-gradient(180deg,rgba(38,33,52,0.96),rgba(28,24,40,0.96))] shadow-[0_12px_22px_rgba(0,0,0,0.16)]",
  emptyState:
    "rounded-[22px] border border-dashed border-white/10 bg-white/[0.04] px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
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
    active ? DIFFICULTY_COLORS[difficulty].iconBubble : "border-white/12 bg-white/[0.08] text-white/72",
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
      ? cn(activeTone, "border-transparent text-white shadow-[0_12px_20px_rgba(0,0,0,0.16)]")
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

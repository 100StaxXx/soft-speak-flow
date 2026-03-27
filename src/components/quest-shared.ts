import { Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Difficulty color helpers ---
export const DIFFICULTY_COLORS = {
  easy: {
    bg: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_42%),linear-gradient(180deg,#53d79e_0%,#36bf84_48%,#289e6b_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_24px_44px_rgba(18,102,69,0.28)]",
    text: "text-emerald-50",
    pill: "bg-[linear-gradient(180deg,#8bf1c2_0%,#4fd49a_46%,#2cb97e_100%)]",
    border: "border-emerald-100/35",
    difficultyActive: "border-white/70 bg-white/[0.22] text-white shadow-[0_16px_28px_rgba(10,83,52,0.22),inset_0_1px_0_rgba(255,255,255,0.24)]",
    iconBubble: "border-white/30 bg-white/[0.20] text-white",
    primaryButton: "bg-[linear-gradient(180deg,#79ebb7_0%,#3fd597_45%,#1ab675_100%)] text-[#103323] shadow-[0_18px_28px_rgba(20,116,74,0.34)]",
    primaryButtonDisabled: "bg-[linear-gradient(180deg,rgba(121,235,183,0.26),rgba(26,182,117,0.22))] text-[#17392d]/65 shadow-none",
    highlightBadge: "border-white/20 bg-white/[0.16]",
  },
  medium: {
    bg: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_42%),linear-gradient(180deg,#f2a96c_0%,#e08a4f_48%,#cc723f_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_24px_44px_rgba(120,58,24,0.28)]",
    text: "text-amber-50",
    pill: "bg-[linear-gradient(180deg,#ffd1ab_0%,#f3a264_44%,#df7f41_100%)]",
    border: "border-orange-100/35",
    difficultyActive: "border-white/70 bg-white/[0.22] text-white shadow-[0_16px_28px_rgba(111,55,22,0.22),inset_0_1px_0_rgba(255,255,255,0.24)]",
    iconBubble: "border-white/30 bg-white/[0.20] text-white",
    primaryButton: "bg-[linear-gradient(180deg,#ffd5b4_0%,#f4a166_42%,#e27d41_100%)] text-[#4d2309] shadow-[0_18px_28px_rgba(156,79,33,0.34)]",
    primaryButtonDisabled: "bg-[linear-gradient(180deg,rgba(255,213,180,0.26),rgba(226,125,65,0.24))] text-[#4d2309]/55 shadow-none",
    highlightBadge: "border-white/20 bg-white/[0.16]",
  },
  hard: {
    bg: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_42%),linear-gradient(180deg,#d07cff_0%,#ad5bf1_48%,#8c43da_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_24px_44px_rgba(76,32,123,0.3)]",
    text: "text-fuchsia-50",
    pill: "bg-[linear-gradient(180deg,#f0c2ff_0%,#cc7bff_44%,#a24cf1_100%)]",
    border: "border-fuchsia-100/35",
    difficultyActive: "border-white/70 bg-white/[0.22] text-white shadow-[0_16px_28px_rgba(66,22,111,0.24),inset_0_1px_0_rgba(255,255,255,0.24)]",
    iconBubble: "border-white/30 bg-white/[0.20] text-white",
    primaryButton: "bg-[linear-gradient(180deg,#f2cbff_0%,#d685ff_42%,#af58f3_100%)] text-[#38164f] shadow-[0_18px_28px_rgba(108,50,163,0.36)]",
    primaryButtonDisabled: "bg-[linear-gradient(180deg,rgba(242,203,255,0.24),rgba(175,88,243,0.22))] text-[#38164f]/58 shadow-none",
    highlightBadge: "border-white/20 bg-white/[0.16]",
  },
} as const;

export type QuestFormDifficulty = keyof typeof DIFFICULTY_COLORS;

export const DifficultyIconMap = {
  easy: Zap,
  medium: Flame,
  hard: Mountain,
} as const;

export const QUEST_FORM_STYLES = {
  sheet:
    "border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_28%),linear-gradient(180deg,rgba(31,27,44,0.98),rgba(24,21,37,0.98))] shadow-[0_-18px_54px_rgba(0,0,0,0.34)]",
  body:
    "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_26%),linear-gradient(180deg,rgba(31,27,44,0.98),rgba(24,21,37,0.98))]",
  sectionCard:
    "rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(42,37,58,0.96),rgba(31,27,46,0.96))] shadow-[0_16px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl",
  sectionCardSoft:
    "rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(46,40,63,0.92),rgba(34,29,49,0.92))] shadow-[0_12px_26px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-lg",
  insetPanel:
    "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  heroIcon:
    "inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/24 bg-white/[0.16] shadow-[0_10px_18px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md",
  heroAction:
    "inline-flex items-center gap-1.5 rounded-full border border-white/24 bg-white/[0.15] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_10px_18px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all duration-200 ease-out hover:bg-white/[0.2] active:scale-[0.98] motion-reduce:transition-none",
  titleFieldShell:
    "w-full rounded-[28px] border border-white/26 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] p-[1px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md",
  titleFieldInner:
    "rounded-[27px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  titleInput:
    "h-10 border-0 bg-transparent px-3.5 text-[15px] font-semibold text-white placeholder:text-white/62 focus-visible:ring-0 focus-visible:ring-offset-0",
  selectorChip:
    "rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(44,39,61,0.98),rgba(34,29,49,0.98))] px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 ease-out hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(50,44,69,0.98),rgba(38,32,54,0.98))] motion-reduce:transition-none",
  selectorChipMuted:
    "border-dashed text-white/58",
  timeWheel:
    "relative h-[180px] overflow-y-auto rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(44,39,61,0.98),rgba(33,29,48,0.98))] shadow-[0_14px_28px_rgba(0,0,0,0.2)] snap-y snap-mandatory scrollbar-none",
  timeWheelFadeTop:
    "sticky top-0 h-12 bg-gradient-to-b from-[rgba(35,31,50,0.98)] via-[rgba(35,31,50,0.78)] to-transparent z-10 pointer-events-none",
  timeWheelFadeBottom:
    "sticky bottom-0 h-12 bg-gradient-to-t from-[rgba(35,31,50,0.98)] via-[rgba(35,31,50,0.78)] to-transparent z-10 pointer-events-none",
  optionPill:
    "rounded-[18px] border border-white/8 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/74 shadow-[0_8px_14px_rgba(0,0,0,0.1)] transition-all duration-200 ease-out hover:bg-white/[0.11] motion-reduce:transition-none",
  optionPillCompact:
    "rounded-[16px] border border-white/8 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/74 shadow-[0_8px_14px_rgba(0,0,0,0.1)] transition-all duration-200 ease-out hover:bg-white/[0.11] motion-reduce:transition-none",
  difficultyButton:
    "relative flex min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-[20px] border px-2.5 py-2 text-center transition-all duration-200 ease-out active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  difficultyButtonInactive:
    "border-white/10 bg-white/[0.12] text-white/78 shadow-[0_10px_18px_rgba(0,0,0,0.08)] hover:bg-white/[0.18]",
  difficultyIconBubble:
    "flex h-7 w-7 items-center justify-center rounded-full border border-white/14 bg-white/[0.08]",
  footerReview:
    "rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(43,38,60,0.96),rgba(34,29,49,0.96))] px-4 py-3 text-white/74 shadow-[0_12px_24px_rgba(0,0,0,0.18)]",
  secondaryButton:
    "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(47,41,66,0.98),rgba(36,31,52,0.98))] text-white/88 shadow-[0_12px_24px_rgba(0,0,0,0.16)] transition-all duration-200 ease-out hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(54,47,74,0.98),rgba(40,35,57,0.98))] motion-reduce:transition-none",
  iconSecondaryButton:
    "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(47,41,66,0.98),rgba(36,31,52,0.98))] text-white/88 shadow-[0_12px_24px_rgba(0,0,0,0.16)] transition-all duration-200 ease-out hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(54,47,74,0.98),rgba(40,35,57,0.98))] motion-reduce:transition-none",
  advancedTrigger:
    "w-full justify-between rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(44,39,61,0.96),rgba(34,29,49,0.96))] px-4 py-3 text-white/76 shadow-[0_12px_24px_rgba(0,0,0,0.16)] hover:bg-[linear-gradient(180deg,rgba(49,43,67,0.98),rgba(38,32,54,0.98))]",
  helperText: "text-[12px] leading-5 text-white/58",
  label: "text-[13px] font-semibold tracking-[0.01em] text-white/84",
  divider: "border-white/6",
  subtleBadge:
    "inline-flex items-center rounded-full border border-white/14 bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-white/72",
  popover:
    "rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(43,37,60,0.98),rgba(33,28,47,0.98))] p-2 text-white shadow-[0_20px_36px_rgba(0,0,0,0.28)] backdrop-blur-2xl",
  footerLink:
    "text-sm text-white/68 transition-colors hover:text-white/90",
} as const;

export const QUEST_TEMPLATE_BROWSER_STYLES = {
  header:
    "border-b border-white/8 bg-[linear-gradient(180deg,rgba(37,32,53,0.98),rgba(30,26,43,0.98))] shadow-[0_10px_20px_rgba(0,0,0,0.16)]",
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
    "w-full rounded-[28px] border px-4 py-4 text-left transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  rowHighlighted:
    "border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))] shadow-[0_16px_28px_rgba(0,0,0,0.18)]",
  rowDefault:
    "border-white/8 bg-[linear-gradient(180deg,rgba(44,39,61,0.96),rgba(33,29,47,0.96))] shadow-[0_12px_24px_rgba(0,0,0,0.16)]",
  emptyState:
    "rounded-[28px] border border-dashed border-white/10 bg-white/[0.04] px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
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

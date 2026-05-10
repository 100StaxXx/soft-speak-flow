import { Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

const QUEST_FROSTED_VARS = [
  "[--background:202_100%_98%]",
  "[--foreground:224_44%_14%]",
  "[--card:0_0%_100%]",
  "[--card-foreground:224_44%_14%]",
  "[--secondary:203_78%_96%]",
  "[--secondary-foreground:224_44%_14%]",
  "[--muted:205_68%_94%]",
  "[--muted-foreground:219_16%_45%]",
  "[--border:201_100%_86%]",
  "[--input:202_100%_94%]",
  "[--popover:0_0%_100%]",
  "[--popover-foreground:224_44%_14%]",
  "[--primary:202_68%_68%]",
  "[--primary-foreground:224_44%_14%]",
  "[--accent:204_100%_91%]",
  "[--accent-foreground:224_44%_14%]",
  "[--ring:202_82%_73%]",
  "[--celestial-blue:202_92%_76%]",
  "[--stardust-gold:263_64%_68%]",
  "[--nebula-pink:269_60%_64%]",
  "[--category-soul:203_82%_64%]",
  "[--epic-nature:202_76%_66%]",
  "[--category-body:219_52%_66%]",
  "[--epic-warrior:263_64%_70%]",
  "[--stage-tier-2:205_36%_74%]",
  "[--deep-space:224_44%_14%]",
].join(" ");

const QUEST_PRIMARY_BUTTON =
  "border-[2px] border-[hsl(var(--celestial-blue)_/_0.62)] bg-[linear-gradient(180deg,#f3fbff_0%,hsl(var(--celestial-blue)_/_0.52)_48%,hsl(var(--primary)_/_0.8)_100%)] text-[hsl(var(--deep-space))] shadow-[0_14px_28px_-20px_rgba(73,155,205,0.58),inset_0_1px_0_rgba(255,255,255,0.92)] hover:bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.62)_48%,hsl(var(--primary)_/_0.9)_100%)]";

const QUEST_PRIMARY_BUTTON_DISABLED =
  "border-[2px] border-[hsl(var(--border)_/_0.62)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.76),hsl(var(--muted)_/_0.62))] text-muted-foreground shadow-none";

// --- Difficulty color helpers ---
export const DIFFICULTY_COLORS = {
  easy: {
    bg: "bg-[radial-gradient(circle_at_top_left,hsl(var(--category-soul)_/_0.16),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.82)_100%)] shadow-[0_14px_30px_-24px_rgba(73,155,205,0.42),inset_0_1px_0_rgba(255,255,255,0.88)]",
    text: "text-foreground",
    pill: "border-[hsl(var(--category-soul)_/_0.5)] bg-[linear-gradient(180deg,hsl(var(--category-soul)_/_0.16)_0%,hsl(var(--celestial-blue)_/_0.1)_100%)] text-foreground",
    border: "border-[hsl(var(--category-soul)_/_0.5)]",
    difficultyActive: "border-[hsl(var(--category-soul)_/_0.62)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--category-soul)_/_0.18)_100%)] text-foreground shadow-[0_10px_22px_-18px_rgba(73,155,205,0.45),inset_0_1px_0_rgba(255,255,255,0.92)]",
    iconBubble: "border-[hsl(var(--category-soul)_/_0.5)] bg-[hsl(var(--category-soul)_/_0.12)] text-[hsl(var(--category-soul))]",
    primaryButton: QUEST_PRIMARY_BUTTON,
    primaryButtonDisabled: QUEST_PRIMARY_BUTTON_DISABLED,
    highlightBadge: "border-[hsl(var(--category-soul)_/_0.35)] bg-[hsl(var(--category-soul)_/_0.12)]",
  },
  medium: {
    bg: "bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.16),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.82)_100%)] shadow-[0_14px_30px_-24px_rgba(137,103,214,0.34),inset_0_1px_0_rgba(255,255,255,0.88)]",
    text: "text-foreground",
    pill: "border-[hsl(var(--stardust-gold)_/_0.45)] bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.16)_0%,hsl(var(--celestial-blue)_/_0.12)_100%)] text-foreground",
    border: "border-[hsl(var(--stardust-gold)_/_0.45)]",
    difficultyActive: "border-[hsl(var(--stardust-gold)_/_0.62)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--stardust-gold)_/_0.16)_50%,hsl(var(--celestial-blue)_/_0.12)_100%)] text-foreground shadow-[0_10px_22px_-18px_rgba(137,103,214,0.42),inset_0_1px_0_rgba(255,255,255,0.92)]",
    iconBubble: "border-[hsl(var(--stardust-gold)_/_0.5)] bg-[hsl(var(--stardust-gold)_/_0.12)] text-[hsl(var(--stardust-gold))]",
    primaryButton: QUEST_PRIMARY_BUTTON,
    primaryButtonDisabled: QUEST_PRIMARY_BUTTON_DISABLED,
    highlightBadge: "border-[hsl(var(--stardust-gold)_/_0.35)] bg-[hsl(var(--stardust-gold)_/_0.12)]",
  },
  hard: {
    bg: "bg-[radial-gradient(circle_at_top_left,hsl(var(--category-body)_/_0.16),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.82)_100%)] shadow-[0_14px_30px_-24px_rgba(91,117,180,0.36),inset_0_1px_0_rgba(255,255,255,0.88)]",
    text: "text-foreground",
    pill: "border-[hsl(var(--category-body)_/_0.45)] bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.15)_0%,hsl(var(--stardust-gold)_/_0.1)_100%)] text-foreground",
    border: "border-[hsl(var(--category-body)_/_0.45)]",
    difficultyActive: "border-[hsl(var(--category-body)_/_0.6)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--category-body)_/_0.15)_58%,hsl(var(--stardust-gold)_/_0.1)_100%)] text-foreground shadow-[0_10px_22px_-18px_rgba(91,117,180,0.4),inset_0_1px_0_rgba(255,255,255,0.92)]",
    iconBubble: "border-[hsl(var(--category-body)_/_0.48)] bg-[hsl(var(--category-body)_/_0.12)] text-[hsl(var(--category-body))]",
    primaryButton: QUEST_PRIMARY_BUTTON,
    primaryButtonDisabled: QUEST_PRIMARY_BUTTON_DISABLED,
    highlightBadge: "border-[hsl(var(--category-body)_/_0.35)] bg-[hsl(var(--category-body)_/_0.1)]",
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
  sheet: cn(
    QUEST_FROSTED_VARS,
    "border-[3px] border-[hsl(var(--celestial-blue)_/_0.62)] bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.18),transparent_32%),radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.24),transparent_36%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_46%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_-16px_46px_-28px_rgba(92,157,198,0.58),inset_0_1px_0_rgba(255,255,255,0.88)]",
  ),
  body:
    "bg-[radial-gradient(circle_at_top_right,hsl(var(--stardust-gold)_/_0.08),transparent_34%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.74)_100%)] text-foreground",
  sectionCard:
    "rounded-[1.6rem] border-[2px] border-[hsl(var(--celestial-blue)_/_0.52)] bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.11),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.08),transparent_36%),linear-gradient(180deg,hsl(var(--card)_/_0.96)_0%,hsl(var(--secondary)_/_0.72)_100%)] text-foreground shadow-[0_16px_38px_-32px_rgba(92,157,198,0.46),inset_0_1px_0_rgba(255,255,255,0.88)] backdrop-blur-xl",
  sectionCardSoft:
    "rounded-[1.35rem] border-[2px] border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.78] text-foreground shadow-[0_12px_28px_-26px_rgba(92,157,198,0.36),inset_0_1px_0_rgba(255,255,255,0.78)]",
  insetPanel:
    "rounded-[1.15rem] border border-[hsl(var(--celestial-blue)_/_0.38)] bg-card/[0.7] shadow-[inset_0_1px_2px_rgba(58,121,158,0.08)]",
  heroIcon:
    "inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[hsl(var(--celestial-blue)_/_0.52)] bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--celestial-blue)_/_0.18)_58%,hsl(var(--stardust-gold)_/_0.12)_100%)] text-[hsl(var(--category-soul))] shadow-[0_10px_22px_-20px_rgba(92,157,198,0.44),inset_0_1px_0_rgba(255,255,255,0.9)]",
  heroAction:
    "inline-flex items-center gap-1.5 rounded-[15px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.52)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.92)_0%,hsl(var(--secondary)_/_0.7)_100%)] px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--stardust-gold)_/_0.48)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 active:translate-y-0 motion-reduce:transition-none",
  titleFieldShell:
    "w-full rounded-[20px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.56)] bg-card/[0.68] p-[2px] shadow-[inset_0_1px_2px_rgba(58,121,158,0.1)]",
  titleFieldInner:
    "rounded-[17px] border border-[hsl(var(--border)_/_0.72)] bg-card/[0.9] px-2.5 py-1",
  titleInput:
    "h-9 border-0 bg-transparent px-3 text-[15px] font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
  selectorChip:
    "rounded-[18px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.5)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.9),hsl(var(--secondary)_/_0.64))] px-4 py-3 text-foreground shadow-[0_12px_26px_-24px_rgba(92,157,198,0.44),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--stardust-gold)_/_0.5)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 motion-reduce:transition-none",
  selectorChipMuted:
    "border-dashed text-muted-foreground",
  timeWheel:
    "relative h-[180px] overflow-y-auto rounded-[20px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.46)] bg-card/[0.74] shadow-[0_12px_28px_-24px_rgba(92,157,198,0.34),inset_0_1px_2px_rgba(58,121,158,0.08)] snap-y snap-mandatory scrollbar-none",
  timeWheelFadeTop:
    "sticky top-0 h-12 bg-gradient-to-b from-[hsl(var(--card)_/_0.96)] via-[hsl(var(--card)_/_0.78)] to-transparent z-10 pointer-events-none",
  timeWheelFadeBottom:
    "sticky bottom-0 h-12 bg-gradient-to-t from-[hsl(var(--card)_/_0.96)] via-[hsl(var(--card)_/_0.78)] to-transparent z-10 pointer-events-none",
  optionPill:
    "rounded-[14px] border-[2px] border-[hsl(var(--border)_/_0.72)] bg-card/[0.74] px-4 py-2 text-sm font-semibold text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.32),inset_0_1px_0_rgba(255,255,255,0.78)] transition-all duration-200 ease-out hover:bg-card motion-reduce:transition-none",
  optionPillCompact:
    "rounded-[13px] border-[2px] border-[hsl(var(--border)_/_0.72)] bg-card/[0.74] px-3 py-2 text-sm font-semibold text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.32),inset_0_1px_0_rgba(255,255,255,0.78)] transition-all duration-200 ease-out hover:bg-card motion-reduce:transition-none",
  difficultyButton:
    "relative flex min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-[16px] border-[2px] px-2.5 py-2 text-center transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  difficultyButtonInactive:
    "border-[hsl(var(--border)_/_0.72)] bg-card/[0.74] text-muted-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.3),inset_0_1px_0_rgba(255,255,255,0.74)] hover:bg-card hover:text-foreground",
  difficultyIconBubble:
    "flex h-6.5 w-6.5 items-center justify-center rounded-[999px] border border-[hsl(var(--border)_/_0.72)] bg-card/[0.72]",
  footerReview:
    "rounded-[18px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.72] px-4 py-3 text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.3),inset_0_1px_0_rgba(255,255,255,0.72)]",
  secondaryButton:
    "rounded-[18px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.76] text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.34),inset_0_1px_0_rgba(255,255,255,0.76)] transition-all duration-200 ease-out hover:border-[hsl(var(--stardust-gold)_/_0.48)] hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 motion-reduce:transition-none",
  iconSecondaryButton:
    "rounded-[18px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.76] text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.34),inset_0_1px_0_rgba(255,255,255,0.76)] transition-all duration-200 ease-out hover:border-[hsl(var(--stardust-gold)_/_0.48)] hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 motion-reduce:transition-none",
  advancedTrigger:
    "w-full justify-between rounded-[18px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.76] px-4 py-3 text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.34),inset_0_1px_0_rgba(255,255,255,0.76)] hover:border-[hsl(var(--stardust-gold)_/_0.48)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0",
  helperText: "text-[12px] leading-5 text-muted-foreground",
  label: "text-[13px] font-semibold tracking-[0.01em] text-foreground",
  divider: "border-[hsl(var(--celestial-blue)_/_0.36)]",
  subtleBadge:
    "inline-flex items-center rounded-full border border-[hsl(var(--celestial-blue)_/_0.36)] bg-secondary/[0.52] px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
  popover: cn(
    QUEST_FROSTED_VARS,
    "rounded-[20px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.5)] bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.1),transparent_32%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.78)_100%)] p-2 text-foreground shadow-[0_18px_42px_-32px_rgba(92,157,198,0.46),inset_0_1px_0_rgba(255,255,255,0.82)]",
  ),
  footerLink:
    "text-sm text-[hsl(var(--stardust-gold))] transition-colors hover:text-foreground",
  mobileHeader:
    "relative isolate overflow-hidden border-b-[2px] border-[hsl(var(--celestial-blue)_/_0.48)] bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.16),transparent_44%),radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.22),transparent_38%),linear-gradient(180deg,hsl(var(--card)_/_0.88),hsl(var(--secondary)_/_0.62))]",
  mobileHeaderGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.2),transparent_70%)]",
  mobileHeaderUtilityButton:
    "rounded-[14px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.5)] bg-card/[0.84] p-2 text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all duration-200 ease-out hover:border-[hsl(var(--stardust-gold)_/_0.52)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 active:translate-y-0.5 motion-reduce:transition-none",
  mobileHeaderKicker:
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--stardust-gold))]",
  mobileHeaderSummary:
    "mt-1 text-sm text-muted-foreground",
  mobileHeaderToolbar:
    "mt-2 flex items-center justify-between gap-2",
  mobileDifficultyGroup:
    "mt-3 inline-flex w-full items-stretch gap-1.5 rounded-[20px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.5)] bg-card/[0.58] p-1.5 shadow-[inset_0_1px_2px_rgba(58,121,158,0.08)]",
  desktopPanelShell: cn(
    QUEST_FROSTED_VARS,
    "border-[3px] border-[hsl(var(--celestial-blue)_/_0.62)] bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.16),transparent_32%),radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.24),transparent_36%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_46%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_24px_70px_-48px_rgba(92,157,198,0.58),inset_0_1px_0_rgba(255,255,255,0.88)]",
  ),
  desktopPanelHeader:
    "border-b-[2px] border-[hsl(var(--celestial-blue)_/_0.46)] bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.14),transparent_44%),linear-gradient(180deg,hsl(var(--card)_/_0.9),hsl(var(--secondary)_/_0.62))]",
  desktopPanelHeaderCard:
    "rounded-[22px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.48)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.9),hsl(var(--secondary)_/_0.58))] p-4 shadow-[0_14px_30px_-26px_rgba(92,157,198,0.42),inset_0_1px_0_rgba(255,255,255,0.84)]",
  desktopPanelFooter:
    "border-t-[2px] border-[hsl(var(--celestial-blue)_/_0.38)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.82),hsl(var(--secondary)_/_0.7))]",
  desktopPanelCloseButton:
    "rounded-[14px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.5)] bg-card/[0.84] p-2 text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all duration-200 ease-out hover:border-[hsl(var(--stardust-gold)_/_0.52)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 active:translate-y-0.5 motion-reduce:transition-none",
  desktopPanelToolbarButton:
    "inline-flex items-center gap-2 rounded-[14px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.52)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.92),hsl(var(--secondary)_/_0.7))] px-3 py-2 text-sm font-semibold text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--stardust-gold)_/_0.48)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0 motion-reduce:transition-none",
  desktopPanelInput:
    "h-11 rounded-[16px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.52)] bg-card/[0.88] px-4 text-[15px] font-semibold text-foreground placeholder:text-muted-foreground shadow-[inset_0_1px_2px_rgba(58,121,158,0.08)] focus-visible:border-[hsl(var(--celestial-blue)_/_0.78)] focus-visible:ring-2 focus-visible:ring-celestial-blue/25 focus-visible:ring-offset-0",
} as const;

export const QUEST_TEMPLATE_BROWSER_STYLES = {
  header:
    "border-b-[2px] border-[hsl(var(--celestial-blue)_/_0.46)] bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.14),transparent_44%),linear-gradient(180deg,hsl(var(--card)_/_0.9),hsl(var(--secondary)_/_0.62))] shadow-[0_14px_30px_-28px_rgba(92,157,198,0.36)]",
  tabList:
    "grid w-full grid-cols-2 rounded-[22px] border-[2px] border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.7] p-1 shadow-[inset_0_1px_2px_rgba(58,121,158,0.08)]",
  tabTrigger:
    "rounded-[18px] text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:border-[2px] data-[state=active]:border-[hsl(var(--stardust-gold)_/_0.52)] data-[state=active]:bg-[linear-gradient(180deg,hsl(var(--card)_/_0.94)_0%,hsl(var(--stardust-gold)_/_0.14)_55%,hsl(var(--celestial-blue)_/_0.12)_100%)] data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_22px_-20px_rgba(137,103,214,0.34),inset_0_1px_0_rgba(255,255,255,0.82)]",
  searchInput: "border-[2px] border-[hsl(var(--celestial-blue)_/_0.52)] bg-card/[0.88] text-foreground placeholder:text-muted-foreground focus-visible:border-[hsl(var(--celestial-blue)_/_0.78)] focus-visible:ring-celestial-blue/25",
  filterChip:
    "shrink-0 rounded-full border-[2px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
  filterChipActive: "border-[hsl(var(--stardust-gold)_/_0.52)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.94)_0%,hsl(var(--stardust-gold)_/_0.14)_55%,hsl(var(--celestial-blue)_/_0.12)_100%)] text-foreground shadow-[0_10px_22px_-20px_rgba(137,103,214,0.34),inset_0_1px_0_rgba(255,255,255,0.82)]",
  filterChipInactive: "border-[hsl(var(--border)_/_0.72)] bg-card/[0.64] text-muted-foreground hover:bg-card hover:text-foreground",
  row:
    "w-full rounded-[22px] border-[2px] px-4 py-4 text-left transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  rowHighlighted:
    "border-[hsl(var(--stardust-gold)_/_0.42)] bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.1),transparent_34%),linear-gradient(180deg,hsl(var(--card)_/_0.96)_0%,hsl(var(--secondary)_/_0.72)_100%)] text-foreground shadow-[0_16px_38px_-32px_rgba(137,103,214,0.34),inset_0_1px_0_rgba(255,255,255,0.84)]",
  rowDefault:
    "border-[hsl(var(--celestial-blue)_/_0.38)] bg-card/[0.7] text-foreground shadow-[0_12px_28px_-26px_rgba(92,157,198,0.34),inset_0_1px_0_rgba(255,255,255,0.76)]",
  emptyState:
    "rounded-[22px] border-[2px] border-dashed border-[hsl(var(--border)_/_0.72)] bg-card/[0.48] px-5 py-10 text-center shadow-[inset_0_1px_2px_rgba(58,121,158,0.08)]",
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
    active ? DIFFICULTY_COLORS[difficulty].iconBubble : "border-[hsl(var(--border)_/_0.72)] bg-card/[0.72] text-muted-foreground",
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
      ? cn(activeTone ?? DIFFICULTY_COLORS.medium.pill, "shadow-[0_10px_22px_-18px_rgba(92,157,198,0.38),inset_0_1px_0_rgba(255,255,255,0.88)]")
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

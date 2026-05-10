export type PlannerPathfinderThemeMode = "light" | "dark";

const lightModeVars = [
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
  "[--epic-nature:155_62%_44%]",
  "[--deep-space:224_44%_14%]",
].join(" ");

const darkModeVars = [
  "[--background:224_42%_10%]",
  "[--foreground:210_40%_96%]",
  "[--card:226_32%_16%]",
  "[--card-foreground:210_40%_96%]",
  "[--secondary:224_28%_21%]",
  "[--secondary-foreground:210_40%_96%]",
  "[--muted:224_24%_23%]",
  "[--muted-foreground:217_17%_72%]",
  "[--border:214_32%_29%]",
  "[--input:224_28%_21%]",
  "[--popover:226_32%_16%]",
  "[--popover-foreground:210_40%_96%]",
  "[--primary:201_92%_58%]",
  "[--primary-foreground:222_42%_12%]",
  "[--accent:202_70%_24%]",
  "[--accent-foreground:210_40%_96%]",
  "[--ring:201_92%_58%]",
  "[--celestial-blue:202_88%_58%]",
  "[--stardust-gold:43_92%_64%]",
  "[--nebula-pink:334_70%_62%]",
  "[--category-soul:192_78%_56%]",
  "[--epic-nature:151_66%_48%]",
  "[--deep-space:224_42%_9%]",
].join(" ");

export const plannerPathfinderTheme = {
  modeVars: {
    light: lightModeVars,
    dark: darkModeVars,
  },
  shell:
    "relative min-w-0 overflow-hidden rounded-[2.25rem] border-2 border-[hsl(var(--celestial-blue)_/_0.58)] bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.28),transparent_32%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.1),transparent_36%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_50%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_24px_70px_-48px_rgba(92,157,198,0.54),inset_0_1px_0_rgba(255,255,255,0.86)]",
  shellGloss:
    "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(255,255,255,0.18)_18%,transparent_52%,rgba(255,255,255,0.2)_100%)]",
  shellGlow:
    "pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.24),transparent_68%)] blur-sm",
  threadPickerShell:
    "rounded-[2rem] border-2 border-[hsl(var(--celestial-blue)_/_0.5)] bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.1),transparent_38%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_100%)] p-4 text-foreground shadow-[0_22px_64px_-46px_rgba(92,157,198,0.5),inset_0_1px_0_rgba(255,255,255,0.82)]",
  shellBody: "relative flex min-h-0 min-w-0 flex-col p-4 sm:p-5",
  headerBar:
    "flex min-w-0 items-center gap-3 rounded-[1.8rem] border border-[hsl(var(--celestial-blue)_/_0.48)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,hsl(var(--card)_/_0.94)_48%,hsl(var(--secondary)_/_0.7)_100%)] px-4 py-3 shadow-[0_14px_32px_-28px_rgba(92,157,198,0.5),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-xl",
  contentWell:
    "mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border-2 border-[hsl(var(--celestial-blue)_/_0.42)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.88),hsl(var(--secondary)_/_0.5))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_18px_46px_-38px_rgba(92,157,198,0.42)]",
  footerBar:
    "border-t border-[hsl(var(--celestial-blue)_/_0.36)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.88),hsl(var(--secondary)_/_0.76))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5",
  scrollWell:
    "relative z-10 mx-4 mt-3 min-h-0 flex-1 rounded-[2rem] border-2 border-[hsl(var(--celestial-blue)_/_0.42)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.9),hsl(var(--secondary)_/_0.5))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_18px_46px_-38px_rgba(92,157,198,0.42)] sm:mx-5",
  portalSurface:
    "rounded-[1.25rem] border border-[hsl(var(--celestial-blue)_/_0.4)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.72)_100%)] text-foreground shadow-[0_18px_42px_-32px_rgba(92,157,198,0.46),inset_0_1px_0_rgba(255,255,255,0.82)]",
  raisedPanel:
    "rounded-[1.8rem] border border-[hsl(var(--celestial-blue)_/_0.4)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.52)_100%)] text-foreground shadow-[0_16px_38px_-32px_rgba(92,157,198,0.42),inset_0_1px_0_rgba(255,255,255,0.84)]",
  mutedPanel:
    "rounded-[1.5rem] border border-[hsl(var(--celestial-blue)_/_0.32)] bg-card/[0.78] text-foreground shadow-[0_12px_30px_-28px_rgba(92,157,198,0.34),inset_0_1px_0_rgba(255,255,255,0.7)]",
  successCard:
    "rounded-[1.6rem] border border-epic-nature/30 bg-[linear-gradient(180deg,hsl(var(--epic-nature)_/_0.12)_0%,hsl(var(--category-soul)_/_0.08)_100%)] text-foreground shadow-[0_14px_32px_-30px_rgba(48,130,112,0.34)]",
  primaryButton:
    "rounded-full border border-[hsl(var(--celestial-blue)_/_0.58)] bg-[linear-gradient(180deg,#eaf8ff_0%,hsl(var(--celestial-blue)_/_0.44)_46%,hsl(var(--primary)_/_0.72)_100%)] text-[hsl(var(--deep-space))] shadow-[0_12px_26px_-20px_rgba(73,155,205,0.58),inset_0_1px_0_rgba(255,255,255,0.9)] hover:bg-[linear-gradient(180deg,#f4fbff_0%,hsl(var(--celestial-blue)_/_0.52)_46%,hsl(var(--primary)_/_0.82)_100%)] disabled:shadow-none disabled:opacity-70",
  outlineButton:
    "rounded-full border border-[hsl(var(--celestial-blue)_/_0.42)] bg-card/[0.82] text-foreground shadow-[0_10px_24px_-22px_rgba(92,157,198,0.38),inset_0_1px_0_rgba(255,255,255,0.76)] hover:border-[hsl(var(--celestial-blue)_/_0.62)] hover:bg-card disabled:shadow-none",
  headerIconButton:
    "rounded-[1rem] border border-[hsl(var(--celestial-blue)_/_0.42)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),hsl(var(--card)_/_0.78))] text-foreground shadow-[0_10px_22px_-20px_rgba(92,157,198,0.44),inset_0_1px_0_rgba(255,255,255,0.82)] hover:border-[hsl(var(--celestial-blue)_/_0.62)] hover:bg-card",
  heroIcon:
    "inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[hsl(var(--celestial-blue)_/_0.5)] bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.2)_58%,hsl(var(--stardust-gold)_/_0.12)_100%)] text-[hsl(var(--category-soul))] shadow-[0_10px_22px_-20px_rgba(92,157,198,0.44),inset_0_1px_0_rgba(255,255,255,0.9)]",
  composerBar:
    "flex items-center gap-2 rounded-[1.7rem] border border-[hsl(var(--celestial-blue)_/_0.42)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.68)_100%)] p-2 shadow-[0_14px_32px_-30px_rgba(92,157,198,0.4),inset_0_1px_0_rgba(255,255,255,0.8)]",
  textField:
    "rounded-[1.4rem] border border-[hsl(var(--celestial-blue)_/_0.48)] bg-card/[0.9] px-4 py-3 text-foreground placeholder:text-muted-foreground shadow-[inset_0_1px_2px_rgba(58,121,158,0.08)] focus-visible:border-[hsl(var(--celestial-blue)_/_0.72)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--celestial-blue)_/_0.24)] focus-visible:ring-offset-0",
  chip: "border border-[hsl(var(--celestial-blue)_/_0.38)] bg-card/[0.78] text-foreground",
  sectionEyebrow: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--category-soul))]",
  assistantBubble:
    "rounded-bl-[0.7rem] border-[hsl(var(--celestial-blue)_/_0.42)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.54)_100%)] text-foreground",
  userBubble:
    "rounded-br-[0.7rem] border-[hsl(var(--stardust-gold)_/_0.32)] bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.14)_0%,hsl(var(--celestial-blue)_/_0.18)_100%)] text-foreground",
} as const;

export type PlannerPathfinderTheme = typeof plannerPathfinderTheme;

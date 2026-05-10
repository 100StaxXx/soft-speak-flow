export type PlannerPathfinderThemeMode = "light" | "dark";

const lightModeVars = [
  "[--background:205_100%_98%]",
  "[--foreground:222_42%_16%]",
  "[--card:0_0%_100%]",
  "[--card-foreground:222_42%_16%]",
  "[--secondary:208_68%_95%]",
  "[--secondary-foreground:222_42%_16%]",
  "[--muted:210_48%_92%]",
  "[--muted-foreground:217_17%_43%]",
  "[--border:204_50%_78%]",
  "[--input:203_82%_93%]",
  "[--popover:0_0%_100%]",
  "[--popover-foreground:222_42%_16%]",
  "[--primary:199_91%_42%]",
  "[--primary-foreground:0_0%_100%]",
  "[--accent:201_90%_90%]",
  "[--accent-foreground:222_42%_16%]",
  "[--ring:199_91%_48%]",
  "[--celestial-blue:199_91%_50%]",
  "[--stardust-gold:42_94%_58%]",
  "[--nebula-pink:336_74%_65%]",
  "[--category-soul:190_84%_45%]",
  "[--epic-nature:155_62%_44%]",
  "[--deep-space:222_42%_15%]",
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
    "relative min-w-0 overflow-hidden rounded-[2.25rem] border-2 border-[hsl(var(--celestial-blue)_/_0.38)] bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.24),transparent_34%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.12),transparent_36%),radial-gradient(circle_at_bottom,hsl(var(--stardust-gold)_/_0.16),transparent_38%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_54%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_26px_76px_-44px_rgba(28,87,135,0.58),inset_0_1px_0_rgba(255,255,255,0.72)]",
  shellGloss:
    "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.08)_18%,transparent_50%,rgba(255,255,255,0.12)_100%)]",
  shellGlow:
    "pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-[radial-gradient(circle_at_top,hsl(var(--celestial-blue)_/_0.24),transparent_68%)] blur-sm",
  threadPickerShell:
    "rounded-[2rem] border-2 border-[hsl(var(--celestial-blue)_/_0.36)] bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.12),transparent_38%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_100%)] p-4 text-foreground shadow-[0_24px_70px_-44px_rgba(28,87,135,0.52),inset_0_1px_0_rgba(255,255,255,0.7)]",
  shellBody: "relative flex min-h-0 min-w-0 flex-col p-4 sm:p-5",
  headerBar:
    "flex min-w-0 items-center gap-3 rounded-[1.8rem] border border-[hsl(var(--celestial-blue)_/_0.3)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,hsl(var(--card)_/_0.9)_42%,hsl(var(--secondary)_/_0.86)_100%)] px-4 py-3 shadow-[0_14px_34px_-26px_rgba(28,87,135,0.58),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl",
  contentWell:
    "mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border-2 border-[hsl(var(--celestial-blue)_/_0.24)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.72),hsl(var(--secondary)_/_0.58))] shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_18px_46px_-36px_rgba(28,87,135,0.46)]",
  footerBar:
    "border-t border-[hsl(var(--celestial-blue)_/_0.22)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.78),hsl(var(--secondary)_/_0.86))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] sm:p-5",
  scrollWell:
    "relative z-10 mx-4 mt-3 min-h-0 flex-1 rounded-[2rem] border-2 border-[hsl(var(--celestial-blue)_/_0.24)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.72),hsl(var(--secondary)_/_0.58))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_18px_46px_-36px_rgba(28,87,135,0.46)] sm:mx-5",
  portalSurface:
    "rounded-[1.25rem] border border-[hsl(var(--celestial-blue)_/_0.24)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.84)_100%)] text-foreground shadow-[0_18px_42px_-30px_rgba(28,87,135,0.52),inset_0_1px_0_rgba(255,255,255,0.72)]",
  raisedPanel:
    "rounded-[1.8rem] border border-[hsl(var(--celestial-blue)_/_0.22)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96)_0%,hsl(var(--secondary)_/_0.72)_100%)] text-foreground shadow-[0_16px_38px_-30px_rgba(28,87,135,0.48),inset_0_1px_0_rgba(255,255,255,0.72)]",
  mutedPanel:
    "rounded-[1.5rem] border border-[hsl(var(--celestial-blue)_/_0.2)] bg-card/[0.72] text-foreground shadow-[0_12px_30px_-26px_rgba(28,87,135,0.36),inset_0_1px_0_rgba(255,255,255,0.58)]",
  successCard:
    "rounded-[1.6rem] border border-epic-nature/30 bg-[linear-gradient(180deg,hsl(var(--epic-nature)_/_0.14)_0%,hsl(var(--category-soul)_/_0.08)_100%)] text-foreground shadow-[0_14px_32px_-28px_rgba(40,120,92,0.42)]",
  primaryButton:
    "rounded-full border border-[hsl(var(--celestial-blue)_/_0.36)] bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.18)_42%,hsl(var(--celestial-blue)_/_0.42)_100%)] text-[hsl(var(--deep-space))] shadow-[0_12px_26px_-18px_rgba(28,117,177,0.62),inset_0_1px_0_rgba(255,255,255,0.9)] hover:bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.22)_42%,hsl(var(--celestial-blue)_/_0.5)_100%)] disabled:shadow-none",
  outlineButton:
    "rounded-full border border-[hsl(var(--celestial-blue)_/_0.26)] bg-card/[0.74] text-foreground shadow-[0_10px_24px_-20px_rgba(28,87,135,0.42),inset_0_1px_0_rgba(255,255,255,0.68)] hover:border-[hsl(var(--celestial-blue)_/_0.46)] hover:bg-card disabled:shadow-none",
  headerIconButton:
    "rounded-[1rem] border border-[hsl(var(--celestial-blue)_/_0.28)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),hsl(var(--card)_/_0.72))] text-foreground shadow-[0_10px_22px_-18px_rgba(28,87,135,0.48),inset_0_1px_0_rgba(255,255,255,0.74)] hover:border-[hsl(var(--celestial-blue)_/_0.44)] hover:bg-card",
  heroIcon:
    "inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[hsl(var(--celestial-blue)_/_0.34)] bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.16)_58%,hsl(var(--stardust-gold)_/_0.18)_100%)] text-[hsl(var(--celestial-blue))] shadow-[0_10px_22px_-18px_rgba(28,87,135,0.5),inset_0_1px_0_rgba(255,255,255,0.9)]",
  composerBar:
    "flex items-center gap-2 rounded-[1.7rem] border border-[hsl(var(--celestial-blue)_/_0.24)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96)_0%,hsl(var(--secondary)_/_0.74)_100%)] p-2 shadow-[0_14px_32px_-28px_rgba(28,87,135,0.44),inset_0_1px_0_rgba(255,255,255,0.7)]",
  textField:
    "rounded-[1.4rem] border border-[hsl(var(--celestial-blue)_/_0.28)] bg-card/[0.82] px-4 py-3 text-foreground placeholder:text-muted-foreground shadow-[inset_0_1px_2px_rgba(18,59,96,0.08)] focus-visible:border-[hsl(var(--celestial-blue)_/_0.62)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--celestial-blue)_/_0.22)] focus-visible:ring-offset-0",
  chip: "border border-[hsl(var(--celestial-blue)_/_0.24)] bg-card/[0.72] text-foreground",
  sectionEyebrow: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--celestial-blue))]",
  assistantBubble:
    "rounded-bl-[0.7rem] border-[hsl(var(--celestial-blue)_/_0.22)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96)_0%,hsl(var(--secondary)_/_0.72)_100%)] text-foreground",
  userBubble:
    "rounded-br-[0.7rem] border-[hsl(var(--stardust-gold)_/_0.36)] bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.18)_0%,hsl(var(--celestial-blue)_/_0.12)_100%)] text-foreground",
} as const;

export type PlannerPathfinderTheme = typeof plannerPathfinderTheme;

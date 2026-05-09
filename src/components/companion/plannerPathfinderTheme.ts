export const plannerPathfinderTheme = {
  shell:
    "relative min-w-0 overflow-hidden rounded-[2.25rem] border-[4px] border-celestial-blue/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.22),transparent_24%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.16),transparent_28%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.18),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_62%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_18px_0_hsl(var(--stardust-gold)_/_0.42),0_34px_90px_-36px_hsl(var(--celestial-blue)_/_0.5)]",
  shellGloss:
    "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--foreground)_/_0.12),transparent_18%,transparent_78%,hsl(var(--background)_/_0.12))]",
  shellGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,hsl(var(--stardust-gold)_/_0.28),transparent_62%)]",
  threadPickerShell:
    "rounded-[2rem] border-[3px] border-celestial-blue/55 bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.2),transparent_26%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.14),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--stardust-gold)_/_0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_100%)] p-4 text-foreground shadow-[0_16px_0_hsl(var(--stardust-gold)_/_0.38),0_28px_70px_-36px_hsl(var(--celestial-blue)_/_0.55)]",
  shellBody: "relative flex min-h-0 min-w-0 flex-col p-4 sm:p-5",
  headerBar:
    "flex min-w-0 items-center gap-3 rounded-[1.8rem] border-[3px] border-stardust-gold/45 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.16),transparent_28%),radial-gradient(circle_at_top_right,hsl(var(--nebula-pink)_/_0.12),transparent_32%),linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.16),hsl(var(--epic-nature)_/_0.1))] px-4 py-3 shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.38)]",
  contentWell:
    "mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border-[4px] border-category-soul/45 bg-[radial-gradient(circle_at_top_left,hsl(var(--stardust-gold)_/_0.1),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--epic-nature)_/_0.1),transparent_34%),linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.1),hsl(var(--nebula-pink)_/_0.06))] shadow-[0_12px_0_hsl(var(--stardust-gold)_/_0.38),0_26px_50px_-36px_hsl(var(--category-soul)_/_0.42)]",
  footerBar:
    "border-t-[3px] border-category-soul/45 bg-[linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.12),hsl(var(--stardust-gold)_/_0.08),hsl(var(--epic-nature)_/_0.08))] p-4 sm:p-5",
  raisedPanel:
    "rounded-[1.8rem] border-[3px] border-stardust-gold/45 bg-[radial-gradient(circle_at_top_left,hsl(var(--celestial-blue)_/_0.1),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--nebula-pink)_/_0.1),transparent_34%),linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] text-foreground shadow-[0_8px_0_hsl(var(--epic-nature)_/_0.34),0_18px_34px_-28px_hsl(var(--stardust-gold)_/_0.38)]",
  mutedPanel:
    "rounded-[1.5rem] border-[3px] border-celestial-blue/30 bg-card/70 text-foreground shadow-[0_8px_0_hsl(var(--stardust-gold)_/_0.16)]",
  successCard:
    "rounded-[1.6rem] border-[3px] border-epic-nature/55 bg-[linear-gradient(180deg,hsl(var(--epic-nature)_/_0.24)_0%,hsl(var(--category-soul)_/_0.16)_100%)] text-foreground shadow-[0_8px_0_hsl(var(--epic-nature)_/_0.34)]",
  primaryButton:
    "rounded-full border-[3px] border-stardust-gold/75 bg-[linear-gradient(180deg,hsl(var(--stardust-gold))_0%,hsl(var(--nebula-pink))_100%)] text-[hsl(var(--deep-space))] shadow-[0_6px_0_hsl(var(--stardust-gold)_/_0.44)] hover:bg-[linear-gradient(180deg,hsl(var(--stardust-gold))_0%,hsl(var(--nebula-pink))_100%)] disabled:shadow-none",
  outlineButton:
    "rounded-full border-[3px] border-celestial-blue/35 bg-card/70 text-foreground shadow-[0_6px_0_hsl(var(--stardust-gold)_/_0.16)] hover:border-stardust-gold/45 hover:bg-card disabled:shadow-none",
  headerIconButton:
    "rounded-[1rem] border-[3px] border-nebula-pink/45 bg-[linear-gradient(180deg,hsl(var(--nebula-pink)_/_0.2),hsl(var(--category-soul)_/_0.14))] text-foreground hover:bg-[linear-gradient(180deg,hsl(var(--nebula-pink)_/_0.26),hsl(var(--category-soul)_/_0.2))]",
  composerBar:
    "flex items-center gap-2 rounded-[1.7rem] border-[3px] border-category-soul/45 bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] p-2 shadow-[0_8px_0_hsl(var(--epic-nature)_/_0.32)]",
  textField:
    "rounded-[1.4rem] border-[3px] border-celestial-blue/45 bg-card/80 px-4 py-3 text-foreground placeholder:text-muted-foreground focus-visible:border-stardust-gold/70 focus-visible:ring-2 focus-visible:ring-stardust-gold/35 focus-visible:ring-offset-0",
  chip: "border-[3px] border-border/70 bg-card/70 text-foreground",
  sectionEyebrow: "text-[11px] font-semibold uppercase tracking-[0.18em] text-stardust-gold/85",
  assistantBubble:
    "rounded-bl-[0.7rem] border-category-soul/45 bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.9)_100%)] text-foreground",
  userBubble:
    "rounded-br-[0.7rem] border-stardust-gold/55 bg-[linear-gradient(180deg,hsl(var(--stardust-gold)_/_0.2)_0%,hsl(var(--nebula-pink)_/_0.14)_55%,hsl(var(--category-soul)_/_0.12)_100%)] text-foreground",
} as const;

export type PlannerPathfinderTheme = typeof plannerPathfinderTheme;

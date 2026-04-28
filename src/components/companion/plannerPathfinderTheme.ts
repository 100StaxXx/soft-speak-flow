export const plannerPathfinderTheme = {
  shell:
    "relative min-w-0 overflow-hidden rounded-[2.25rem] border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,247,199,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(254,151,54,0.18),transparent_28%),linear-gradient(180deg,#a23518_0%,#701d0d_62%,#4a1209_100%)] text-white shadow-[0_18px_0_#4d2811,0_34px_90px_-36px_rgba(38,12,5,0.62)]",
  shellGloss:
    "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent_18%,transparent_78%,rgba(74,18,9,0.1))]",
  shellGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,248,212,0.36),transparent_62%)]",
  threadPickerShell:
    "rounded-[2rem] border-[3px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,245,194,0.22),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(254,138,44,0.18),transparent_30%),linear-gradient(180deg,#8f2f15_0%,#5f180b_100%)] p-4 text-white shadow-[0_16px_0_#3f1308,0_28px_70px_-36px_rgba(43,14,4,0.7)]",
  shellBody: "relative flex min-h-0 min-w-0 flex-col p-4 sm:p-5",
  headerBar:
    "flex min-w-0 items-center gap-3 rounded-[1.8rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,251,239,0.2),rgba(255,206,105,0.14))] px-4 py-3 shadow-[0_8px_0_rgba(77,40,17,0.85)]",
  contentWell:
    "mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border-[4px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,248,225,0.14),rgba(255,187,88,0.1))] shadow-[0_12px_0_rgba(77,40,17,0.84),0_26px_50px_-36px_rgba(34,11,4,0.6)]",
  footerBar:
    "border-t-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,248,225,0.18),rgba(255,193,90,0.14))] p-4 sm:p-5",
  raisedPanel:
    "rounded-[1.8rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e8_0%,#ffcf6e_100%)] text-[#4f240c] shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.5)]",
  mutedPanel:
    "rounded-[1.5rem] border-[3px] border-[#6b3416] bg-white/60 text-[#5d2a0f] shadow-[0_8px_0_rgba(77,40,17,0.16)]",
  successCard:
    "rounded-[1.6rem] border-[3px] border-[#315114] bg-[linear-gradient(180deg,#e0ff9d_0%,#a9df46_100%)] text-[#183304] shadow-[0_8px_0_rgba(49,81,20,0.75)]",
  primaryButton:
    "rounded-full border-[3px] border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304] shadow-[0_6px_0_rgba(49,81,20,0.45)] hover:bg-[linear-gradient(180deg,#e3ff9e_0%,#a6e145_100%)] disabled:shadow-none",
  outlineButton:
    "rounded-full border-[3px] border-[#6b3416] bg-white/60 text-[#6b3416] shadow-[0_6px_0_rgba(77,40,17,0.16)] hover:bg-white/75 disabled:shadow-none",
  headerIconButton:
    "rounded-[1rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,246,221,0.2),rgba(255,191,89,0.16))] text-white hover:bg-[linear-gradient(180deg,rgba(255,250,236,0.24),rgba(255,191,89,0.2))]",
  composerBar:
    "flex items-center gap-2 rounded-[1.7rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e8_0%,#ffc861_100%)] p-2 shadow-[0_8px_0_rgba(77,40,17,0.8)]",
  textField:
    "rounded-[1.4rem] border-[3px] border-[#6b3416] bg-white/80 px-4 py-3 text-[#4d2811] placeholder:text-[#9a6d47] focus-visible:border-[#d48635] focus-visible:ring-2 focus-visible:ring-[#f3be54] focus-visible:ring-offset-0",
  chip: "border-[3px] border-[#6b3416] bg-white/60 text-[#5d2a0f]",
  sectionEyebrow: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d481c]/72",
  assistantBubble:
    "rounded-bl-[0.7rem] border-[#4d2811] bg-[linear-gradient(180deg,#fff8e9_0%,#ffd579_100%)] text-[#4f240c]",
  userBubble:
    "rounded-br-[0.7rem] border-[#3b4f0d] bg-[linear-gradient(180deg,#d7ff86_0%,#98d83b_100%)] text-[#183304]",
} as const;

export type PlannerPathfinderTheme = typeof plannerPathfinderTheme;

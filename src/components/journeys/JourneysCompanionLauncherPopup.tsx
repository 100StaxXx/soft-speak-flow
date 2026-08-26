import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  CalendarCheck,
  Clock3,
  MessageCircle,
  Plus,
  Sparkles,
} from "lucide-react";
import type { FABPopupAlignment } from "@/hooks/useDraggableFAB";
import { cn } from "@/lib/utils";
import type { JourneysCompanionLauncherTemplate } from "@/shared/journeysCompanionLauncherTemplates";

interface JourneysCompanionLauncherPopupProps {
  open: boolean;
  alignment: FABPopupAlignment;
  companionLabel: string;
  options: JourneysCompanionLauncherTemplate[];
  onSelect: (option: JourneysCompanionLauncherTemplate) => void;
  onOpenHistory: () => void;
  popupStyle?: CSSProperties;
  tailStyle?: CSSProperties;
}

const POPUP_VERTICAL_CLASSNAME: Record<FABPopupAlignment["vertical"], string> = {
  top: "top-[calc(100%+16px)] origin-top",
  bottom: "bottom-[calc(100%+16px)] origin-bottom",
};

const TAIL_VERTICAL_CLASSNAME: Record<FABPopupAlignment["vertical"], string> = {
  top: "-top-3",
  bottom: "-bottom-3",
};

const TAIL_ROTATION_CLASSNAME: Record<FABPopupAlignment["vertical"], string> = {
  top: "rotate-45",
  bottom: "rotate-[225deg]",
};

const OPTION_META: Record<
  JourneysCompanionLauncherTemplate["id"],
  {
    label?: string;
    Icon: typeof MessageCircle;
    className: string;
    iconClassName: string;
  }
> = {
  "free-talk": {
    Icon: MessageCircle,
    className: "border-white/10 bg-white/[0.06] text-white",
    iconClassName: "bg-cyan-300/10 text-cyan-200",
  },
  "plan-day": {
    Icon: CalendarCheck,
    className: "border-white/10 bg-white/[0.06] text-white",
    iconClassName: "bg-violet-300/10 text-violet-200",
  },
  upcoming: {
    label: "Coming up",
    Icon: Clock3,
    className: "border-white/10 bg-white/[0.06] text-white",
    iconClassName: "bg-emerald-300/10 text-emerald-200",
  },
  quest: {
    Icon: Sparkles,
    className: "border-white/10 bg-white/[0.06] text-white",
    iconClassName: "bg-amber-300/10 text-amber-200",
  },
  goal: {
    label: "New goal",
    Icon: Plus,
    className: "border-white/10 bg-white/[0.06] text-white",
    iconClassName: "bg-fuchsia-300/10 text-fuchsia-200",
  },
};

export function JourneysCompanionLauncherPopup({
  open,
  alignment,
  companionLabel,
  options,
  onSelect,
  onOpenHistory,
  popupStyle,
  tailStyle,
}: JourneysCompanionLauncherPopupProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: alignment.vertical === "bottom" ? 10 : -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: alignment.vertical === "bottom" ? 6 : -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "absolute z-[70] w-[min(19rem,calc(100vw-2rem))]",
            POPUP_VERTICAL_CLASSNAME[alignment.vertical],
          )}
          style={popupStyle}
          role="dialog"
          aria-modal="false"
          aria-label={`${companionLabel} quick actions`}
          data-testid="journeys-companion-launcher-popup"
          data-popup-horizontal={alignment.horizontal}
          data-popup-vertical={alignment.vertical}
        >
          <div className="relative rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(28,25,46,0.97),rgba(13,11,23,0.97))] p-3 shadow-[0_24px_52px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute h-6 w-6 border-b border-r border-white/10 bg-[#171328]",
                TAIL_VERTICAL_CLASSNAME[alignment.vertical],
                TAIL_ROTATION_CLASSNAME[alignment.vertical],
              )}
              style={tailStyle}
            />
            <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[0.7rem] font-black uppercase tracking-[0.2em] text-cyan-200">
                  {companionLabel}
                </p>
                <p className="text-xs font-semibold text-white/55">
                  Pick a planner starter
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Open past chats"
                data-testid="journeys-companion-launcher-history-button"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {options.map((option, index) => {
                const meta = OPTION_META[option.id];
                const Icon = meta.Icon;
                const label = meta.label ?? option.label;

                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.01 * index, duration: 0.1 }}
                    className={cn(
                      "flex min-h-[4.25rem] flex-col items-start justify-between gap-2 rounded-[1.1rem] border px-3 py-2.5 text-left shadow-[0_10px_20px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.09]",
                      option.id === "free-talk" && "col-span-2 min-h-[3.5rem] flex-row items-center justify-start",
                      meta.className,
                    )}
                    onClick={() => onSelect(option)}
                    data-tour={`companion-launcher-option-${option.id}`}
                    data-tour-shape="rounded-rect"
                    data-testid={`journeys-companion-launcher-option-${option.id}`}
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-current/35",
                        meta.iconClassName,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[0.78rem] font-black leading-4 sm:text-[0.82rem]">
                      {label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  CalendarCheck,
  Clock3,
  MessageCircle,
  Plus,
  RotateCcw,
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
    className: "border-[#6b3416] bg-[linear-gradient(180deg,#fffdf7_0%,#fff1cb_100%)] text-[#3c1f10]",
    iconClassName: "bg-[#fff7dc] text-[#b04b12]",
  },
  "plan-day": {
    label: "Plan day",
    Icon: CalendarCheck,
    className: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10]",
    iconClassName: "bg-[#fff7dc] text-[#b04b12]",
  },
  "adjust-day": {
    label: "Adjust day",
    Icon: RotateCcw,
    className: "border-[#7a3b14] bg-[linear-gradient(180deg,#ffd7aa_0%,#ffae52_100%)] text-[#5b2608]",
    iconClassName: "bg-white/55 text-[#5b2608]",
  },
  "right-now": {
    label: "Right now",
    Icon: Clock3,
    className: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10]",
    iconClassName: "bg-[#fff7dc] text-[#b04b12]",
  },
  upcoming: {
    label: "Coming up",
    Icon: Clock3,
    className: "border-[#315114] bg-[linear-gradient(180deg,#d7ff86_0%,#9fda3f_100%)] text-[#183304]",
    iconClassName: "bg-white/55 text-[#183304]",
  },
  quest: {
    Icon: Sparkles,
    className: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10]",
    iconClassName: "bg-[#fff7dc] text-[#b04b12]",
  },
  goal: {
    label: "New goal",
    Icon: Plus,
    className: "border-[#6b3416] bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)] text-[#3c1f10]",
    iconClassName: "bg-[#fff7dc] text-[#b04b12]",
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
          transition={{ duration: 0.18, ease: "easeOut" }}
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
          <div className="relative rounded-[1.6rem] border-[3px] border-[#543012] bg-[linear-gradient(180deg,#fff8e7_0%,#ffe3a1_35%,#ffc861_100%)] p-3 shadow-[0_12px_0_#5f3212,0_24px_38px_rgba(55,24,5,0.42)]">
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute h-6 w-6 border-b-[3px] border-r-[3px] border-[#543012] bg-[#ffc861] shadow-[4px_4px_0_rgba(95,50,18,0.55)]",
                TAIL_VERTICAL_CLASSNAME[alignment.vertical],
                TAIL_ROTATION_CLASSNAME[alignment.vertical],
              )}
              style={tailStyle}
            />
            <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,244,210,0.88))] px-3 py-2 shadow-[inset_0_3px_0_rgba(255,255,255,0.55)]">
              <div className="min-w-0">
                <p className="truncate text-[0.7rem] font-black uppercase tracking-[0.2em] text-[#b04b12]">
                  {companionLabel}
                </p>
                <p className="text-xs font-semibold text-[#6b3416]/75">
                  Pick a planner starter
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,233,183,0.96))] text-[#b04b12] shadow-[0_3px_0_#7a3a14] transition-transform hover:-translate-y-0.5"
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.025 * index, duration: 0.16 }}
                    className={cn(
                      "flex min-h-[4.25rem] flex-col items-start justify-between gap-2 rounded-[1.1rem] border-[3px] px-3 py-2.5 text-left shadow-[0_5px_0_rgba(95,50,18,0.72),0_10px_18px_rgba(74,31,8,0.18)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(95,50,18,0.76),0_13px_20px_rgba(74,31,8,0.2)]",
                      option.id === "free-talk" && "col-span-2 min-h-[3.5rem] flex-row items-center justify-start",
                      meta.className,
                    )}
                    onClick={() => onSelect(option)}
                    data-tour={`companion-launcher-option-${option.id}`}
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

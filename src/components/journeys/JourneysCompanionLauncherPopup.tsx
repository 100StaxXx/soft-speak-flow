import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FABPopupAlignment } from "@/hooks/useDraggableFAB";
import { cn } from "@/lib/utils";
import type { JourneysCompanionLauncherTemplate } from "@/shared/journeysCompanionLauncherTemplates";

interface JourneysCompanionLauncherPopupProps {
  open: boolean;
  alignment: FABPopupAlignment;
  companionLabel: string;
  options: JourneysCompanionLauncherTemplate[];
  onSelect: (option: JourneysCompanionLauncherTemplate) => void;
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

export function JourneysCompanionLauncherPopup({
  open,
  alignment,
  companionLabel,
  options,
  onSelect,
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
            "absolute z-[70] w-[min(21rem,calc(100vw-2rem))]",
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
          <div className="relative rounded-[2rem] border-[3px] border-[#543012] bg-[linear-gradient(180deg,#fff8e7_0%,#ffe7a7_20%,#ffc861_100%)] p-4 shadow-[0_18px_0_#5f3212,0_30px_45px_rgba(55,24,5,0.45)]">
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute h-6 w-6 border-b-[3px] border-r-[3px] border-[#543012] bg-[#ffc861] shadow-[4px_4px_0_rgba(95,50,18,0.55)]",
                TAIL_VERTICAL_CLASSNAME[alignment.vertical],
                TAIL_ROTATION_CLASSNAME[alignment.vertical],
              )}
              style={tailStyle}
            />
            <div className="rounded-[1.4rem] border-2 border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,244,210,0.88))] px-4 py-3 shadow-[inset_0_3px_0_rgba(255,255,255,0.55)]">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.22em] text-[#b04b12]">
                {companionLabel}
              </p>
            </div>

            <div className="mt-3 space-y-2.5">
              {options.map((option, index) => (
                <motion.button
                  key={option.id}
                  type="button"
                  initial={{ opacity: 0, x: alignment.horizontal === "right" ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * index, duration: 0.18 }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[1.6rem] border-[3px] border-[#4b2612] px-4 py-3 text-left text-[#3c1f10] shadow-[0_8px_0_#7a3a14,0_14px_22px_rgba(74,31,8,0.22)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_0_#7a3a14,0_16px_24px_rgba(74,31,8,0.24)]",
                    option.id === "free-talk"
                      ? "bg-[linear-gradient(180deg,#fffdf7_0%,#fff1cb_100%)]"
                      : "bg-[linear-gradient(180deg,#fff8e5_0%,#ffd77d_100%)]",
                  )}
                  onClick={() => onSelect(option)}
                  data-testid={`journeys-companion-launcher-option-${option.id}`}
                >
                  <span className="text-sm font-black leading-5 sm:text-[0.98rem]">{option.label}</span>
                  <span className="shrink-0 rounded-full border-2 border-[#6b3416] bg-white/60 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#b04b12]">
                    Tap
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

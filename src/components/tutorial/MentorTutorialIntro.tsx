import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";

const INTRO_SCREENS = [
  {
    title: "Quick mentor tutorial",
    body: "This is a short guided walkthrough. Your mentor will coach you through your first actions.",
    support: "You'll move from Quests, to Companion, to Mentor in a few taps.",
    icon: Compass,
  },
  {
    title: "Follow the highlights",
    body: "We'll spotlight exactly where to tap and keep your focus on one action at a time.",
    support: "You can skip now and jump straight into the tutorial whenever you're ready.",
    icon: Sparkles,
  },
] as const;

export const MentorTutorialIntro = () => {
  const { isIntroActive, completeIntro, speakerName } = usePostOnboardingMentorGuidance();
  const [screenIndex, setScreenIndex] = useState(0);

  useEffect(() => {
    if (isIntroActive) {
      setScreenIndex(0);
    }
  }, [isIntroActive]);

  if (!isIntroActive) return null;

  const isFinalScreen = screenIndex === INTRO_SCREENS.length - 1;
  const screen = INTRO_SCREENS[screenIndex];
  const Icon = screen.icon;

  return (
    <section
      className="fixed left-0 right-0 z-[115] px-3 pointer-events-none"
      style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto max-w-sm rounded-3xl border border-border/70 bg-card/95 shadow-[0_24px_46px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
        <button
          type="button"
          onClick={completeIntro}
          aria-label="Skip tutorial intro"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenIndex}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="px-5 pt-8 pb-5"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <p className="mt-4 text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {speakerName}
            </p>
            <h2 className="mt-2 text-center text-xl font-semibold tracking-tight text-foreground">
              {screen.title}
            </h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-foreground/90">{screen.body}</p>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">{screen.support}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-1.5 pb-3">
          {INTRO_SCREENS.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === screenIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5">
          <Button type="button" variant="ghost" onClick={completeIntro}>
            Skip
          </Button>
          <Button
            type="button"
            onClick={isFinalScreen ? completeIntro : () => setScreenIndex((prev) => prev + 1)}
          >
            {isFinalScreen ? "Start Tutorial" : "Next"}
          </Button>
        </div>
      </div>
    </section>
  );
};

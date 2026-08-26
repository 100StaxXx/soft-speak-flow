import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Heart,
  Moon,
  Settings,
  Sunrise,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { EveningReflectionDrawer } from "@/components/EveningReflectionDrawer";
import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { PageTransition } from "@/components/PageTransition";
import { EarlyAccessFeedbackCard } from "@/components/EarlyAccessFeedbackCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRODUCT } from "@/config/product";
import { MentorConnectionProvider } from "@/contexts/MentorConnectionContext";
import { getChristianDailyContent } from "@/data/christianDailyContent";
import { useEveningReflection } from "@/hooks/useEveningReflection";
import { useProfile } from "@/hooks/useProfile";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { useXPRewards } from "@/hooks/useXPRewards";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getEffectiveDailyDate } from "@/utils/timezone";
import {
  clearEveningReflectionOpenRequest,
  isEveningReflectionOpenRequest,
} from "@/utils/eveningReflectionNavigation";

const getGreeting = (date: Date): string => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function Today() {
  const now = useMemo(() => new Date(), []);
  const dailyContent = useMemo(() => getChristianDailyContent(now), [now]);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const { awardCheckInComplete } = useXPRewards();
  const { currentStep, isIntroDialogueActive } = usePostOnboardingMentorGuidance();
  const tutorialPrayerCompletionRef = useRef<string | null>(null);
  const effectiveDailyDate = useMemo(
    () => getEffectiveDailyDate(profile?.timezone ?? undefined),
    [profile?.timezone],
  );
  const { data: prayerAlreadyCompleted = false, isLoading: isPrayerStatusLoading } = useQuery({
    queryKey: ["daily-prayer-completion", profile?.id, effectiveDailyDate],
    queryFn: async () => {
      if (!profile?.id) return false;
      const { data, error } = await supabase
        .from("xp_events")
        .select("id")
        .eq("user_id", profile.id)
        .eq("event_type", "check_in")
        .eq("idempotency_key", `morning-prayer:${effectiveDailyDate}`)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },
    enabled: Boolean(profile?.id),
    staleTime: 60_000,
  });
  const {
    isEvening,
    hasCompletedToday: hasCompletedEveningReflection,
    isLoading: isEveningReflectionLoading,
  } = useEveningReflection();
  const [isDevotionalOpen, setIsDevotionalOpen] = useState(false);
  const [prayerCompleted, setPrayerCompleted] = useState(false);
  const [isExamenOpen, setIsExamenOpen] = useState(false);
  const isTutorialReflectionPrompt =
    currentStep === "morning_checkin" &&
    !isIntroDialogueActive &&
    !isDevotionalOpen &&
    !prayerCompleted &&
    !prayerAlreadyCompleted &&
    !isPrayerStatusLoading;

  useEffect(() => {
    if (prayerAlreadyCompleted) setPrayerCompleted(true);
  }, [prayerAlreadyCompleted]);

  useEffect(() => {
    if (currentStep !== "morning_checkin" || isIntroDialogueActive) return;
    if (!prayerAlreadyCompleted && !prayerCompleted) return;
    if (tutorialPrayerCompletionRef.current === effectiveDailyDate) return;

    tutorialPrayerCompletionRef.current = effectiveDailyDate;
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
    });
  }, [
    currentStep,
    effectiveDailyDate,
    isIntroDialogueActive,
    prayerAlreadyCompleted,
    prayerCompleted,
  ]);

  useEffect(() => {
    if (!isEveningReflectionOpenRequest(location.search) || isEveningReflectionLoading) return;

    if (isEvening && !hasCompletedEveningReflection) {
      setIsExamenOpen(true);
      return;
    }

    navigate(
      { pathname: location.pathname, search: clearEveningReflectionOpenRequest(location.search) },
      { replace: true },
    );
  }, [
    hasCompletedEveningReflection,
    isEvening,
    isEveningReflectionLoading,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (isEvening && !hasCompletedEveningReflection) return;
    setIsExamenOpen(false);
  }, [hasCompletedEveningReflection, isEvening]);

  useEffect(() => {
    if (location.hash !== "#daily-adventure") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  const handleExamenOpenChange = (open: boolean) => {
    if (open && (!isEvening || hasCompletedEveningReflection)) return;
    setIsExamenOpen(open);
    if (!open && isEveningReflectionOpenRequest(location.search)) {
      navigate(
        { pathname: location.pathname, search: clearEveningReflectionOpenRequest(location.search) },
        { replace: true },
      );
    }
  };

  const handlePrayerOpen = () => {
    setIsDevotionalOpen((open) => !open);
  };

  const handlePrayerComplete = async () => {
    if (prayerCompleted) return;
    const result = await awardCheckInComplete({
      date: effectiveDailyDate,
    });
    setPrayerCompleted(Boolean(result));
  };

  return (
    <PageTransition mode="instant">
      <CinematicPageBackground preset="quests" />
      <div className="daily-way-page daily-way-scenic-page relative z-10 min-h-screen pb-nav-safe pt-safe text-foreground">
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6 sm:pt-7">
          <header className="flex items-start justify-between gap-4 rounded-[22px] border border-white/35 bg-card/[0.78] p-4 shadow-sm backdrop-blur-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                {PRODUCT.name}
              </p>
              <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">
                {getGreeting(now)}
              </h1>
              <p className="mt-1 text-sm text-foreground/75">
                {format(now, "EEEE, MMMM d")} · One day, already prepared.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full border border-input bg-card/70"
              onClick={() => navigate("/profile")}
              aria-label="Open settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </header>

          <main className="mt-5 space-y-4 sm:mt-6">
            <Card
              data-tour="morning-checkin"
              className="daily-way-scripture-card overflow-hidden border-primary/20 bg-card/[0.86] p-4 shadow-lg backdrop-blur-xl sm:p-5"
            >
              <div className="flex items-center gap-2 text-primary">
                <BookOpen className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">Today’s Scripture</span>
              </div>
              <blockquote className="mt-3 font-serif text-xl leading-[1.55] text-foreground sm:text-2xl">
                “{dailyContent.text}”
              </blockquote>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <cite className="not-italic font-semibold text-primary">{dailyContent.reference}</cite>
                <a
                  href={dailyContent.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground/75 underline decoration-foreground/35 underline-offset-4 hover:text-foreground"
                >
                  {dailyContent.translationLabel}
                </a>
              </div>
              <div className="mt-3 inline-flex flex-col items-start gap-2">
                {isTutorialReflectionPrompt ? (
                  <span
                    aria-hidden="true"
                    className="tutorial-reflection-nudge inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-md"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    Tap here to open
                  </span>
                ) : null}
                <Button
                  data-tour="morning-prayer-open"
                  data-tutorial-highlight={isTutorialReflectionPrompt ? "true" : undefined}
                  variant={isTutorialReflectionPrompt ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-11 rounded-xl",
                    isTutorialReflectionPrompt && "tutorial-reflection-cta",
                  )}
                  onClick={handlePrayerOpen}
                  aria-expanded={isDevotionalOpen}
                >
                  <Sunrise className="mr-2 h-4 w-4" />
                  {isDevotionalOpen
                    ? "Close reflection"
                    : isTutorialReflectionPrompt
                      ? "Open today’s reflection"
                      : "Reflect and pray"}
                </Button>
              </div>
              {isDevotionalOpen ? (
                <div className="mt-3 space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
                  <p className="text-sm leading-7 text-muted-foreground">{dailyContent.reflection}</p>
                  <p className="font-serif text-lg leading-8">{dailyContent.prayer}</p>
                  <Button
                    data-tour="morning-prayer-complete"
                    type="button"
                    variant={prayerCompleted ? "secondary" : "default"}
                    className="h-11 w-full rounded-xl"
                    disabled={prayerCompleted || isPrayerStatusLoading}
                    onClick={() => void handlePrayerComplete()}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {prayerCompleted
                      ? "Prayer complete"
                      : isPrayerStatusLoading
                        ? "Checking today…"
                        : "Mark prayer complete"}
                  </Button>
                </div>
              ) : null}
            </Card>

            <div
              className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 px-2 py-1 text-center"
              aria-label="Today’s formation path"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Receive</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Scripture</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-primary/45" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Practice</p>
                <p className="mt-0.5 text-xs text-muted-foreground">With companion</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-primary/45" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Notice</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Reflect tonight</p>
              </div>
            </div>

            <Card id="daily-adventure" className="scroll-mt-24 border-primary/25 bg-card/90 p-5 shadow-sm backdrop-blur-xl sm:p-6">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="rounded-2xl bg-primary/[0.12] p-3 text-primary">
                  <Heart className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Daily formation</p>
                  <h2 className="mt-1.5 text-xl font-semibold">Your companion has three practices waiting.</h2>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Today’s theme is <span className="font-semibold text-foreground">{dailyContent.theme.toLowerCase()}</span>. Strengthen your mind, care for your body, and feed your soul through one shared thread.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Daily formation pillars">
                    {["Mind", "Body", "Soul"].map((pillar) => (
                      <span key={pillar} className="rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
                        {pillar}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl sm:w-auto"
                  onClick={() => navigate("/companion")}
                >
                  Visit my companion
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </Card>

            <EarlyAccessFeedbackCard />

            {!isEveningReflectionLoading && isEvening ? (
              <button
                type="button"
                disabled={hasCompletedEveningReflection}
                onClick={() => setIsExamenOpen(true)}
                className="w-full rounded-[22px] border border-input bg-card/[0.82] p-4 text-left shadow-sm backdrop-blur-xl transition hover:border-primary hover:bg-card disabled:cursor-default disabled:opacity-80"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-secondary p-3 text-secondary-foreground">
                    <Moon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">This evening</p>
                    <p className="mt-1 font-semibold">Evening Reflection</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasCompletedEveningReflection
                        ? "Completed for tonight. Rest well."
                        : "Check in, notice God’s grace, and release the day."}
                    </p>
                  </div>
                  {hasCompletedEveningReflection ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            ) : null}
          </main>
        </div>
      </div>

      <EveningReflectionDrawer
        open={isEvening && !hasCompletedEveningReflection && isExamenOpen}
        onOpenChange={handleExamenOpenChange}
      />
    </PageTransition>
  );
}

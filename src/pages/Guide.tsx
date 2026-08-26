import { useMemo } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { Button } from "@/components/ui/button";
import { MentorConnectionProvider } from "@/contexts/MentorConnectionContext";
import { getChristianDailyContent } from "@/data/christianDailyContent";
import { useProfile } from "@/hooks/useProfile";
import { getEffectiveDailyDate } from "@/utils/timezone";

export default function Guide() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const dateKey = getEffectiveDailyDate(profile?.timezone ?? undefined);
  const dailyContent = useMemo(
    () => getChristianDailyContent(new Date(`${dateKey}T12:00:00`)),
    [dateKey],
  );

  const openGuideConversation = () => navigate("/mentor-chat", {
    state: {
      briefingContext: `Today's reviewed formation thread is “${dailyContent.theme},” grounded in ${dailyContent.reference}. Help me reflect on it without claiming to speak for God.`,
    },
  });

  return (
    <PageTransition mode="instant">
      <CinematicPageBackground preset="guide" />
      <div className="relative z-10 min-h-screen pb-nav-safe pt-safe text-foreground">
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
          <header className="rounded-[24px] border border-white/35 bg-card/[0.78] p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Your Guide</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">A word for today</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Listen for encouragement, then carry the conversation forward with your Guide.
            </p>
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Today’s shared thread</p>
              <p className="mt-1 font-serif text-lg text-foreground">{dailyContent.theme}</p>
              <p className="mt-0.5 text-xs font-semibold text-primary/80">{dailyContent.reference}</p>
            </div>
            <Button className="mt-4 h-11 rounded-xl" onClick={openGuideConversation}>
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Talk with my Guide
            </Button>
          </header>

          <section id="daily-encouragement" className="mt-5 scroll-mt-24" aria-label="Daily encouragement">
            <ErrorBoundary>
              <MentorConnectionProvider>
                <TodaysPepTalk />
              </MentorConnectionProvider>
            </ErrorBoundary>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, BookHeart, BookOpen, CheckCircle2, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_RUNTIME } from "@/config/productRuntime";
import {
  MENTOR_DISPLAY_NAMES,
  resolveActiveMentorSlug,
} from "@/lib/mentorRoster";

interface EncouragementHistoryItem {
  historyId: string;
  pepTalkId: string;
  forDate: string;
  title: string;
  summary: string;
  category: string;
  mentorName: string;
  firstStartedAt: string | null;
  completedAt: string | null;
  listenCount: number;
  maxProgress: number;
}

const loadEncouragementHistory = async (userId: string): Promise<EncouragementHistoryItem[]> => {
  const { data: historyRows, error: historyError } = await supabase
    .from("daily_encouragement_history")
    .select("id, daily_pep_talk_id, first_started_at, completed_at, listen_count, max_progress, last_interaction_at")
    .eq("user_id", userId)
    .order("last_interaction_at", { ascending: false })
    .limit(100);

  if (historyError) throw historyError;
  if (!historyRows || historyRows.length === 0) return [];

  const pepTalkIds = Array.from(new Set(historyRows.map((row) => row.daily_pep_talk_id)));
  const { data: pepTalks, error: pepTalkError } = await supabase
    .from("daily_pep_talks")
    .select("id, for_date, title, summary, topic_category, mentor_slug")
    .eq("product_mode", PRODUCT_RUNTIME.authProductMode)
    .in("id", pepTalkIds);

  if (pepTalkError) throw pepTalkError;

  const pepTalkById = new Map((pepTalks ?? []).map((pepTalk) => [pepTalk.id, pepTalk]));

  return historyRows.flatMap((history) => {
    const pepTalk = pepTalkById.get(history.daily_pep_talk_id);
    if (!pepTalk) return [];

    return [{
      historyId: history.id,
      pepTalkId: pepTalk.id,
      forDate: pepTalk.for_date,
      title: pepTalk.title,
      summary: pepTalk.summary,
      category: pepTalk.topic_category,
      mentorName: (() => {
        const slug = resolveActiveMentorSlug(pepTalk.mentor_slug);
        return slug ? MENTOR_DISPLAY_NAMES[slug] : "Your Guide";
      })(),
      firstStartedAt: history.first_started_at,
      completedAt: history.completed_at,
      listenCount: history.listen_count,
      maxProgress: history.max_progress,
    }];
  });
};

export default function EncouragementHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const historyQuery = useQuery({
    queryKey: ["daily-encouragement-history", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => loadEncouragementHistory(user!.id),
    staleTime: 60_000,
  });

  const history = historyQuery.data ?? [];
  const heardCount = history.filter((item) => Boolean(item.completedAt)).length;

  return (
    <PageTransition mode="instant">
      <div className="daily-way-page min-h-screen pb-nav-safe pt-safe text-foreground">
        <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
          <header className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full"
              onClick={() => navigate("/mentor")}
              aria-label="Back to Today"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your history</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Past encouragements</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your Guide’s daily words are saved automatically and marked heard after 80% playback.
              </p>
            </div>
          </header>

          {history.length > 0 ? (
            <Card className="mt-6 flex items-center justify-between border-primary/20 bg-card/[0.86] p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <BookHeart className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{history.length} received</p>
                  <p className="text-sm text-muted-foreground">{heardCount} heard</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Newest first</p>
            </Card>
          ) : null}

          <main className="mt-5 space-y-3">
            {historyQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-36 w-full rounded-3xl" />
              ))
            ) : historyQuery.isError ? (
              <Card className="border-border/70 bg-card/85 p-6 text-center">
                <p className="font-semibold">Your encouragement history could not be loaded.</p>
                <Button className="mt-4 rounded-full" variant="outline" onClick={() => void historyQuery.refetch()}>
                  Try again
                </Button>
              </Card>
            ) : history.length === 0 ? (
              <Card className="border-border/70 bg-card/85 p-8 text-center">
                <BookHeart className="mx-auto h-10 w-10 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">Your first encouragement is waiting</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Open today’s encouragement and it will appear here automatically.
                </p>
                <Button className="mt-5 rounded-full" onClick={() => navigate("/mentor#daily-encouragement")}>
                  Go to today’s encouragement
                </Button>
              </Card>
            ) : (
              history.map((item) => {
                const status = item.completedAt
                  ? { label: "Heard", icon: CheckCircle2 }
                  : item.firstStartedAt
                    ? { label: `${Math.round(item.maxProgress * 100)}% heard`, icon: Headphones }
                    : { label: "Received", icon: BookOpen };
                const StatusIcon = status.icon;

                return (
                  <button
                    key={item.historyId}
                    type="button"
                    className="w-full rounded-3xl border border-border/70 bg-card/[0.86] p-5 text-left shadow-sm backdrop-blur-xl transition hover:border-primary/40 hover:bg-card"
                    onClick={() => navigate(`/pep-talk/${item.pepTalkId}`)}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold uppercase tracking-[0.14em] text-primary">
                        {format(parseISO(`${item.forDate}T00:00:00`), "MMMM d, yyyy")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] px-2.5 py-1 font-medium text-primary">
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </div>
                    <h2 className="mt-3 font-serif text-xl leading-tight">{item.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>From {item.mentorName}</span>
                      <span className="capitalize">{item.category}</span>
                      {item.listenCount > 1 ? <span>{item.listenCount} plays</span> : null}
                    </div>
                  </button>
                );
              })
            )}
          </main>
        </div>
      </div>
    </PageTransition>
  );
}

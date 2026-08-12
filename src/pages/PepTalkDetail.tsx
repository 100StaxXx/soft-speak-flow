import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Headphones, MessageCircle, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { AudioPlayer } from "@/components/AudioPlayer";
import { PageTransition } from "@/components/PageTransition";
import { TimedCaptions } from "@/components/TimedCaptions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT } from "@/config/product";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import {
  getNextDailyEncouragementMilestone,
  recordDailyEncouragementProgress,
} from "@/services/dailyEncouragementHistory";
import { estimateWordTiming } from "@/utils/estimatedWordTiming";
import { MENTOR_DISPLAY_NAMES, resolveActiveMentorSlug } from "@/lib/mentorRoster";

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface DailyEncouragement {
  id: string;
  title: string;
  category: string;
  summary: string;
  script: string;
  audioUrl: string;
  transcript: CaptionWord[];
  guideSlug?: string | null;
}

const parseTranscript = (value: unknown): CaptionWord[] => {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is CaptionWord => {
    if (!item || typeof item !== "object") return false;
    const word = item as Partial<CaptionWord>;
    return typeof word.word === "string"
      && typeof word.start === "number"
      && Number.isFinite(word.start)
      && typeof word.end === "number"
      && Number.isFinite(word.end);
  });
};

const loadDailyEncouragement = async (id: string): Promise<DailyEncouragement | null> => {
  const { data: daily, error: dailyError } = await supabase
    .from("daily_pep_talks")
    .select("id, title, summary, script, audio_url, transcript, topic_category, mentor_slug")
    .eq("id", id)
    .maybeSingle();

  if (dailyError) throw dailyError;

  if (daily) {
    return {
      id: daily.id,
      title: daily.title,
      category: daily.topic_category,
      summary: daily.summary,
      script: daily.script,
      audioUrl: daily.audio_url,
      transcript: parseTranscript(daily.transcript),
      guideSlug: daily.mentor_slug,
    };
  }

  // Preserve compatibility with links to the original encouragement library.
  const { data: library, error: libraryError } = await supabase
    .from("pep_talks")
    .select("id, title, category, description, quote, audio_url, transcript, mentor_slug")
    .eq("id", id)
    .maybeSingle();

  if (libraryError) throw libraryError;
  if (!library) return null;

  return {
    id: library.id,
    title: library.title,
      category: library.category ?? "reflection",
      summary: library.description ?? "A brief encouragement for the next faithful step.",
      script: library.quote ?? "",
    audioUrl: library.audio_url,
    transcript: parseTranscript(library.transcript),
    guideSlug: library.mentor_slug,
  };
};

export default function PepTalkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [encouragement, setEncouragement] = useState<DailyEncouragement | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const recordedMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!encouragement?.id) return;
    recordedMilestonesRef.current.clear();
    void recordDailyEncouragementProgress(encouragement.id, "opened");
  }, [encouragement?.id]);

  const handlePlaybackTime = useCallback((nextTime: number) => {
    setCurrentTime(nextTime);
    if (!encouragement?.id || !(duration > 0)) return;

    const progress = Math.min(1, Math.max(0, nextTime / duration));
    const milestone = getNextDailyEncouragementMilestone(progress, recordedMilestonesRef.current);
    if (milestone === null) return;

    recordedMilestonesRef.current.add(milestone);
    void recordDailyEncouragementProgress(
      encouragement.id,
      milestone >= 0.8 ? "completed" : "progress",
      milestone,
    );
  }, [duration, encouragement?.id]);

  const handlePlaybackStarted = useCallback(() => {
    if (!encouragement?.id) return;
    void recordDailyEncouragementProgress(encouragement.id, "started");
  }, [encouragement?.id]);

  const handlePlaybackEnded = useCallback(() => {
    if (!encouragement?.id) return;
    recordedMilestonesRef.current.add(0.8);
    void recordDailyEncouragementProgress(encouragement.id, "completed", 1);
  }, [encouragement?.id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) {
        navigate("/mentor#daily-encouragement", { replace: true });
        return;
      }

      try {
        const nextEncouragement = await loadDailyEncouragement(id);
        if (cancelled) return;

        if (!nextEncouragement) {
          toast.error("That daily encouragement is no longer available.");
          navigate("/mentor#daily-encouragement", { replace: true });
          return;
        }

        setEncouragement(nextEncouragement);
      } catch (error) {
        console.error("Error loading daily encouragement:", error);
        if (!cancelled) {
          toast.error("We couldn’t load this daily encouragement.");
          navigate("/mentor#daily-encouragement", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <PageTransition mode="instant">
        <div className="daily-way-page min-h-screen pb-nav-safe pt-safe text-foreground">
          <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-56 w-full rounded-3xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!encouragement) return null;

  const estimatedTranscript = estimateWordTiming(encouragement.script, duration);
  const effectiveTranscript = encouragement.transcript.length > 0
    ? encouragement.transcript
    : estimatedTranscript;
  const isEstimatedTranscript = encouragement.transcript.length === 0 && estimatedTranscript.length > 0;
  const resolvedGuideSlug = resolveActiveMentorSlug(encouragement.guideSlug);
  const guideName = resolvedGuideSlug ? MENTOR_DISPLAY_NAMES[resolvedGuideSlug] : "your Guide";

  return (
    <PageTransition mode="instant">
      <div className="daily-way-page min-h-screen pb-nav-safe pt-safe text-foreground">
        <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
          <header className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate("/mentor#daily-encouragement")}
              aria-label="Back to Today"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                {PRODUCT.name} · A word from {guideName}
              </p>
              <p className="mt-1 text-sm capitalize text-muted-foreground">
                {encouragement.category}
              </p>
            </div>
          </header>

          <main className="mt-7 space-y-5">
            <Card className="overflow-hidden border-primary/20 bg-card/[0.86] p-6 shadow-xl backdrop-blur-xl sm:p-8">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  From {guideName}
                </span>
              </div>
              <h1 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
                {encouragement.title}
              </h1>
              <p className="mt-4 leading-7 text-muted-foreground">{encouragement.summary}</p>
            </Card>

            <Card className="border-border/70 bg-card/[0.86] p-5 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Headphones className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Listen</h2>
                  <p className="text-sm text-muted-foreground">Pause, breathe, and receive what is useful.</p>
                </div>
              </div>
              <AudioPlayer
                audioUrl={encouragement.audioUrl}
                title={encouragement.title}
                onTimeUpdate={handlePlaybackTime}
                onDurationChange={setDuration}
                onPlay={handlePlaybackStarted}
                onEnded={handlePlaybackEnded}
              />
            </Card>

            <Card className="border-border/70 bg-card/[0.82] p-5 backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Follow along</h2>
                {isEstimatedTranscript && (
                  <span className="ml-auto text-xs text-muted-foreground">Timing being refined</span>
                )}
              </div>
              {effectiveTranscript.length > 0 ? (
                <TimedCaptions transcript={effectiveTranscript} currentTime={currentTime} />
              ) : (
                <p className="whitespace-pre-wrap font-serif text-lg leading-8 text-foreground/85">
                  {encouragement.script}
                </p>
              )}
            </Card>

            <Button
              className="h-12 w-full rounded-full"
              onClick={() => navigate("/mentor-chat", {
                state: {
                  initialMessage: `Help me apply the encouragement “${encouragement.title}.”`,
                  briefingContext: `${guideName}'s daily encouragement: ${encouragement.title}. ${encouragement.summary}`,
                },
              })}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Talk with {guideName} about this
            </Button>

            <p className="px-2 text-center text-xs leading-5 text-muted-foreground">
              Graceward offers AI-generated reflection, not divine revelation or pastoral care.
            </p>
          </main>
        </div>
      </div>
    </PageTransition>
  );
}

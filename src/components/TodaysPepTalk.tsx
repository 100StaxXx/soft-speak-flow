import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import { useXPRewards } from "@/hooks/useXPRewards";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Sparkles, SkipBack, SkipForward, ChevronDown, ChevronUp, Wand2, Loader2, History, MessageCircle, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getActiveWordIndex } from "@/utils/captionTiming";
import { parseFunctionInvokeError, toUserFacingFunctionError } from "@/utils/supabaseFunctionErrors";
import { Capacitor } from "@capacitor/core";
import { applyScriptPunctuationToTranscript } from "@/utils/transcriptPunctuation";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { useResolvedWallpaper, useWallpaperManifest } from "@/contexts/WallpaperManifestContext";
import { getEffectiveDailyDate } from "@/utils/timezone";
import { globalAudio } from "@/utils/globalAudio";
import { createIOSOptimizedAudio, isIOS, iosAudioManager, safePlay } from "@/utils/iosAudio";
import { logger } from "@/utils/logger";
import { toast } from "@/components/ui/sonner";
import { useAchievements } from "@/hooks/useAchievements";
import { resolveMentorSlugAlias } from "@/lib/mentorRoster";
import {
  getNextDailyEncouragementMilestone,
  recordDailyEncouragementProgress,
} from "@/services/dailyEncouragementHistory";
import { estimateWordTiming } from "@/utils/estimatedWordTiming";
import { MentorAvatar } from "@/components/MentorAvatar";
import { useDailyGuideThread } from "@/hooks/useDailyGuideThread";
import {
  DAILY_ENCOURAGEMENT_COMPLETED_EVENT,
  DAILY_GUIDE_FOCUS_SELECTED_EVENT,
  getDailyGuideQuestion,
  type DailyGuideQuestionOption,
} from "@/lib/dailyGuideThread";
import { trackProductExperience } from "@/lib/productAnalytics";

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface DailyPepTalk {
  id: string;
  for_date: string;
  mentor_slug: string;
  title: string;
  summary: string;
  script: string;
  audio_url: string;
  topic_category: string;
  intensity: string;
  emotional_triggers: string[];
  transcript: CaptionWord[];
  mentor_name?: string;
}

interface TodayPepTalkQueryData {
  pepTalk: DailyPepTalk | null;
  mentorSlug: string | null;
  mentor: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    primaryColor: string;
  } | null;
  isFallback: boolean;
}

type InlineAudioElement = HTMLAudioElement & {
  playsInline?: boolean;
  "webkit-playsinline"?: boolean;
};

const log = logger.scope("TodaysPepTalk");
const AUDIO_READY_TIMEOUT_MS = 5000;
const TODAY_PEP_TALK_QUERY_ROOT = ["today-pep-talk"] as const;
const transparentShellClassName = "border-border/70 bg-card/[0.86] shadow-sm backdrop-blur-xl";

function buildTodayPepTalkQueryKey(mentorId: string | null | undefined, effectiveDate: string) {
  return [...TODAY_PEP_TALK_QUERY_ROOT, mentorId ?? null, effectiveDate] as const;
}

function isCaptionWord(word: unknown): word is CaptionWord {
  if (!word || typeof word !== "object") {
    return false;
  }
  const candidate = word as { word?: unknown; start?: unknown; end?: unknown };
  return (
    typeof candidate.word === "string" &&
    typeof candidate.start === "number" &&
    Number.isFinite(candidate.start) &&
    typeof candidate.end === "number" &&
    Number.isFinite(candidate.end)
  );
}

function sanitizeTranscript(transcript: unknown): CaptionWord[] {
  if (!Array.isArray(transcript)) {
    return [];
  }
  return transcript
    .filter(isCaptionWord)
    .slice()
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));
}

function normalizeDailyPepTalk(rawPepTalk: Record<string, unknown>, mentorName?: string | null): DailyPepTalk {
  return {
    ...rawPepTalk,
    mentor_name: mentorName ?? undefined,
    transcript: sanitizeTranscript(rawPepTalk.transcript),
  } as DailyPepTalk;
}

async function fetchTodayPepTalk(
  resolvedMentorId: string,
  effectiveDate: string,
): Promise<TodayPepTalkQueryData> {
  const { data: mentor, error: mentorError } = await supabase
    .from("graceward_guides")
    .select("id, slug, name, avatar_url, primary_color")
    .eq("id", resolvedMentorId)
    .maybeSingle();

  if (mentorError) {
    throw mentorError;
  }

  if (!mentor) {
    return {
      pepTalk: null,
      mentorSlug: null,
      mentor: null,
      isFallback: false,
    };
  }

  const mentorSlug = resolveMentorSlugAlias(mentor.slug) ?? mentor.slug;

  const { data: todayPepTalk, error: pepTalkError } = await supabase
    .from("daily_pep_talks")
    .select("*")
    .eq("for_date", effectiveDate)
    .eq("mentor_slug", mentorSlug)
    .maybeSingle();

  if (pepTalkError) {
    throw pepTalkError;
  }

  if (todayPepTalk) {
    return {
      pepTalk: normalizeDailyPepTalk(todayPepTalk as Record<string, unknown>, mentor.name),
      mentorSlug,
      mentor: {
        id: mentor.id,
        name: mentor.name,
        slug: mentor.slug,
        avatarUrl: mentor.avatar_url,
        primaryColor: mentor.primary_color || "#7c3aed",
      },
      isFallback: false,
    };
  }

  log.debug("No pep talk for today, fetching most recent...", {
    mentorSlug,
    effectiveDate,
  });

  const { data: fallbackPepTalk, error: fallbackError } = await supabase
    .from("daily_pep_talks")
    .select("*")
    .eq("mentor_slug", mentorSlug)
    .order("for_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  if (!fallbackPepTalk) {
    return {
      pepTalk: null,
      mentorSlug,
      mentor: {
        id: mentor.id,
        name: mentor.name,
        slug: mentor.slug,
        avatarUrl: mentor.avatar_url,
        primaryColor: mentor.primary_color || "#7c3aed",
      },
      isFallback: false,
    };
  }

  log.debug("Using fallback pep talk", {
    mentorSlug,
    forDate: fallbackPepTalk.for_date,
  });

  return {
    pepTalk: normalizeDailyPepTalk(fallbackPepTalk as Record<string, unknown>, mentor.name),
    mentorSlug,
    mentor: {
      id: mentor.id,
      name: mentor.name,
      slug: mentor.slug,
      avatarUrl: mentor.avatar_url,
      primaryColor: mentor.primary_color || "#7c3aed",
    },
    isFallback: true,
  };
}

export const TodaysPepTalk = memo(() => {
  const { profile } = useProfile();
  const { mentorId: resolvedMentorId } = useMentorConnection();
  const { isTabActive } = useMainTabVisibility();
  const pepTalkWallpaper = useResolvedWallpaper("pep_talk");
  const { reportWallpaperRenderError } = useWallpaperManifest();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { awardPepTalkListenedAsync } = useXPRewards();
  const { checkFirstTimeAchievements, checkPepTalkListeningAchievements } = useAchievements();
  const { thread, isUpdating: isThreadUpdating, updateThread } = useDailyGuideThread({
    enabled: isTabActive,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [, setHasAwardedXP] = useState(false);
  const [generationStage, setGenerationStage] = useState<"idle" | "script" | "audio" | "loading">("idle");
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(() =>
    getEffectiveDailyDate(profile?.timezone ?? undefined),
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const seekDebounceRef = useRef<number | null>(null);
  const transcriptScrollRafRef = useRef<number | null>(null);
  const lastTranscriptScrollTopRef = useRef<number>(0);
  const playbackRafRef = useRef<number | null>(null);
  const isAwardingXPRef = useRef(false);
  const hasAwardedXPRef = useRef(false);
  const previousTabActiveRef = useRef(isTabActive);
  const generatePepTalkInFlightRef = useRef(false);
  const openedHistoryIdsRef = useRef<Set<string>>(new Set());
  const recordedProgressMilestonesRef = useRef<Set<number>>(new Set());
  const announcedCompletionIdsRef = useRef<Set<string>>(new Set());
  const isNativeIOS = useMemo(
    () => typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios",
    [],
  );
  useEffect(() => {
    const refreshEffectiveDate = () => {
      const nextEffectiveDate = getEffectiveDailyDate(profile?.timezone ?? undefined);
      setEffectiveDate((currentEffectiveDate) =>
        currentEffectiveDate === nextEffectiveDate ? currentEffectiveDate : nextEffectiveDate,
      );
    };

    refreshEffectiveDate();
    const intervalId = window.setInterval(refreshEffectiveDate, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshEffectiveDate();
      }
    };

    window.addEventListener("focus", refreshEffectiveDate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshEffectiveDate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profile?.timezone]);

  const pepTalkQueryKey = useMemo(
    () => buildTodayPepTalkQueryKey(resolvedMentorId, effectiveDate),
    [resolvedMentorId, effectiveDate],
  );

  const pepTalkQuery = useQuery({
    queryKey: pepTalkQueryKey,
    queryFn: async () => fetchTodayPepTalk(resolvedMentorId!, effectiveDate),
    enabled: Boolean(resolvedMentorId) && isTabActive,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  const pepTalk = pepTalkQuery.data?.pepTalk ?? null;
  const mentorSlug = pepTalkQuery.data?.mentorSlug ?? null;
  const mentor = pepTalkQuery.data?.mentor ?? null;
  const isFallback = pepTalkQuery.data?.isFallback ?? false;
  const loading = pepTalkQuery.isPending || (pepTalkQuery.isFetching && !pepTalkQuery.data);
  const error = pepTalkQuery.isError && !pepTalk;
  const { refetch: refetchPepTalk } = pepTalkQuery;
  const backdropSource = pepTalkWallpaper ? "remote" : "fallback";
  const dailyGuideQuestion = useMemo(
    () => getDailyGuideQuestion(pepTalk?.topic_category),
    [pepTalk?.topic_category],
  );
  const selectedFocusOption = useMemo(
    () => dailyGuideQuestion.options.find((option) => option.id === thread?.focus_option_id) ?? null,
    [dailyGuideQuestion.options, thread?.focus_option_id],
  );

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsAudioReady(false);
    setHasAwardedXP(false);
    setIsPlaying(false);
    setActiveWordIndex(-1);
    isAwardingXPRef.current = false;
    hasAwardedXPRef.current = false;
    recordedProgressMilestonesRef.current.clear();
  }, [pepTalk?.id]);

  useEffect(() => {
    if (!pepTalk?.id || openedHistoryIdsRef.current.has(pepTalk.id)) return;

    openedHistoryIdsRef.current.add(pepTalk.id);
    void recordDailyEncouragementProgress(pepTalk.id, "opened");
    void trackProductExperience("encouragement_opened", {
      surface: "today",
      properties: {
        fallback: isFallback,
        topic_category: pepTalk.topic_category,
      },
    });
  }, [isFallback, pepTalk?.id, pepTalk?.topic_category]);

  useEffect(() => {
    if (!pepTalk?.id || !mentor?.id) return;
    void updateThread({
      mentor_id: mentor.id,
      mentor_name: mentor.name,
      daily_pep_talk_id: pepTalk.id,
      encouragement_title: pepTalk.title,
    });
  }, [mentor?.id, pepTalk?.id, updateThread]);

  useEffect(() => {
    const becameActive = isTabActive && !previousTabActiveRef.current;
    previousTabActiveRef.current = isTabActive;

    if (!resolvedMentorId || !becameActive) return;

    void queryClient.invalidateQueries({ queryKey: TODAY_PEP_TALK_QUERY_ROOT });
    void refetchPepTalk();
  }, [isTabActive, queryClient, refetchPepTalk, resolvedMentorId]);

  useEffect(() => {
    if (!pepTalk?.audio_url || isAudioReady) return;

    const timeout = window.setTimeout(() => {
      if (!isAudioReady && audioRef.current) {
        log.debug("Audio ready timeout reached, enabling play button");
        setIsAudioReady(true);
      }
    }, AUDIO_READY_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [pepTalk?.audio_url, isAudioReady]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !pepTalk?.audio_url) {
      return;
    }

    const optimizedAudio = createIOSOptimizedAudio(pepTalk.audio_url) as InlineAudioElement;
    const targetAudio = audio as InlineAudioElement;

    targetAudio.src = optimizedAudio.src;
    targetAudio.preload = optimizedAudio.preload;
    targetAudio.playsInline = optimizedAudio.playsInline ?? true;
    targetAudio["webkit-playsinline"] = optimizedAudio["webkit-playsinline"] ?? true;
    targetAudio.muted = globalAudio.getMuted();

    if (isIOS) {
      iosAudioManager.registerAudio(targetAudio);
    }

    return () => {
      targetAudio.pause();
      if (isIOS) {
        iosAudioManager.unregisterAudio(targetAudio);
      }
    };
  }, [pepTalk?.audio_url]);

  useEffect(() => {
    const unsubscribe = globalAudio.subscribe((muted) => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.muted = muted;
      if (muted && isPlaying) {
        audio.pause();
        setIsPlaying(false);
      }
    });

    const audio = audioRef.current;
    if (audio) {
      audio.muted = globalAudio.getMuted();
    }

    return unsubscribe;
  }, [isPlaying]);

  const timedTranscript = useMemo(
    () => sanitizeTranscript(pepTalk?.transcript),
    [pepTalk?.transcript],
  );
  const estimatedTranscript = useMemo(
    () => timedTranscript.length === 0
      ? estimateWordTiming(pepTalk?.script ?? "", duration)
      : [],
    [duration, pepTalk?.script, timedTranscript.length],
  );
  const effectiveTranscript = timedTranscript.length > 0
    ? timedTranscript
    : estimatedTranscript;
  const isEstimatedTranscript = timedTranscript.length === 0 && estimatedTranscript.length > 0;
  const displayTranscript = useMemo(
    () => applyScriptPunctuationToTranscript(effectiveTranscript, pepTalk?.script),
    [effectiveTranscript, pepTalk?.script],
  );

  const generatePepTalkMutation = useMutation({
    retry: false,
    mutationFn: async (nextMentorSlug: string) => {
      setGenerationStage("loading");
      await refetchPepTalk();

      setGenerationStage("script");
      let audioStageTimer: number | null = window.setTimeout(() => {
        setGenerationStage("audio");
      }, 1200);

      try {
        const { data, error: generationError } = await supabase.functions.invoke(
          "generate-single-daily-pep-talk",
          { body: { mentorSlug: nextMentorSlug, forceRegenerate: true } },
        );

        if (generationError) {
          const parsedError = await parseFunctionInvokeError(generationError);
          const userMessage = toUserFacingFunctionError(parsedError, {
            action: "refresh today's encouragement",
          });

          log.warn("Pep talk generation returned HTTP error", {
            status: parsedError.status,
            backendMessage: parsedError.backendMessage,
            category: parsedError.category,
            code: parsedError.code,
            upstreamStatus: parsedError.upstreamStatus,
            upstreamError: parsedError.upstreamError,
            requestId: parsedError.requestId,
          });

          throw new Error(userMessage);
        }

        const generatedPepTalk =
          data && typeof data === "object" && "pepTalk" in data
            ? (data as { pepTalk?: Record<string, unknown> }).pepTalk
            : null;

        if (!generatedPepTalk) {
          throw new Error("No daily encouragement data returned");
        }

        setGenerationStage("loading");

        const generatedMentorSlug =
          typeof generatedPepTalk.mentor_slug === "string"
            ? generatedPepTalk.mentor_slug
            : nextMentorSlug;
        const { data: generatedMentor } = await supabase
          .from("graceward_guides")
          .select("id, name, slug, avatar_url, primary_color")
          .eq("slug", generatedMentorSlug)
          .maybeSingle();

        return {
          pepTalk: normalizeDailyPepTalk(generatedPepTalk, generatedMentor?.name),
          mentorSlug: generatedMentorSlug,
          mentor: generatedMentor ? {
            id: generatedMentor.id,
            name: generatedMentor.name,
            slug: generatedMentor.slug,
            avatarUrl: generatedMentor.avatar_url,
            primaryColor: generatedMentor.primary_color || "#7c3aed",
          } : null,
          isFallback: false,
        } satisfies TodayPepTalkQueryData;
      } finally {
        if (audioStageTimer !== null) {
          window.clearTimeout(audioStageTimer);
          audioStageTimer = null;
        }
      }
    },
    onSuccess: (nextData) => {
      queryClient.setQueryData(pepTalkQueryKey, nextData);
      toast.success("Your daily encouragement is ready.");
    },
    onError: async (mutationError) => {
      let errorMessage =
        mutationError instanceof Error ? mutationError.message : "Failed to prepare daily encouragement";

      const shouldParseFunctionError =
        (typeof mutationError === "object" && mutationError !== null && "context" in mutationError) ||
        /edge function|functions(fetch|http|relay)error|non-2xx|failed to send a request/i.test(errorMessage);

      if (shouldParseFunctionError) {
        const parsedError = await parseFunctionInvokeError(mutationError);
        errorMessage = toUserFacingFunctionError(parsedError, {
          action: "refresh today's encouragement",
        });
      }

      generatePepTalkInFlightRef.current = false;
      flushSync(() => {
        setGenerationStage("idle");
      });
      toast.error(errorMessage);
    },
    onSettled: async (_nextData, mutationError) => {
      try {
        if (!mutationError) {
          await queryClient.invalidateQueries({ queryKey: pepTalkQueryKey });
          await queryClient.refetchQueries({ queryKey: pepTalkQueryKey });
        }
      } finally {
        generatePepTalkInFlightRef.current = false;
        setGenerationStage("idle");
      }
    },
  });

  const isGenerating = generatePepTalkMutation.isPending || generatePepTalkInFlightRef.current;

  const handleGeneratePepTalk = () => {
    if (generatePepTalkInFlightRef.current || generatePepTalkMutation.isPending) {
      return;
    }

    if (!mentorSlug) {
      toast.error("No guide selected");
      return;
    }

    generatePepTalkInFlightRef.current = true;
    setGenerationStage("script");
    generatePepTalkMutation.mutate(mentorSlug);
  };

  useEffect(() => {
    let isDisposed = false;

    const checkXPStatus = async () => {
      if (!pepTalk?.id || !profile?.id) {
        if (!isDisposed) {
          hasAwardedXPRef.current = false;
          setHasAwardedXP(false);
        }
        return;
      }

      const { data } = await supabase
        .from("xp_events")
        .select("id")
        .eq("user_id", profile.id)
        .eq("event_type", "pep_talk_listen")
        .eq("event_metadata->>pep_talk_id", pepTalk.id)
        .maybeSingle();

      if (!isDisposed) {
        hasAwardedXPRef.current = Boolean(data);
        setHasAwardedXP(Boolean(data));
      }
    };

    void checkXPStatus();

    return () => {
      isDisposed = true;
    };
  }, [pepTalk?.id, profile?.id]);

  const maybeAwardPepTalkXP = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !pepTalk?.id || !profile?.id || hasAwardedXPRef.current || isAwardingXPRef.current) {
      return;
    }

    const currentDuration = audio.duration;
    if (!(currentDuration > 0) || audio.currentTime < currentDuration * 0.8) {
      return;
    }

    isAwardingXPRef.current = true;

    try {
      const awardResult = await awardPepTalkListenedAsync({ pep_talk_id: pepTalk.id });
      if (awardResult) {
        hasAwardedXPRef.current = true;
        setHasAwardedXP(true);

        if (!awardResult.duplicate) {
          const { count } = await supabase
            .from("xp_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id)
            .eq("event_type", "pep_talk_listen");

          const totalListens = count ?? 0;
          if (totalListens === 1) {
            await checkFirstTimeAchievements("peptalk");
          }

          await checkPepTalkListeningAchievements(totalListens);
        }
      }
    } catch (awardError) {
      log.warn("Pep talk XP award failed", {
        pepTalkId: pepTalk.id,
        error: awardError instanceof Error ? awardError.message : String(awardError),
      });
    } finally {
      isAwardingXPRef.current = false;
    }
  }, [
    awardPepTalkListenedAsync,
    checkFirstTimeAchievements,
    checkPepTalkListeningAchievements,
    pepTalk?.id,
    profile?.id,
  ]);

  const announceEncouragementCompleted = useCallback(() => {
    if (!pepTalk?.id || announcedCompletionIdsRef.current.has(pepTalk.id)) return;
    announcedCompletionIdsRef.current.add(pepTalk.id);
    void trackProductExperience("encouragement_completed", {
      surface: "today",
      properties: { topic_category: pepTalk.topic_category },
    });
    void updateThread({
      mentor_id: mentor?.id ?? null,
      mentor_name: mentor?.name ?? pepTalk.mentor_name ?? null,
      daily_pep_talk_id: pepTalk.id,
      encouragement_title: pepTalk.title,
      encouragement_completed_at: new Date().toISOString(),
      companion_response: `I listened with you. ${mentor?.name ?? pepTalk.mentor_name ?? "Your Guide"}'s encouragement is part of the day now.`,
      companion_acknowledged_at: null,
    });
    window.dispatchEvent(new CustomEvent(DAILY_ENCOURAGEMENT_COMPLETED_EVENT, {
      detail: {
        pepTalkId: pepTalk.id,
        title: pepTalk.title,
        mentorName: mentor?.name ?? pepTalk.mentor_name ?? "your Guide",
      },
    }));
  }, [mentor?.id, mentor?.name, pepTalk, updateThread]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      if (pepTalk?.id && audio.duration > 0) {
        const progress = Math.min(1, Math.max(0, time / audio.duration));
        const milestone = getNextDailyEncouragementMilestone(
          progress,
          recordedProgressMilestonesRef.current,
        );
        if (milestone !== null) {
          recordedProgressMilestonesRef.current.add(milestone);
          void recordDailyEncouragementProgress(
            pepTalk.id,
            milestone >= 0.8 ? "completed" : "progress",
            milestone,
          );
          if (milestone >= 0.8) announceEncouragementCompleted();
        }
      }
      void maybeAwardPepTalkXP();
    };

    const updateDuration = () => {
      setDuration(audio.duration);
      if (audio.duration > 0) {
        setIsAudioReady(true);
      }
    };

    const handleSeeked = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      void maybeAwardPepTalkXP();
    };

    const handleEnded = () => {
      setCurrentTime(audio.currentTime);
      setIsPlaying(false);
      setActiveWordIndex(-1);
      if (pepTalk?.id) {
        recordedProgressMilestonesRef.current.add(0.8);
        void recordDailyEncouragementProgress(pepTalk.id, "completed", 1);
        announceEncouragementCompleted();
      }
      void maybeAwardPepTalkXP();
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [announceEncouragementCompleted, maybeAwardPepTalkXP, pepTalk?.id]);

  const handleFocusSelection = async (option: DailyGuideQuestionOption) => {
    if (!mentor?.id || !pepTalk?.id || thread?.focus_answered_at || isThreadUpdating) return;

    await updateThread({
      mentor_id: mentor.id,
      mentor_name: mentor.name,
      daily_pep_talk_id: pepTalk.id,
      encouragement_title: pepTalk.title,
      guide_question_id: dailyGuideQuestion.id,
      guide_question: dailyGuideQuestion.prompt,
      focus_option_id: option.id,
      focus_label: option.label,
      focus_category: option.category,
      focus_answered_at: new Date().toISOString(),
      companion_response: option.companionResponse,
      companion_acknowledged_at: null,
    });
    void trackProductExperience("focus_selected", {
      surface: "today",
      properties: {
        category: option.category,
        option_id: option.id,
      },
    });

    window.dispatchEvent(new CustomEvent(DAILY_GUIDE_FOCUS_SELECTED_EVENT, {
      detail: {
        category: option.category,
        focusLabel: option.label,
        guideName: mentor.name,
        source: "guide",
      },
    }));
  };

  const openGuideConversation = () => {
    if (!pepTalk || !mentor) return;
    void trackProductExperience("guide_chat_started", {
      surface: "today",
      properties: {
        has_focus: Boolean(thread?.focus_label),
        source: "daily_encouragement",
      },
    });
    const focusContext = thread?.focus_label
      ? ` I chose “${thread.focus_label}” as my focus today.`
      : "";
    navigate("/mentor-chat", {
      state: {
        initialMessage: `Help me apply today's encouragement, “${pepTalk.title}.”${focusContext}`,
        briefingContext: [
          `Today's daily encouragement from ${mentor.name}: ${pepTalk.title}.`,
          pepTalk.summary,
          thread?.focus_label ? `The user chose ${thread.focus_label} as today's focus.` : null,
        ].filter(Boolean).join(" "),
      },
    });
  };

  useEffect(() => {
    setActiveWordIndex((previousIndex) =>
      getActiveWordIndex(effectiveTranscript, currentTime, previousIndex),
    );
  }, [effectiveTranscript, currentTime]);

  useEffect(() => {
    if (!isPlaying) return;

    const updatePlaybackClock = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
        playbackRafRef.current = window.requestAnimationFrame(updatePlaybackClock);
      }
    };

    playbackRafRef.current = window.requestAnimationFrame(updatePlaybackClock);
    return () => {
      if (playbackRafRef.current !== null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (transcriptScrollRafRef.current !== null) {
        window.cancelAnimationFrame(transcriptScrollRafRef.current);
      }
      if (playbackRafRef.current !== null) {
        window.cancelAnimationFrame(playbackRafRef.current);
      }
      if (seekDebounceRef.current) {
        window.clearTimeout(seekDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeWordRef.current && transcriptRef.current && showFullTranscript) {
      const container = transcriptRef.current;
      const activeWord = activeWordRef.current;

      const visibleTop = container.scrollTop;
      const visibleBottom = visibleTop + container.clientHeight;
      const wordTop = activeWord.offsetTop;
      const wordBottom = wordTop + activeWord.offsetHeight;
      const isWordOutsideViewport = wordTop < visibleTop || wordBottom > visibleBottom;

      if (isWordOutsideViewport) {
        const centeredTarget = wordTop - (container.clientHeight / 2) + (activeWord.offsetHeight / 2);
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const nextScrollTop = Math.max(0, Math.min(centeredTarget, maxScrollTop));

        if (Math.abs(nextScrollTop - visibleTop) < 1) return;
        if (Math.abs(nextScrollTop - lastTranscriptScrollTopRef.current) < 1) return;

        if (transcriptScrollRafRef.current !== null) {
          window.cancelAnimationFrame(transcriptScrollRafRef.current);
        }

        transcriptScrollRafRef.current = window.requestAnimationFrame(() => {
          container.scrollTo({
            top: nextScrollTop,
            behavior: "smooth",
          });
          lastTranscriptScrollTopRef.current = nextScrollTop;
          transcriptScrollRafRef.current = null;
        });
      }
    }
  }, [activeWordIndex, showFullTranscript]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) {
      log.error("Audio element not found");
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (globalAudio.getMuted()) {
      globalAudio.setMuted(false);
    }

    audio.muted = false;

    const played = await safePlay(audio);
    if (played) {
      setIsPlaying(true);
      setShowFullTranscript(true);
      if (pepTalk?.id) {
        void recordDailyEncouragementProgress(pepTalk.id, "started", currentTime / Math.max(duration, 1));
      }
      return;
    }

    audio.load();
    const playedAfterReload = await safePlay(audio);
    if (playedAfterReload) {
      setIsPlaying(true);
      setShowFullTranscript(true);
      if (pepTalk?.id) {
        void recordDailyEncouragementProgress(pepTalk.id, "started", currentTime / Math.max(duration, 1));
      }
    }
  };

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(value[0]);

    if (seekDebounceRef.current) {
      window.clearTimeout(seekDebounceRef.current);
    }

    seekDebounceRef.current = window.setTimeout(() => {
      audio.currentTime = value[0];
    }, 100);
  }, []);

  const skipTime = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const renderTranscriptPreview = () => {
    if (!pepTalk?.script) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No transcript available
        </p>
      );
    }

    const words = pepTalk.script.split(" ");
    const previewWords = words.slice(0, 20);

    return (
      <div className="text-sm leading-relaxed text-foreground/70">
        {previewWords.join(" ")}...
      </div>
    );
  };

  const renderFullTranscript = () => {
    if (displayTranscript.length === 0) {
      if (!pepTalk?.script) return null;
      return (
        <div
          ref={transcriptRef}
          data-testid="pep-talk-transcript"
          className="text-sm leading-relaxed max-h-64 overflow-y-auto scroll-smooth pr-2 text-foreground/80"
        >
          {pepTalk.script}
        </div>
      );
    }

    return (
      <div
        ref={transcriptRef}
        data-testid="pep-talk-transcript"
        className="text-sm leading-relaxed max-h-64 overflow-y-auto scroll-smooth pr-2 text-foreground/80"
      >
        {displayTranscript.map((wordData: CaptionWord, index: number) => (
          <span
            key={index}
            ref={index === activeWordIndex ? activeWordRef : null}
            className={cn(
              "transition-colors duration-200",
              index === activeWordIndex
                ? "text-primary font-semibold bg-primary/10 px-1 rounded"
                : "text-foreground/80",
            )}
          >
            {wordData.word}{" "}
          </span>
        ))}
      </div>
    );
  };

  const renderSectionBackdrop = () => (
    <div
      className="absolute inset-0"
      data-testid="pep-talk-section-backdrop"
      data-pep-talk-backdrop={backdropSource}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 20%, rgba(83, 198, 206, 0.22), transparent 32%), linear-gradient(180deg, rgba(6, 13, 24, 0.82), rgba(8, 12, 22, 0.96))",
        }}
      />

      {pepTalkWallpaper ? (
        <>
          <StaticBackgroundImage
            background={pepTalkWallpaper.background}
            className="absolute inset-0 h-full w-full object-cover select-none opacity-[0.82] md:hidden"
            objectPosition={pepTalkWallpaper.mobileObjectPosition}
            onError={() => reportWallpaperRenderError("pep_talk", pepTalkWallpaper.imageUrl)}
            testId="pep-talk-backdrop-image-mobile"
          />
          <StaticBackgroundImage
            background={pepTalkWallpaper.background}
            className="absolute inset-0 hidden h-full w-full object-cover select-none opacity-[0.82] md:block"
            objectPosition={pepTalkWallpaper.desktopObjectPosition}
            onError={() => reportWallpaperRenderError("pep_talk", pepTalkWallpaper.imageUrl)}
            testId="pep-talk-backdrop-image-desktop"
          />
        </>
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(5, 10, 18, 0.32) 0%, rgba(5, 10, 18, 0.12) 18%, rgba(5, 10, 18, 0.52) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(5, 10, 18, 0.08) 0%, rgba(5, 10, 18, 0.14) 28%, rgba(5, 10, 18, 0.48) 74%, rgba(5, 10, 18, 0.76) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, rgba(5, 10, 18, 0.54) 0%, rgba(5, 10, 18, 0.18) 22%, rgba(5, 10, 18, 0.12) 50%, rgba(5, 10, 18, 0.18) 78%, rgba(5, 10, 18, 0.54) 100%)",
        }}
      />
    </div>
  );

  if (loading) {
    return (
      <Card
        data-testid="pep-talk-shell"
        className={cn("relative overflow-hidden rounded-3xl border p-6 animate-pulse", transparentShellClassName)}
      >
        {renderSectionBackdrop()}
        <div className="relative space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (error || !pepTalk) {
    return (
      <Card
        data-testid="pep-talk-shell"
        className={cn("relative overflow-hidden rounded-3xl border p-6", transparentShellClassName)}
      >
        {renderSectionBackdrop()}
        <div className="relative space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              Daily Encouragement
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {error ? "Unable to load today's encouragement" : "No daily encouragement is available yet"}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              onClick={handleGeneratePepTalk}
              disabled={isGenerating || !mentorSlug}
              className="rounded-full min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {generationStage === "idle" && "Preparing..."}
                  {generationStage === "script" && "Preparing script..."}
                  {generationStage === "audio" && "Creating audio..."}
                  {generationStage === "loading" && "Loading..."}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Prepare Today&apos;s Encouragement
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="default"
              className="rounded-full"
              onClick={() => navigate("/profile#reminders")}
            >
              Reminder Settings
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-testid="pep-talk-shell"
      className={cn(
        "relative overflow-hidden group rounded-3xl border",
        transparentShellClassName,
        !isNativeIOS && "animate-fade-in",
        isNativeIOS && "gpu-layer",
      )}
    >
      {renderSectionBackdrop()}
      <div className="relative p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-center gap-3 text-left">
          {mentor ? (
            <MentorAvatar
              mentorSlug={mentor.slug}
              mentorName={mentor.name}
              primaryColor={mentor.primaryColor}
              avatarUrl={mentor.avatarUrl ?? undefined}
              size="xs"
              className="shrink-0"
              showGlow
            />
          ) : (
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="h-5 w-5 text-primary animate-pulse-slow" />
              <div className="absolute inset-0 rounded-full bg-primary/25 blur-md" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-text">
              A word from {mentor?.name ?? pepTalk.mentor_name ?? "your Guide"}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-foreground/65">
              Your primary Guide · prepared in their Guide voice for today
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6 rounded-2xl bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border-2 border-primary/30 shadow-glow">
          {isFallback && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1 mx-auto w-fit">
              <span>Earlier encouragement · {new Date(pepTalk.for_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-0 px-2 text-xs text-primary hover:text-primary/80"
                onClick={handleGeneratePepTalk}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {generationStage === "idle" && "Refreshing..."}
                    {generationStage === "script" && "Writing..."}
                    {generationStage === "audio" && "Recording..."}
                    {generationStage === "loading" && "Loading..."}
                  </>
                ) : "Refresh today's"}
              </Button>
            </div>
          )}
          <div className="space-y-3 text-center">
            <h3 className="text-xl md:text-2xl font-bold text-foreground">
              {pepTalk.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {pepTalk.summary}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-background/65 p-4 text-left shadow-soft backdrop-blur-sm">
            {thread?.companion_answered_at && thread.focus_label ? (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                    Your Guide receives the path
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-6 text-foreground">
                    {thread.focus_label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground/70">
                    Your choice with your Companion now connects this encouragement, today’s quest, your next Guide conversation, and tonight’s reflection.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  {mentor?.name ?? pepTalk.mentor_name ?? "Your Guide"} asks
                </p>
                <p className="mt-1.5 text-sm font-semibold leading-6 text-foreground">
                  {dailyGuideQuestion.prompt}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="Choose today's focus">
                  {dailyGuideQuestion.options.map((option) => {
                    const selected = selectedFocusOption?.id === option.id;
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="h-auto min-h-10 whitespace-normal rounded-xl px-3 py-2 leading-4 disabled:opacity-100"
                        disabled={Boolean(thread?.focus_answered_at) || isThreadUpdating}
                        aria-pressed={selected}
                        onClick={() => void handleFocusSelection(option)}
                      >
                        {selected ? <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" /> : null}
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
                {thread?.focus_label ? (
                  <p className="mt-3 text-xs leading-5 text-foreground/70">
                    Today’s thread is carrying <span className="font-semibold text-foreground">{thread.focus_label}</span> into your quest, Companion, and evening reflection.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-foreground/60">
                    Choose once and Graceward will carry this focus through the rest of your day.
                  </p>
                )}
              </>
            )}
          </div>

          <audio
            ref={audioRef}
            data-testid="pep-talk-audio"
            onCanPlay={() => setIsAudioReady(true)}
            onError={() => {
              log.error("Audio loading error", {
                audioUrl: pepTalk.audio_url,
                errorCode: audioRef.current?.error?.code,
                errorMessage: audioRef.current?.error?.message,
              });
            }}
            onLoadedMetadata={() => {
              if ((audioRef.current?.duration ?? 0) > 0) {
                setIsAudioReady(true);
              }
            }}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Button
                size="icon"
                onClick={togglePlayPause}
                disabled={!isAudioReady}
                className={cn(
                  "h-20 w-20 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
                  isPlaying
                    ? "bg-gradient-to-br from-accent to-primary shadow-glow-lg scale-110"
                    : "bg-gradient-to-br from-primary to-accent shadow-glow hover:scale-110",
                )}
                aria-label={!isAudioReady ? "Loading audio" : isPlaying ? "Pause daily encouragement" : "Play daily encouragement"}
              >
                {!isAudioReady ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-8 w-8" fill="currentColor" />
                ) : (
                  <Play className="h-8 w-8 ml-1" fill="currentColor" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(-10)}
                disabled={false}
                className="h-10 w-10 rounded-full hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                aria-label="Skip back 10 seconds"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <div className="text-xs text-muted-foreground font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(10)}
                disabled={false}
                className="h-10 w-10 rounded-full hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 px-2">
              <Slider
                value={[currentTime]}
                max={duration > 0 ? duration : 1}
                step={0.1}
                onValueChange={handleSeek}
                disabled={duration === 0}
                className="w-full"
              />
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-background/60 backdrop-blur-sm border border-primary/20 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/75">
                  Follow along
                </p>
                {isEstimatedTranscript && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Timing being refined
                  </span>
                )}
              </div>
              {!showFullTranscript ? renderTranscriptPreview() : renderFullTranscript()}

              {pepTalk.script && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullTranscript((previous) => !previous)}
                  className="w-full justify-between mt-2 rounded-full hover:bg-primary/10 transition-all"
                >
                  <span className="text-xs font-medium">
                    {showFullTranscript ? "Show Less" : "Show Full Transcript"}
                  </span>
                  {showFullTranscript ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              className="w-full rounded-full shadow-soft sm:col-span-2"
              onClick={openGuideConversation}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Talk with {mentor?.name ?? pepTalk.mentor_name ?? "your Guide"} about this
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-full border-2 hover:bg-primary/10 transition-all shadow-soft"
              onClick={() => navigate(`/pep-talk/${pepTalk.id}`)}
            >
              Open Full Player
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full rounded-full bg-background/45 hover:bg-background/70"
              onClick={() => navigate("/encouragements")}
            >
              <History className="mr-2 h-4 w-4" />
              Past Encouragements
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
});

TodaysPepTalk.displayName = "TodaysPepTalk";

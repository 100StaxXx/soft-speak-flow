import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import { useXPRewards } from "@/hooks/useXPRewards";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Sparkles, SkipBack, SkipForward, ChevronDown, ChevronUp, Wand2, Loader2 } from "lucide-react";
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
import {
  invalidateTodayPepTalkQueries,
  refetchTodayPepTalkQueries,
} from "@/lib/mentorContextQueryCache";
import { queryKeys } from "@/lib/queryKeys";

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
  isFallback: boolean;
}

type InlineAudioElement = HTMLAudioElement & {
  playsInline?: boolean;
  "webkit-playsinline"?: boolean;
};

const log = logger.scope("TodaysPepTalk");
const AUDIO_READY_TIMEOUT_MS = 5000;
const transparentShellClassName = "bg-transparent backdrop-blur-none shadow-none border-white/[0.08]";

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
    .from("mentors")
    .select("slug, name")
    .eq("id", resolvedMentorId)
    .maybeSingle();

  if (mentorError) {
    throw mentorError;
  }

  if (!mentor) {
    return {
      pepTalk: null,
      mentorSlug: null,
      isFallback: false,
    };
  }

  const { data: todayPepTalk, error: pepTalkError } = await supabase
    .from("daily_pep_talks")
    .select("*")
    .eq("for_date", effectiveDate)
    .eq("mentor_slug", mentor.slug)
    .maybeSingle();

  if (pepTalkError) {
    throw pepTalkError;
  }

  if (todayPepTalk) {
    return {
      pepTalk: normalizeDailyPepTalk(todayPepTalk as Record<string, unknown>, mentor.name),
      mentorSlug: mentor.slug,
      isFallback: false,
    };
  }

  log.debug("No pep talk for today, fetching most recent...", {
    mentorSlug: mentor.slug,
    effectiveDate,
  });

  const { data: fallbackPepTalk, error: fallbackError } = await supabase
    .from("daily_pep_talks")
    .select("*")
    .eq("mentor_slug", mentor.slug)
    .order("for_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  if (!fallbackPepTalk) {
    return {
      pepTalk: null,
      mentorSlug: mentor.slug,
      isFallback: false,
    };
  }

  log.debug("Using fallback pep talk", {
    mentorSlug: mentor.slug,
    forDate: fallbackPepTalk.for_date,
  });

  return {
    pepTalk: normalizeDailyPepTalk(fallbackPepTalk as Record<string, unknown>, mentor.name),
    mentorSlug: mentor.slug,
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [, setHasAwardedXP] = useState(false);
  const [generationStage, setGenerationStage] = useState<"idle" | "script" | "audio" | "loading">("idle");
  const [isAudioReady, setIsAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const seekDebounceRef = useRef<number | null>(null);
  const transcriptScrollRafRef = useRef<number | null>(null);
  const lastTranscriptScrollTopRef = useRef<number>(0);
  const transcriptSyncAttemptedIdsRef = useRef<Set<string>>(new Set());
  const isAwardingXPRef = useRef(false);
  const hasAwardedXPRef = useRef(false);
  const previousTabActiveRef = useRef(isTabActive);
  const isNativeIOS = useMemo(
    () => typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios",
    [],
  );
  const effectiveDate = useMemo(
    () => getEffectiveDailyDate(profile?.timezone ?? undefined),
    [profile?.timezone],
  );
  const pepTalkQueryKey = useMemo(
    () => queryKeys.mentor.todayPepTalk(resolvedMentorId, effectiveDate),
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
  const isFallback = pepTalkQuery.data?.isFallback ?? false;
  const loading = pepTalkQuery.isPending || (pepTalkQuery.isFetching && !pepTalkQuery.data);
  const error = pepTalkQuery.isError && !pepTalk;
  const backdropSource = pepTalkWallpaper ? "remote" : "fallback";

  useEffect(() => {
    if (!pepTalk?.id) return;
    transcriptSyncAttemptedIdsRef.current.delete(pepTalk.id);
  }, [pepTalk?.id, pepTalkQuery.dataUpdatedAt]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsAudioReady(false);
    setHasAwardedXP(false);
    setIsPlaying(false);
    setActiveWordIndex(-1);
    isAwardingXPRef.current = false;
    hasAwardedXPRef.current = false;
  }, [pepTalk?.id]);

  useEffect(() => {
    const becameActive = isTabActive && !previousTabActiveRef.current;
    previousTabActiveRef.current = isTabActive;

    if (!resolvedMentorId || !becameActive) return;

    void invalidateTodayPepTalkQueries(queryClient, { includeAll: true });
    void refetchTodayPepTalkQueries(queryClient, {
      mentorId: resolvedMentorId,
      pepTalkDate: effectiveDate,
      includeDetail: true,
    });
  }, [effectiveDate, isTabActive, queryClient, resolvedMentorId]);

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
  const displayTranscript = useMemo(
    () => applyScriptPunctuationToTranscript(timedTranscript, pepTalk?.script),
    [timedTranscript, pepTalk?.script],
  );

  useEffect(() => {
    if (!pepTalk?.id) return;
    if (timedTranscript.length > 0) return;
    if (transcriptSyncAttemptedIdsRef.current.has(pepTalk.id)) return;

    transcriptSyncAttemptedIdsRef.current.add(pepTalk.id);

    const syncTranscript = async () => {
      try {
        const { data, error: syncError } = await supabase.functions.invoke(
          "sync-daily-pep-talk-transcript",
          { body: { id: pepTalk.id } },
        );

        if (syncError) {
          log.warn("Background transcript sync failed", {
            pepTalkId: pepTalk.id,
            error: syncError instanceof Error ? syncError.message : String(syncError),
          });
          return;
        }

        const nextTranscript = sanitizeTranscript(
          data && typeof data === "object"
            ? (data as Record<string, unknown>).transcript
            : null,
        );

        if (nextTranscript.length === 0) {
          return;
        }

        queryClient.setQueryData<TodayPepTalkQueryData>(pepTalkQueryKey, (current) => {
          if (!current?.pepTalk || current.pepTalk.id !== pepTalk.id) {
            return current;
          }

          return {
            ...current,
            pepTalk: {
              ...current.pepTalk,
              transcript: nextTranscript,
            },
          };
        });
      } catch (syncError) {
        log.warn("Background transcript sync threw unexpectedly", {
          pepTalkId: pepTalk.id,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
      }
    };

    void syncTranscript();
  }, [pepTalk?.id, pepTalkQueryKey, queryClient, timedTranscript.length]);

  const generatePepTalkMutation = useMutation({
    mutationFn: async (nextMentorSlug: string) => {
      setGenerationStage("script");
      const { data, error: generationError } = await supabase.functions.invoke(
        "generate-single-daily-pep-talk",
        { body: { mentorSlug: nextMentorSlug } },
      );

      setGenerationStage("audio");

      if (generationError) {
        const parsedError = await parseFunctionInvokeError(generationError);
        const userMessage = toUserFacingFunctionError(parsedError, {
          action: "refresh today's pep talk",
        });

        log.warn("Pep talk generation returned HTTP error", {
          status: parsedError.status,
          backendMessage: parsedError.backendMessage,
          category: parsedError.category,
          code: parsedError.code,
        });

        throw new Error(userMessage);
      }

      const generatedPepTalk =
        data && typeof data === "object" && "pepTalk" in data
          ? (data as { pepTalk?: Record<string, unknown> }).pepTalk
          : null;

      if (!generatedPepTalk) {
        throw new Error("No pep talk data returned");
      }

      setGenerationStage("loading");

      const { data: mentor } = await supabase
        .from("mentors")
        .select("name")
        .eq("slug", nextMentorSlug)
        .maybeSingle();

      return {
        pepTalk: normalizeDailyPepTalk(generatedPepTalk, mentor?.name),
        mentorSlug: nextMentorSlug,
        isFallback: false,
      } satisfies TodayPepTalkQueryData;
    },
    onSuccess: (nextData) => {
      transcriptSyncAttemptedIdsRef.current.delete(nextData.pepTalk?.id ?? "");
      queryClient.setQueryData(pepTalkQueryKey, nextData);
      toast.success("Your pep talk is ready!");
    },
    onError: async (mutationError) => {
      let errorMessage =
        mutationError instanceof Error ? mutationError.message : "Failed to prepare pep talk";

      const shouldParseFunctionError =
        (typeof mutationError === "object" && mutationError !== null && "context" in mutationError) ||
        /edge function|functions(fetch|http|relay)error|non-2xx|failed to send a request/i.test(errorMessage);

      if (shouldParseFunctionError) {
        const parsedError = await parseFunctionInvokeError(mutationError);
        errorMessage = toUserFacingFunctionError(parsedError, {
          action: "refresh today's pep talk",
        });
      }

      toast.error(errorMessage);
    },
    onSettled: async () => {
      try {
        await invalidateTodayPepTalkQueries(queryClient, {
          mentorId: resolvedMentorId,
          pepTalkDate: effectiveDate,
          includeDetail: true,
        });
        await refetchTodayPepTalkQueries(queryClient, {
          mentorId: resolvedMentorId,
          pepTalkDate: effectiveDate,
          includeDetail: true,
        });
      } finally {
        setGenerationStage("idle");
      }
    },
  });

  const isGenerating = generatePepTalkMutation.isPending;

  const handleGeneratePepTalk = () => {
    if (!mentorSlug) {
      toast.error("No guide selected");
      return;
    }

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
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
  }, [maybeAwardPepTalkXP]);

  useEffect(() => {
    setActiveWordIndex((previousIndex) =>
      getActiveWordIndex(timedTranscript, currentTime, previousIndex),
    );
  }, [timedTranscript, currentTime]);

  useEffect(() => {
    return () => {
      if (transcriptScrollRafRef.current !== null) {
        window.cancelAnimationFrame(transcriptScrollRafRef.current);
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
      return;
    }

    audio.load();
    const playedAfterReload = await safePlay(audio);
    if (playedAfterReload) {
      setIsPlaying(true);
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
              Daily Message
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {error ? "Unable to load today's pep talk" : "No pep talk available today"}
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
                  {generationStage === "script" && "Preparing script..."}
                  {generationStage === "audio" && "Creating audio..."}
                  {generationStage === "loading" && "Loading..."}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Prepare Today's Pep Talk
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="default"
              className="rounded-full"
              onClick={() => navigate("/pep-talks")}
            >
              Browse Library
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
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <Sparkles className="h-6 w-6 text-primary animate-pulse-slow" />
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-full" />
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-text">
            Daily Message
          </h2>
        </div>

        <div className="space-y-6 p-6 rounded-2xl bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border-2 border-primary/30 shadow-glow">
          {isFallback && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1 mx-auto w-fit">
              <span>From {new Date(pepTalk.for_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
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
                aria-label={!isAudioReady ? "Loading audio" : isPlaying ? "Pause pep talk" : "Play pep talk"}
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

          <Button
            variant="outline"
            size="lg"
            className="w-full rounded-full border-2 hover:bg-primary/10 hover:scale-105 transition-all shadow-soft"
            onClick={() => navigate("/pep-talks")}
          >
            Browse More Pep Talks
          </Button>
        </div>
      </div>
    </Card>
  );
});

TodaysPepTalk.displayName = "TodaysPepTalk";

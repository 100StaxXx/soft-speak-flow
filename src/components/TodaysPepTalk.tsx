import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { SkeletonPepTalk } from "@/components/SkeletonCard";
import { useXPRewards } from "@/hooks/useXPRewards";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Sparkles, SkipBack, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";

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

export const TodaysPepTalk = () => {
  const { profile } = useProfile();
  const personality = useMentorPersonality();
  const navigate = useNavigate();
  const { awardPepTalkListened, XP_REWARDS } = useXPRewards();
  const [pepTalk, setPepTalk] = useState<DailyPepTalk | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [hasAwardedXP, setHasAwardedXP] = useState(false);
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Track walkthrough state
  useEffect(() => {
    const checkWalkthrough = () => {
      setIsWalkthroughActive(Boolean(localStorage.getItem('appWalkthroughActive')));
    };

    checkWalkthrough();
    
    // Listen for walkthrough state changes
    const handleTutorialChange = () => checkWalkthrough();
    window.addEventListener('tutorial-step-change', handleTutorialChange);
    
    return () => {
      window.removeEventListener('tutorial-step-change', handleTutorialChange);
    };
  }, []);

  useEffect(() => {
    const fetchDailyPepTalk = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      const { data: mentor } = await supabase
        .from("mentors")
        .select("slug, name")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle();

      if (!mentor) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("daily_pep_talks")
        .select("*")
        .eq("for_date", today)
        .eq("mentor_slug", mentor.slug)
        .maybeSingle();

      if (data) {
        const transcript = Array.isArray(data.transcript) 
          ? (data.transcript as unknown as CaptionWord[]) 
          : [];
        setPepTalk({ 
          ...data, 
          mentor_name: mentor.name,
          transcript,
        } as DailyPepTalk);
      }
      setLoading(false);
    };

    fetchDailyPepTalk();
  }, [profile?.selected_mentor_id]);

  useEffect(() => {
    const runSync = async () => {
      if (!pepTalk?.id || !pepTalk?.audio_url) return;
      try {
        const { data, error } = await supabase.functions.invoke('sync-daily-pep-talk-transcript', {
          body: { id: pepTalk.id }
        });
        if (!error && data?.script) {
          setPepTalk((prev: any) => {
            if (!prev) return prev;
            const shouldUpdate = data.script !== prev.script || JSON.stringify(data.transcript) !== JSON.stringify(prev.transcript);
            return shouldUpdate ? { 
              ...prev, 
              script: data.script,
              transcript: data.transcript || []
            } : prev;
          });
        }
      } catch (_) {
        // silent fail; avoid blocking UI if sync fails
      }
    };
    runSync();
  }, [pepTalk?.id]);

  // Check if XP was already awarded for this specific pep talk
  useEffect(() => {
    const checkXPStatus = async () => {
      if (!pepTalk?.id || !profile?.id) return;
      
      const { data } = await supabase
        .from('xp_events')
        .select('id')
        .eq('user_id', profile.id)
        .eq('event_type', 'pep_talk_listen')
        .eq('event_metadata->>pep_talk_id', pepTalk.id)
        .maybeSingle();
      
      setHasAwardedXP(!!data);
    };
    
    checkXPStatus();
  }, [pepTalk?.id, profile?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      // Award XP when user has listened to 80% (only once per pep talk)
      if (!hasAwardedXP && duration > 0 && time >= duration * 0.8 && pepTalk?.id && profile?.id) {
        setHasAwardedXP(true);
        awardPepTalkListened();
      }
      
      // Update active word index based on word timestamps
      if (pepTalk?.transcript && Array.isArray(pepTalk.transcript) && pepTalk.transcript.length > 0) {
        const wordIndex = pepTalk.transcript.findIndex((w: CaptionWord) => 
          time >= w.start && time <= w.end
        );
        if (wordIndex !== activeWordIndex && wordIndex >= 0) {
          setActiveWordIndex(wordIndex);
        }
      }
    };
    
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setActiveWordIndex(-1);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [pepTalk?.transcript, activeWordIndex, hasAwardedXP, duration, awardPepTalkListened, pepTalk?.id, profile?.id]);

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current && transcriptRef.current && showFullTranscript) {
      const container = transcriptRef.current;
      const activeWord = activeWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const wordRect = activeWord.getBoundingClientRect();
      
      if (wordRect.top < containerRect.top || wordRect.bottom > containerRect.bottom) {
        activeWord.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeWordIndex, showFullTranscript]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const skipTime = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
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

    const words = pepTalk.script.split(' ');
    const previewWords = words.slice(0, 20);

    return (
      <div className="text-sm leading-relaxed text-foreground/70">
        {previewWords.join(' ')}...
      </div>
    );
  };

  const renderFullTranscript = () => {
    if (!pepTalk?.transcript || !Array.isArray(pepTalk.transcript)) {
      // Fallback to plain text if no word timestamps
      if (!pepTalk?.script) return null;
      return (
        <div 
          ref={transcriptRef}
          className="text-sm leading-relaxed max-h-64 overflow-y-auto scroll-smooth pr-2 text-foreground/80"
        >
          {pepTalk.script}
        </div>
      );
    }

    return (
      <div 
        ref={transcriptRef}
        className="text-sm leading-relaxed max-h-64 overflow-y-auto scroll-smooth pr-2 text-foreground/80"
      >
        {pepTalk.transcript.map((wordData: CaptionWord, index: number) => (
          <span
            key={index}
            ref={index === activeWordIndex ? activeWordRef : null}
            className={cn(
              "transition-colors duration-200",
              index === activeWordIndex
                ? "text-primary font-semibold bg-primary/10 px-1 rounded"
                : "text-foreground/80"
            )}
          >
            {wordData.word}{" "}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (!pepTalk) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] bg-gradient-to-br from-[#E1BEE7] via-[#F3E5F5] to-[#EDE7F6] dark:from-card dark:via-card/95 dark:to-card/90 animate-fade-in">
      {/* Particle glows when playing */}
      {isPlaying && (
        <>
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-[#BA68C8]/30 dark:bg-primary/30 blur-3xl rounded-full animate-float" />
          <div className="absolute bottom-1/4 left-1/4 w-32 h-32 bg-[#9575CD]/30 dark:bg-accent/30 blur-3xl rounded-full animate-float" style={{ animationDelay: "0.5s" }} />
        </>
      )}
      
      <div className="relative p-6 space-y-4">
        {/* Header with sparkle */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-6 w-6 text-[#AB47BC] dark:text-primary animate-pulse" />
            <div className="absolute inset-0 bg-[#AB47BC]/20 dark:bg-primary/20 blur-md rounded-full" />
          </div>
          <h2 className="text-xl font-black text-[#7B1FA2] dark:text-primary">
            {personality?.name ? `${personality.name}'s Message` : "Today's Pep Talk"}
          </h2>
        </div>

        {/* Content bubble */}
        <div className="space-y-4 p-5 rounded-2xl bg-white/60 dark:bg-background/50 backdrop-blur-sm border-2 border-[#CE93D8]/30 dark:border-primary/30 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <div className="space-y-2">
            <h3 className="font-bold text-lg text-[#7B1FA2] dark:text-foreground">
              {pepTalk.title}
            </h3>
            <p className="text-sm text-[#4A148C]/80 dark:text-muted-foreground">
              {pepTalk.summary}
            </p>
          </div>

          {/* Audio Player */}
          <audio ref={audioRef} src={pepTalk.audio_url} preload="metadata" />
          
          <div className="space-y-3">
            {/* Large Central Play Button */}
            <div className="flex justify-center py-4">
              <button
                onClick={togglePlayPause}
                disabled={isWalkthroughActive}
                className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#AB47BC] to-[#7E57C2] dark:from-primary dark:to-primary/80 shadow-[0_8px_20px_rgba(171,71,188,0.4)] dark:shadow-glow hover:scale-110 hover:shadow-[0_12px_28px_rgba(171,71,188,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="absolute inset-0 rounded-full bg-white/20 group-hover:animate-ping" />
                {isPlaying ? (
                  <Pause className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-white" fill="currentColor" />
                ) : (
                  <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-white ml-1" fill="currentColor" />
                )}
              </button>
            </div>

            {/* Compact Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(-10)}
                disabled={isWalkthroughActive}
                className="h-10 w-10 rounded-full bg-[#CE93D8]/30 dark:bg-primary/20 hover:bg-[#CE93D8]/50 dark:hover:bg-primary/30 disabled:opacity-50"
              >
                <SkipBack className="h-4 w-4 text-[#7B1FA2] dark:text-primary" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(10)}
                disabled={isWalkthroughActive}
                className="h-10 w-10 rounded-full bg-[#CE93D8]/30 dark:bg-primary/20 hover:bg-[#CE93D8]/50 dark:hover:bg-primary/30 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4 text-[#7B1FA2] dark:text-primary" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                disabled={isWalkthroughActive}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#4A148C]/60 dark:text-muted-foreground font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transcript bubble */}
            <div className="space-y-2 p-4 rounded-xl bg-white/40 dark:bg-background/40 border border-[#CE93D8]/20 dark:border-border/50">
              {!showFullTranscript ? renderTranscriptPreview() : renderFullTranscript()}
              
              {pepTalk?.script && (
                <button
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="w-full mt-2 px-4 py-2 rounded-full bg-[#CE93D8]/30 dark:bg-primary/20 hover:bg-[#CE93D8]/50 dark:hover:bg-primary/30 transition-all text-xs font-bold text-[#7B1FA2] dark:text-primary flex items-center justify-center gap-2"
                >
                  <span>
                    {showFullTranscript ? "Show Less" : "Show Transcript"}
                  </span>
                  {showFullTranscript ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => navigate("/pep-talks")}
            className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-[#AB47BC] to-[#7E57C2] dark:from-primary dark:to-primary/80 hover:scale-105 transition-all duration-300 text-white font-bold shadow-[0_4px_12px_rgba(171,71,188,0.3)] dark:shadow-glow"
          >
            Browse More Pep Talks
          </button>
        </div>
      </div>
    </div>
  );
};

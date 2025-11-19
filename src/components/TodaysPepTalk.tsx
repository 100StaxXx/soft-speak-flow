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

export const TodaysPepTalk = () => {
  const { profile } = useProfile();
  const personality = useMentorPersonality();
  const navigate = useNavigate();
  const { awardPepTalkListened, XP_REWARDS } = useXPRewards();
  const [pepTalk, setPepTalk] = useState<any>(null);
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
        const transcript = Array.isArray(data.transcript) ? data.transcript : [];
        setPepTalk({ 
          ...data, 
          mentor_name: mentor.name,
          transcript
        });
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



  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      // Award XP when user has listened to 80% of the pep talk
      if (!hasAwardedXP && duration > 0 && time >= duration * 0.8) {
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
  }, [pepTalk?.transcript, activeWordIndex]);

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
    <Card className="relative overflow-hidden group animate-fade-in">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-background opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-accent/20 opacity-40" />
      
      {/* Animated glows */}
      <div className="absolute -top-1/3 -right-1/3 w-2/3 h-2/3 bg-primary/20 blur-3xl rounded-full animate-pulse" />
      <div className="absolute -bottom-1/3 -left-1/3 w-2/3 h-2/3 bg-accent/20 blur-3xl rounded-full animate-pulse" style={{ animationDelay: "1s" }} />
      
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {personality?.name ? `${personality.name}'s Message` : "Today's Pep Talk"}
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="space-y-2">
            <h3 className="font-bold text-foreground">
              {pepTalk.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {pepTalk.summary}
            </p>
          </div>

          {/* Audio Player */}
          <audio ref={audioRef} src={pepTalk.audio_url} preload="metadata" />
          
          <div className="space-y-3">
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(-10)}
                disabled={isWalkthroughActive}
                className="h-10 w-10 rounded-full hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                onClick={togglePlayPause}
                disabled={isWalkthroughActive}
                className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" fill="currentColor" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(10)}
                disabled={isWalkthroughActive}
                className="h-10 w-10 rounded-full hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="h-4 w-4" />
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transcript Section */}
            <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
              {!showFullTranscript ? renderTranscriptPreview() : renderFullTranscript()}
              
              {pepTalk?.script && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="w-full justify-between mt-2"
                >
                  <span className="text-xs">
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
            size="sm"
            className="w-full"
            onClick={() => navigate("/pep-talks")}
          >
            Browse More Pep Talks
          </Button>
        </div>
      </div>
    </Card>
  );
};

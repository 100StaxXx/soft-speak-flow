import { useEffect, useState, useRef, useCallback } from "react";
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
  const seekDebounceRef = useRef<number | null>(null);

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
      if (!profile?.selected_mentor_id) {
        setLoading(false);
        return;
      }

      const today = new Date().toLocaleDateString("en-CA");

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
        // Validate and sanitize transcript data
        let transcript: CaptionWord[] = [];
        if (Array.isArray(data.transcript)) {
          // Validate each word object has required fields
          transcript = (data.transcript as unknown as CaptionWord[]).filter(
            (word): word is CaptionWord => 
              word && 
              typeof word === 'object' &&
              typeof word.word === 'string' &&
              typeof word.start === 'number' &&
              typeof word.end === 'number'
          );
        }
        
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
          
          // Validate transcript from sync response
          let validatedTranscript: CaptionWord[] = [];
          if (Array.isArray(data.transcript)) {
            validatedTranscript = (data.transcript as unknown as CaptionWord[]).filter(
              (word): word is CaptionWord => 
                word && 
                typeof word === 'object' &&
                typeof word.word === 'string' &&
                typeof word.start === 'number' &&
                typeof word.end === 'number'
            );
          }
          
          const shouldUpdate = data.script !== prev.script || JSON.stringify(validatedTranscript) !== JSON.stringify(prev.transcript);
          return shouldUpdate ? { 
            ...prev, 
            script: data.script,
            transcript: validatedTranscript
          } : prev;
        });
      }
      } catch (error) {
        console.error('Transcript sync failed:', error);
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
        awardPepTalkListened({ pep_talk_id: pepTalk.id });
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

  // Cleanup seek debounce on unmount
  useEffect(() => {
    return () => {
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
    };
  }, []);

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
      audio.play().catch(err => console.error('Audio play failed:', err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Update UI immediately for responsiveness
    setCurrentTime(value[0]);
    
    // Debounce actual audio seek to prevent excessive operations
    if (seekDebounceRef.current) {
      clearTimeout(seekDebounceRef.current);
    }
    
    seekDebounceRef.current = window.setTimeout(() => {
      if (audio) {
        audio.currentTime = value[0];
      }
    }, 100);
  }, []);

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
    <Card className="relative overflow-hidden group animate-fade-in rounded-3xl border-2">
      {/* Pokemon-style gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-accent/15 to-primary/10 animate-gradient-shift" />
      
      {/* Sparkle particles when playing */}
      {isPlaying && (
        <>
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-primary rounded-full animate-sparkle" />
          <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-accent rounded-full animate-sparkle" style={{ animationDelay: '0.3s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-primary rounded-full animate-sparkle" style={{ animationDelay: '0.6s' }} />
          <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-accent rounded-full animate-sparkle" style={{ animationDelay: '0.9s' }} />
        </>
      )}
      
      {/* Glowing orbs */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-3xl rounded-full animate-pulse-slow" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/20 blur-3xl rounded-full animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
      
      <div className="relative p-6 md:p-8 space-y-6">
        {/* Header with sparkle icon */}
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <Sparkles className="h-6 w-6 text-primary animate-pulse-slow" />
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-full" />
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-text">
            {personality?.name ? `${personality.name}'s Daily Message` : "Today's Pep Talk"}
          </h2>
        </div>

        {/* Bubble card content */}
        <div className="space-y-6 p-6 rounded-2xl bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border-2 border-primary/30 shadow-glow">
          <div className="space-y-3 text-center">
            <h3 className="text-xl md:text-2xl font-bold text-foreground">
              {pepTalk.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {pepTalk.summary}
            </p>
          </div>

          {/* Audio Player */}
          <audio ref={audioRef} src={pepTalk.audio_url} preload="metadata" />
          
          <div className="space-y-4">
            {/* Large central play button */}
            <div className="flex items-center justify-center">
              <Button
                size="icon"
                onClick={togglePlayPause}
                disabled={isWalkthroughActive}
                className={cn(
                  "h-20 w-20 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
                  isPlaying
                    ? "bg-gradient-to-br from-accent to-primary shadow-glow-lg scale-110"
                    : "bg-gradient-to-br from-primary to-accent shadow-glow hover:scale-110"
                )}
                aria-label={isPlaying ? "Pause pep talk" : "Play pep talk"}
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8" fill="currentColor" />
                ) : (
                  <Play className="h-8 w-8 ml-1" fill="currentColor" />
                )}
              </Button>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(-10)}
                disabled={isWalkthroughActive}
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
                disabled={isWalkthroughActive}
                className="h-10 w-10 rounded-full hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 px-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                disabled={isWalkthroughActive}
                className="w-full"
              />
            </div>

            {/* Transcript bubble */}
            <div className="space-y-2 p-4 rounded-2xl bg-background/60 backdrop-blur-sm border border-primary/20 shadow-soft">
              {!showFullTranscript ? renderTranscriptPreview() : renderFullTranscript()}
              
              {pepTalk?.script && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
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
};

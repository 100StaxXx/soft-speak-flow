import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Sparkles, SkipBack, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TodaysPepTalk = () => {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [pepTalk, setPepTalk] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchDailyPepTalk = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      const { data: mentor } = await supabase
        .from("mentors")
        .select("slug, name")
        .eq("id", profile.selected_mentor_id)
        .single();

      if (!mentor) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("daily_pep_talks")
        .select("*")
        .eq("for_date", today)
        .eq("mentor_slug", mentor.slug)
        .single();

      if (data) {
        setPepTalk({ ...data, mentor_name: mentor.name });
      }
      setLoading(false);
    };

    fetchDailyPepTalk();
  }, [profile?.selected_mentor_id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [pepTalk]);

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
            Today's Pep Talk
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
                className="h-10 w-10 rounded-full hover:bg-primary/20"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                onClick={togglePlayPause}
                className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 transition-all"
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
                className="h-10 w-10 rounded-full hover:bg-primary/20"
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
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transcript Toggle */}
            {pepTalk.script && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full justify-between"
              >
                <span className="text-xs">Transcription</span>
                {showTranscript ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Transcript */}
            {showTranscript && pepTalk.script && (
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 max-h-48 overflow-y-auto">
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {pepTalk.script}
                </p>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => navigate("/inspire")}
          >
            Browse More Pep Talks
          </Button>
        </div>
      </div>
    </Card>
  );
};

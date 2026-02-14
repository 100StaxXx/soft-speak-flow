import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { GlassCard } from "@/components/ui/glass-card";

import { globalAudio } from "@/utils/globalAudio";
import { safePlay, createIOSOptimizedAudio, isIOS, iosAudioManager } from "@/utils/iosAudio";
import { setupMediaSession, updateMediaSession, clearMediaSession } from "@/utils/mediaSession";

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const AudioPlayer = ({ audioUrl, title, onTimeUpdate }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize audio element with iOS optimizations
  useEffect(() => {
    const audio = createIOSOptimizedAudio(audioUrl);
    audioRef.current = audio;
    
    // Register with iOS audio manager for coordinated control
    if (isIOS) {
      iosAudioManager.registerAudio(audio);
    }
    
    // Setup Media Session API for iOS lock screen controls
    setupMediaSession({
      title,
      onPlay: () => {
        if (audio && !globalAudio.getMuted()) {
          safePlay(audio).then((success) => {
            if (success) setIsPlaying(true);
          });
        }
      },
      onPause: () => {
        if (audio) {
          audio.pause();
          setIsPlaying(false);
        }
      },
      onSeekBackward: () => skipTime(-10),
      onSeekForward: () => skipTime(10),
    });
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        if (isIOS) {
          iosAudioManager.unregisterAudio(audioRef.current);
        }
      }
      clearMediaSession();
    };
  }, [audioUrl, title]);


  // Listen for global mute changes
  useEffect(() => {
    const unsubscribe = globalAudio.subscribe((muted) => {
      const audio = audioRef.current;
      if (audio) {
        // Use muted property for proper iOS support
        audio.muted = muted;
        // Pause playback if globally muted
        if (muted && isPlaying) {
          audio.pause();
          setIsPlaying(false);
        }
      }
    });

    return unsubscribe;
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
      // Update Media Session position state
      updateMediaSession({
        position: time,
        duration: audio.duration,
        playbackState: audio.paused ? 'paused' : 'playing',
      });
    };
    const updateDuration = () => {
      setDuration(audio.duration);
      updateMediaSession({
        duration: audio.duration,
      });
    };
    const handleEnded = () => {
      setIsPlaying(false);
      updateMediaSession({ playbackState: 'none' });
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl, onTimeUpdate]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      updateMediaSession({ playbackState: 'paused' });
    } else {
      // If globally muted, unmute when user explicitly clicks play
      if (globalAudio.getMuted()) {
        globalAudio.setMuted(false);
      }
      
      // Ensure audio is not muted before playing
      audio.muted = false;
      
      // Use iOS-safe play function
      const success = await safePlay(audio);
      if (success) {
        setIsPlaying(true);
        updateMediaSession({ playbackState: 'playing' });
      }
    }
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

  return (
    <GlassCard variant="elevated" glow="soft" className="w-full p-6">
      {/* Audio element is created programmatically for iOS compatibility */}
      
      <div className="space-y-5">
        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skipTime(-10)}
            className="rounded-full h-11 w-11 hover:bg-muted/50 transition-colors"
            aria-label="Skip back 10 seconds"
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            className="h-16 w-16 rounded-full bg-gradient-to-br from-primary via-primary to-stardust-gold/70 hover:shadow-glow transition-all duration-300 hover:scale-105"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" fill="currentColor" />
            ) : (
              <Play className="h-7 w-7 ml-1" fill="currentColor" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => skipTime(10)}
            className="rounded-full h-11 w-11 hover:bg-muted/50 transition-colors"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="relative">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-primary [&_[role=slider]]:to-stardust-gold [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-glow"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

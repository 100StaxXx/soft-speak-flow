import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
  const [isGloballyMuted, setIsGloballyMuted] = useState(globalAudio.getMuted());

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
      setIsGloballyMuted(muted);
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
      // Don't play if globally muted
      if (globalAudio.getMuted()) {
        return;
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
    <div className="w-full bg-card rounded-3xl p-6 shadow-soft">
      {/* Audio element is created programmatically for iOS compatibility */}
      
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skipTime(-10)}
            className="rounded-full hover:bg-secondary"
            aria-label="Skip back 10 seconds"
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            className="h-16 w-16 rounded-full bg-gradient-to-br from-blush-rose to-petal-pink hover:shadow-glow transition-all"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" fill="currentColor" />
            ) : (
              <Play className="h-8 w-8 ml-1" fill="currentColor" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => skipTime(10)}
            className="rounded-full hover:bg-secondary"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

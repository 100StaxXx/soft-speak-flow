import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { duckAmbient, unduckAmbient } from "@/utils/ambientMusic";

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const AudioPlayer = ({ audioUrl, title, onTimeUpdate }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Duck ambient music when playing
  useEffect(() => {
    if (isPlaying) {
      duckAmbient();
    } else {
      unduckAmbient();
    }

    return () => {
      // Only unduck if we were actually playing (and thus ducked the music)
      if (isPlaying) {
        unduckAmbient();
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };
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
  }, [audioUrl, onTimeUpdate]);

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
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
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

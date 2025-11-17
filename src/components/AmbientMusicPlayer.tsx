import { useEffect, useState } from "react";
import { ambientMusic } from "@/utils/ambientMusic";
import { Music, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AmbientMusicPlayer = () => {
  const [state, setState] = useState(ambientMusic.getState());

  useEffect(() => {
    // Start playing ambient music on mount (will wait for user interaction)
    if (!state.isMuted) {
      ambientMusic.play();
    }

    // Update state when music settings change
    const updateState = () => {
      setState(ambientMusic.getState());
    };

    // Pause audio when app is not visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        ambientMusic.pause();
      } else if (!state.isMuted) {
        ambientMusic.play();
      }
    };

    window.addEventListener('bg-music-volume-change', updateState);
    window.addEventListener('bg-music-mute-change', updateState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('bg-music-volume-change', updateState);
      window.removeEventListener('bg-music-mute-change', updateState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isMuted]);

  const handleToggle = () => {
    ambientMusic.toggleMute();
    setState(ambientMusic.getState());
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={cn(
        "fixed top-4 right-4 z-40 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-lg transition-all duration-300 hover:scale-110",
        state.isPlaying && !state.isMuted && "animate-pulse"
      )}
      aria-label={state.isMuted ? "Unmute ambient music" : "Mute ambient music"}
    >
      {state.isMuted ? (
        <VolumeX className="h-5 w-5 text-muted-foreground" />
      ) : (
        <div className="relative">
          <Music className="h-5 w-5 text-primary" />
          {state.isPlaying && (
            <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>
      )}
    </Button>
  );
};

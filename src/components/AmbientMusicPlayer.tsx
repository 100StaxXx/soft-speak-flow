import { useEffect, useState } from "react";
import { ambientMusic } from "@/utils/ambientMusic";
import { Music, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AmbientMusicPlayer = () => {
  const [state, setState] = useState(ambientMusic.getState());

  useEffect(() => {
    // Start playing ambient music on mount (will wait for user interaction)
    // Get fresh state instead of using potentially stale state
    const currentState = ambientMusic.getState();
    if (!currentState.isMuted) {
      ambientMusic.play();
    }

    // Update state when music settings change
    const updateState = () => {
      setState(ambientMusic.getState());
    };

    window.addEventListener('bg-music-volume-change', updateState);
    window.addEventListener('bg-music-mute-change', updateState);

    return () => {
      window.removeEventListener('bg-music-volume-change', updateState);
      window.removeEventListener('bg-music-mute-change', updateState);
    };
  }, []); // Only run on mount, not when state changes

  // Handle visibility changes separately to avoid stale closure issues
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentState = ambientMusic.getState();
      
      if (document.hidden) {
        // Only pause if not paused for an event (evolution, etc.)
        // Events handle their own pause/resume logic
        if (!currentState.isPausedForEvent) {
          ambientMusic.pause();
        }
      } else {
        // Resume only if not muted and not paused for event
        if (!currentState.isMuted && !currentState.isPausedForEvent) {
          ambientMusic.play();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleToggle = () => {
    const newMutedState = ambientMusic.toggleMute();
    // Dispatch window event to notify all listeners (including this component)
    window.dispatchEvent(new CustomEvent('bg-music-mute-change', { detail: newMutedState }));
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

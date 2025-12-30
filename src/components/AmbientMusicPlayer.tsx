import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ambientMusic } from "@/utils/ambientMusic";
import { globalAudio } from "@/utils/globalAudio";
import { isIOS, setupIOSAudioInteraction } from "@/utils/iosAudio";
import { Music, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISABLED_ROUTES = ['/journeys'];

export const AmbientMusicPlayer = () => {
  const location = useLocation();
  const isDisabledRoute = DISABLED_ROUTES.includes(location.pathname);
  const [state, setState] = useState(ambientMusic.getState());
  const [isGloballyMuted, setIsGloballyMuted] = useState(globalAudio.getMuted());

  useEffect(() => {
    // Setup iOS audio interaction on mount
    if (isIOS) {
      setupIOSAudioInteraction();
    }
    
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
    
    // Update state when global mute changes
    const updateGlobalMute = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsGloballyMuted(customEvent.detail);
      setState(ambientMusic.getState());
    };

    window.addEventListener('bg-music-volume-change', updateState);
    window.addEventListener('bg-music-mute-change', updateState);
    window.addEventListener('global-audio-mute-change', updateGlobalMute);
    
    // iOS-specific: listen for audio mute changes
    if (isIOS) {
      window.addEventListener('ios-audio-mute-change', updateGlobalMute);
    }

    return () => {
      window.removeEventListener('bg-music-volume-change', updateState);
      window.removeEventListener('bg-music-mute-change', updateState);
      window.removeEventListener('global-audio-mute-change', updateGlobalMute);
      if (isIOS) {
        window.removeEventListener('ios-audio-mute-change', updateGlobalMute);
      }
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

  // Pause/resume music based on route
  useEffect(() => {
    if (isDisabledRoute) {
      ambientMusic.pause();
    } else {
      const currentState = ambientMusic.getState();
      if (!currentState.isMuted && !globalAudio.getMuted()) {
        ambientMusic.play();
      }
    }
  }, [isDisabledRoute]);

  const handleToggle = () => {
    // Toggle global mute which affects ALL audio (ambient music, sound effects, pep talks, etc.)
    const newMutedState = globalAudio.toggleMute();
    setIsGloballyMuted(newMutedState);
  };

  // Use global mute state for display (covers all audio)
  const isMuted = isGloballyMuted;

  // Hide audio button on disabled routes
  if (isDisabledRoute) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={cn(
        "fixed left-4 z-40 rounded-full bg-background/40 backdrop-blur-sm border border-border/30 transition-all duration-300",
        "opacity-40 hover:opacity-100 hover:scale-110",
        state.isPlaying && !isMuted && "animate-pulse opacity-50"
      )}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      aria-label={isMuted ? "Unmute all audio" : "Mute all audio"}
    >
      {isMuted ? (
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

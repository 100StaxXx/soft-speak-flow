import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  action: string;
  illustration?: string;
}

interface TutorialModalProps {
  step: TutorialStep;
  currentStep: number;
  totalSteps: number;
  mentorSlug: string;
  onAction?: () => void;
  onSkip?: () => void;
}

export const TutorialModal = ({
  step,
  currentStep,
  totalSteps,
  mentorSlug,
  onAction,
  onSkip,
}: TutorialModalProps) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasUserPaused, setHasUserPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate and play TTS when step changes
  useEffect(() => {
    const generateTTS = async () => {
      try {
        console.log(`[TutorialModal] Generating TTS for step: ${step.id}, mentor: ${mentorSlug}`);
        
        // Check if audio is cached in localStorage
        const cacheKey = `tutorial-audio-${mentorSlug}-${step.id}`;
        
        // Clean up old tutorial audio if storage is getting full
        try {
          const storageKeys = Object.keys(localStorage);
          const tutorialKeys = storageKeys.filter(key => key.startsWith('tutorial-audio-'));
          
          // If we have more than 5 cached audio files, remove the oldest ones
          if (tutorialKeys.length > 5) {
            console.log('[TutorialModal] Cleaning up old tutorial audio cache');
            // Remove all but the most recent 3
            tutorialKeys.slice(0, tutorialKeys.length - 3).forEach(key => {
              localStorage.removeItem(key);
            });
          }
        } catch (e) {
          console.warn('[TutorialModal] Error cleaning up audio cache:', e);
        }
        
        const cachedAudio = localStorage.getItem(cacheKey);

        if (cachedAudio) {
          console.log(`[TutorialModal] Using cached audio for step: ${step.id}`);
          setAudioUrl(cachedAudio);
          return;
        }

        console.log(`[TutorialModal] Calling edge function to generate TTS...`);
        
        // Generate new audio
        const { data, error } = await supabase.functions.invoke('generate-tutorial-tts', {
          body: {
            text: step.content,
            mentorSlug,
            stepId: step.id,
          },
        });

        if (error) {
          console.error('[TutorialModal] Edge function error:', error);
          throw error;
        }

        if (data?.audioContent) {
          console.log(`[TutorialModal] Successfully generated TTS for step: ${step.id}`);
          const audioDataUrl = `data:audio/mp3;base64,${data.audioContent}`;
          setAudioUrl(audioDataUrl);
          
          // Cache the audio with error handling
          try {
            localStorage.setItem(cacheKey, audioDataUrl);
            console.log(`[TutorialModal] Cached audio for step: ${step.id}`);
          } catch (e) {
            // localStorage might be full, try to clear old tutorial audio
            console.warn('[TutorialModal] Failed to cache audio, attempting to clear old cache:', e);
            try {
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('tutorial-audio-') && key !== cacheKey) {
                  localStorage.removeItem(key);
                }
              });
              // Retry caching after cleanup
              localStorage.setItem(cacheKey, audioDataUrl);
            } catch (retryError) {
              console.warn('[TutorialModal] Still unable to cache after cleanup:', retryError);
            }
          }
        } else {
          console.warn('[TutorialModal] No audioContent in response');
        }
      } catch (error) {
        console.error('[TutorialModal] Failed to generate tutorial TTS:', error);
        // Continue without audio rather than blocking the tutorial
      }
    };

    generateTTS();
    
    // Cleanup: pause and reset audio when component unmounts or step changes
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setHasUserPaused(false);
    };
  }, [step.id, step.content, mentorSlug]);

  // Auto-play when audio is ready (unless muted) with browser policy handling
  useEffect(() => {
    if (audioUrl && audioRef.current && !isMuted) {
      // Reset audio to start before playing
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((error) => {
          // Browser might block autoplay - this is expected behavior
          console.log('[TutorialModal] Autoplay prevented by browser policy:', error);
          setIsPlaying(false);
        });
    }
  }, [audioUrl, isMuted]);

  // Handle unmuting - only restart if user didn't manually pause
  useEffect(() => {
    if (!isMuted && audioUrl && audioRef.current && !isPlaying && !hasUserPaused) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isMuted, audioUrl, hasUserPaused]);

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setHasUserPaused(true);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      setHasUserPaused(false);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (newMutedState && audioRef.current) {
      // Muting - pause audio
      audioRef.current.pause();
      setIsPlaying(false);
    }
    // Unmuting is handled by the useEffect above
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <Card className="max-w-2xl w-full mx-4 p-0 overflow-hidden border-4 border-primary shadow-2xl">
        {/* Progress Bar */}
        <div className="h-2 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Step Counter */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="h-8 w-8 p-0"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              {audioUrl && !isMuted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAudio}
                  className="h-8 px-3 text-xs"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
              )}
            </div>
          </div>

          {/* Illustration */}
          {step.illustration && (
            <div className="flex justify-center">
              <div className="text-8xl animate-bounce-slow">
                {step.illustration}
              </div>
            </div>
          )}

          {/* Title */}
          <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-normal">
            {step.title}
          </h2>

          {/* Content */}
          <p className="text-xl text-center leading-relaxed text-foreground">
            {step.content}
          </p>

          {/* Action Instruction */}
          <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl p-6 border-2 border-primary/50">
            <p className="text-lg font-semibold text-center">
              {step.action}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-4">
            {onSkip && currentStep === 0 && (
              <Button
                onClick={onSkip}
                variant="ghost"
                size="lg"
                className="text-lg px-6 py-6"
              >
                Skip Tutorial
              </Button>
            )}
            <Button
              onClick={onAction}
              size="lg"
              className="text-lg px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
            >
              Got It
            </Button>
          </div>
        </div>
      </Card>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => console.error('Audio playback error:', e)}
        />
      )}
    </div>
  );
};

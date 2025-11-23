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
}

export const TutorialModal = ({
  step,
  currentStep,
  totalSteps,
  mentorSlug,
  onAction,
}: TutorialModalProps) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate and play TTS when step changes
  useEffect(() => {
    const generateTTS = async () => {
      try {
        console.log(`[TutorialModal] Generating TTS for step: ${step.id}, mentor: ${mentorSlug}`);
        
        // Check if audio is cached in localStorage
        const cacheKey = `tutorial-audio-${mentorSlug}-${step.id}`;
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
          
          // Cache the audio
          try {
            localStorage.setItem(cacheKey, audioDataUrl);
            console.log(`[TutorialModal] Cached audio for step: ${step.id}`);
          } catch (e) {
            console.warn('[TutorialModal] Failed to cache audio (localStorage full?):', e);
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
  }, [step.id, step.content, mentorSlug]);

  // Auto-play when audio is ready (unless muted)
  useEffect(() => {
    if (audioUrl && audioRef.current && !isMuted) {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [audioUrl, isMuted]);

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      if (!isMuted) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
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

          {/* Action Button (if provided) */}
          {onAction && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={onAction}
                size="lg"
                className="text-lg px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
              >
                Continue
              </Button>
            </div>
          )}
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

import { Loader2, Sparkles, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export type GenerationPhase = 
  | 'starting' 
  | 'generating' 
  | 'validating' 
  | 'retrying' 
  | 'finalizing'
  | 'complete' 
  | 'warning';

interface ImageGenerationProgressProps {
  phase: GenerationPhase;
  retryCount?: number;
  className?: string;
  estimatedTime?: number; // in seconds
}

const PHASE_MESSAGES: Record<GenerationPhase, string[]> = {
  starting: [
    "Preparing to create your companion...",
    "Gathering magical energy...",
    "Initiating the summoning ritual..."
  ],
  generating: [
    "Creating your companion's form...",
    "Weaving magical essence...",
    "Bringing your companion to life...",
    "Shaping the elemental energy..."
  ],
  validating: [
    "Perfecting the details...",
    "Ensuring magical accuracy...",
    "Checking the enchantment..."
  ],
  retrying: [
    "Refining the form...",
    "Adding final touches...",
    "Polishing the magic...",
    "Making adjustments..."
  ],
  finalizing: [
    "Almost there...",
    "Completing the transformation...",
    "Your companion is nearly ready..."
  ],
  complete: [
    "Your companion is ready!"
  ],
  warning: [
    "Your companion has been created with some variations."
  ]
};

const EXTENDED_TIME_MESSAGES = [
  "This is taking a bit longer than usual...",
  "Still working on perfecting your companion...",
  "Quality takes time - almost there...",
  "Your companion is being carefully crafted..."
];

export const ImageGenerationProgress = ({
  phase,
  retryCount = 0,
  className,
  estimatedTime
}: ImageGenerationProgressProps) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showExtendedMessage, setShowExtendedMessage] = useState(false);

  // Reset state when phase resets to starting
  useEffect(() => {
    if (phase === 'starting') {
      setMessageIndex(0);
      setElapsedTime(0);
      setShowExtendedMessage(false);
    }
  }, [phase]);

  // Rotate messages every 3 seconds
  useEffect(() => {
    const messages = PHASE_MESSAGES[phase];
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [phase]);

  // Track elapsed time
  useEffect(() => {
    if (phase === 'complete' || phase === 'warning') return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Show extended message after 15 seconds
  useEffect(() => {
    if (elapsedTime >= 15 && phase !== 'complete' && phase !== 'warning') {
      setShowExtendedMessage(true);
    }
  }, [elapsedTime, phase]);

  const messages = PHASE_MESSAGES[phase];
  const currentMessage = messages[messageIndex % messages.length];
  const extendedMessage = EXTENDED_TIME_MESSAGES[Math.floor(elapsedTime / 10) % EXTENDED_TIME_MESSAGES.length];

  const getIcon = () => {
    switch (phase) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'retrying':
        return <RefreshCw className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    }
  };

  const getProgressWidth = () => {
    switch (phase) {
      case 'starting': return '10%';
      case 'generating': return '40%';
      case 'validating': return '60%';
      case 'retrying': return `${60 + (retryCount * 15)}%`;
      case 'finalizing': return '90%';
      case 'complete':
      case 'warning':
        return '100%';
      default: return '0%';
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main progress indicator */}
      <div className="flex items-center gap-3">
        {getIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {showExtendedMessage && phase !== 'complete' && phase !== 'warning' 
              ? extendedMessage 
              : currentMessage}
          </p>
          {retryCount > 0 && phase === 'retrying' && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Attempt {retryCount + 1} of 3 - ensuring quality
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {phase !== 'complete' && phase !== 'warning' && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
            style={{ width: getProgressWidth() }}
          />
        </div>
      )}

      {/* Time estimate */}
      {estimatedTime && phase !== 'complete' && phase !== 'warning' && (
        <p className="text-xs text-muted-foreground text-center">
          {retryCount > 0 
            ? `Taking a bit longer to ensure quality (${Math.max(0, estimatedTime - elapsedTime)}s remaining)`
            : `Usually takes ${estimatedTime}-${estimatedTime + 10} seconds`}
        </p>
      )}

      {/* Sparkles decoration for complete state */}
      {phase === 'complete' && (
        <div className="flex justify-center">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        </div>
      )}
    </div>
  );
};

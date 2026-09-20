import { memo, useEffect, useState } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";

interface EvolveButtonProps {
  onEvolve: () => void;
  isEvolving: boolean;
  revealReady?: boolean;
  actionLabel?: string;
  loadingLabel?: string;
  durationLabel?: string;
}

const LONG_RUNNING_MESSAGE_DELAY_MS = 75_000;

export const EvolveButton = memo(({
  onEvolve,
  isEvolving,
  revealReady = false,
  actionLabel = "EVOLVE",
  loadingLabel = "EVOLVING...",
  durationLabel = "This can take a few minutes",
}: EvolveButtonProps) => {
  const { isEvolvingLoading } = useEvolution();
  // A persisted playable reveal takes precedence over late job/loading updates.
  const isProcessing = !revealReady && (isEvolving || isEvolvingLoading);
  const [showLongRunningMessage, setShowLongRunningMessage] = useState(false);

  useEffect(() => {
    if (!isProcessing) {
      setShowLongRunningMessage(false);
      return;
    }

    setShowLongRunningMessage(false);
    const timeoutId = window.setTimeout(() => {
      setShowLongRunningMessage(true);
    }, LONG_RUNNING_MESSAGE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isProcessing]);

  const handleClick = () => {
    if (!isProcessing) onEvolve();
  };

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing}
        aria-busy={isProcessing}
        data-tour="evolve-companion-button"
        data-tour-shape="rounded-rect"
        className="min-h-11 w-full rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProcessing ? loadingLabel : actionLabel}
      </button>
      {isProcessing && (
        <p role="status" className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          {showLongRunningMessage
            ? "Still preparing your video. You can leave and come back."
            : durationLabel}
        </p>
      )}
    </div>
  );
});

EvolveButton.displayName = 'EvolveButton';

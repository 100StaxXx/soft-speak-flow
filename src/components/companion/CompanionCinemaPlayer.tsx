import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { globalAudio } from "@/utils/globalAudio";
import { haptics } from "@/utils/haptics";
import {
  revealCompanionCinemaEvent,
  type CompanionCinemaReveal,
} from "@/services/companionCinemaInteractions";

export const CompanionCinemaPlayer = ({
  eventId,
  open,
  onOpenChange,
  onFinished,
}: {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: (reveal: CompanionCinemaReveal) => void;
}) => {
  const [reveal, setReveal] = useState<CompanionCinemaReveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => globalAudio.getMuted());
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    setReveal(null);
    setError(null);
    setStarted(false);
    setEnded(false);
    void revealCompanionCinemaEvent(eventId).then((result) => {
      if (cancelled) return;
      if (!result.ready || !result.videoUrl) {
        setError("The cinematic is still being finished.");
        return;
      }
      setReveal(result);
    }).catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Cinematic unavailable");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, open, retryKey]);

  useEffect(() => globalAudio.subscribe(setMuted), []);

  const beginCinematic = () => {
    const video = videoRef.current;
    if (!video) return;
    void globalAudio.ensureReady();
    haptics.medium();
    setStarted(true);
    void video.play().catch((reason) => {
      setStarted(false);
      setError(reason instanceof Error ? reason.message : "Tap again to begin");
    });
  };

  const finishCinematic = () => {
    setEnded(true);
    haptics.success();
    if (reveal) onFinished?.(reveal);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={reveal?.title ?? "Companion cinematic"}
    >
      {reveal?.videoUrl ? (
        <video
          ref={videoRef}
          src={reveal.videoUrl}
          playsInline
          muted={muted}
          preload="auto"
          onEnded={finishCinematic}
          onError={() => {
            setReveal(null);
            setStarted(false);
            setEnded(false);
            setError(
              "The cinematic could not be loaded. Refresh its secure link and try again.",
            );
          }}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-4 px-8 text-center text-white">
          {error ? (
            <>
              <p className="max-w-sm text-sm text-white/75">{error}</p>
              <Button variant="secondary" onClick={() => setRetryKey((value) => value + 1)}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-stardust-gold" />
              <p className="text-sm text-white/70">Preparing the cinematic…</p>
            </>
          )}
        </div>
      )}

      {reveal?.videoUrl && !started ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 px-6">
          <div className="space-y-3 text-center">
            <Button
              size="lg"
              className="rounded-full border border-stardust-gold/30 bg-stardust-gold px-8 text-black shadow-[0_0_48px_rgba(255,214,102,0.28)] hover:bg-stardust-gold/90"
              onClick={beginCinematic}
            >
              {muted ? "Begin cinematic" : "Begin with sound"}
            </Button>
            {error ? <p className="text-xs text-white/75">{error}</p> : null}
          </div>
        </div>
      ) : null}

      {reveal?.videoUrl && ended ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 px-6">
          <div className="max-w-md space-y-4 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stardust-gold">
              {reveal.reward?.type === "relic" ? "Relic recovered" : "Cinematic complete"}
            </p>
            <h3 className="text-3xl font-semibold">
              {reveal.reward?.title ?? reveal.title ?? "The moment is yours"}
            </h3>
            <p className="text-sm leading-relaxed text-white/75">
              {reveal.reward?.description ?? reveal.revealCopy}
            </p>
            <Button className="rounded-full px-8" onClick={() => onOpenChange(false)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stardust-gold/90">
          {reveal?.eventType ?? "Cosmiq"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          {reveal?.title ?? "Something has changed"}
        </h2>
        {reveal?.revealCopy ? (
          <p className="mt-2 max-w-lg text-sm text-white/75">{reveal.revealCopy}</p>
        ) : null}
      </div>

      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex gap-2">
        {reveal?.videoUrl ? (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-black/45 text-white hover:bg-black/65"
            onClick={() => globalAudio.setMuted(!muted)}
            aria-label={muted ? "Unmute cinematic" : "Mute cinematic"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-black/45 text-white hover:bg-black/65"
          onClick={() => onOpenChange(false)}
          aria-label="Close cinematic"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

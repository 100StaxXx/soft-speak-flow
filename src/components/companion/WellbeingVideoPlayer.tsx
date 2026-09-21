import { useEffect, useRef, useState } from "react";
import { companionVideoSeconds, type CompanionVideoCategory } from "@/shared/companionWellbeing";

export interface CompanionMomentClip {
  url: string;
  category: CompanionVideoCategory;
  sourceImageUrl: string;
  sceneImageUrl?: string;
}
export type PlaybackEndReason = "ended" | "failed" | "blocked" | "hidden";

/** Reveal only decoded video, over the still-visible portrait/habitat. Blend the
 * final quarter-second back to the exact scene anchor, never deform the image. */
export function WellbeingVideoPlayer({ clip, onClose, automatic = false }: {
  clip: CompanionMomentClip;
  onClose: (reason?: PlaybackEndReason) => void;
  automatic?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [settling, setSettling] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const finishRef = useRef(onClose);
  finishRef.current = onClose;
  const finished = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRequest = useRef<number | null>(null);
  const attempt = useRef(0);
  const duration = companionVideoSeconds(clip.category);
  const playbackEnd = useRef(duration);
  const stopWatchdog = () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };
  const finish = (reason: PlaybackEndReason) => {
    if (finished.current) return;
    finished.current = true;
    stopWatchdog();
    video.current?.pause();
    setVisible(false);
    finishRef.current(reason);
  };
  const watchPlayback = () => {
    stopWatchdog();
    watchdog.current = setTimeout(() => finish("failed"), 15_000);
  };
  const play = () => {
    const token = attempt.current;
    watchPlayback();
    void video.current?.play()?.catch(() => {
      if (finished.current || token !== attempt.current) return;
      stopWatchdog();
      if (automatic) finish("blocked");
      else setBlocked(true);
    });
  };
  useEffect(() => {
    attempt.current++;
    finished.current = false;
    setVisible(false); setSettling(false); setBlocked(false);
    play();
    const hide = () => { if (document.visibilityState === "hidden") finish("hidden"); };
    document.addEventListener("visibilitychange", hide);
    const element = video.current;
    return () => {
      attempt.current++; finished.current = true; stopWatchdog(); element?.pause();
      if (frameRequest.current !== null) element?.cancelVideoFrameCallback?.(frameRequest.current);
      document.removeEventListener("visibilitychange", hide);
    };
    // Each URL is mounted as a separate playback; callbacks must not restart it.
  }, [clip.url]);

  const trackFrame = () => {
    const element = video.current;
    if (!element || finished.current) return;
    const time = element.currentTime;
    if (time >= playbackEnd.current - 0.25) setSettling(true);
    if (time > duration + 0.5) { finish("ended"); return; }
    frameRequest.current = element.requestVideoFrameCallback?.(trackFrame) ?? null;
  };
  return <div className={`absolute inset-0 z-30 overflow-hidden rounded-2xl ${automatic ? "pointer-events-none" : ""}`} data-testid="wellbeing-video-player">
    {clip.sceneImageUrl && <img src={clip.sceneImageUrl} alt="" aria-hidden="true"
      onLoad={() => setSceneReady(true)}
      className="absolute inset-0 h-full w-full object-contain"
      style={{ opacity: sceneReady ? 1 : 0 }} />}
    <video ref={video} src={clip.url} muted playsInline preload="auto"
      aria-label={`${clip.category} companion moment`}
      className="relative h-full w-full object-contain transition-opacity duration-200"
      style={{ opacity: visible && !settling ? 1 : 0 }}
      onLoadedMetadata={() => {
        const actual = video.current?.duration;
        if (actual && Number.isFinite(actual)) {
          if (Math.abs(actual - duration) > 0.4) finish("failed");
          else playbackEnd.current = actual;
        }
      }}
      onPlaying={() => {
        if (finished.current) return;
        setBlocked(false); watchPlayback();
        const element = video.current;
        if (element?.requestVideoFrameCallback) {
          if (frameRequest.current !== null) element.cancelVideoFrameCallback(frameRequest.current);
          frameRequest.current = element.requestVideoFrameCallback(() => {
            if (!finished.current) { setVisible(true); trackFrame(); }
          });
        } else setVisible(true);
      }}
      onEnded={() => finish("ended")}
      onTimeUpdate={() => {
        if (finished.current) return;
        if ((video.current?.currentTime ?? 0) >= playbackEnd.current - 0.25) setSettling(true);
        if ((video.current?.currentTime ?? 0) > duration + 0.5) finish("ended");
        else if (!blocked) watchPlayback();
      }}
      onError={() => finish("failed")} />
    {blocked && !automatic ? <button type="button" className="absolute inset-0 text-white" onClick={play}>Play moment</button> : null}
  </div>;
}

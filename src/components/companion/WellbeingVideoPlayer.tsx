import { useEffect, useRef, useState } from "react";
import type { WellbeingPlayback } from "./CompanionWellbeing";

export function WellbeingVideoPlayer({ clip, onClose }: { clip: WellbeingPlayback; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopWatchdog = () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };
  const watchPlayback = () => {
    stopWatchdog();
    watchdog.current = setTimeout(() => {
      video.current?.pause();
      setFailed(true);
    }, 15_000);
  };
  useEffect(() => {
    let active = true;
    setBlocked(false);
    setFailed(false);
    watchPlayback();
    const play = video.current?.play();
    play?.catch(() => { if (active) { stopWatchdog(); setBlocked(true); } });
    const hide = () => { if (document.visibilityState === "hidden") { video.current?.pause(); onClose(); } };
    document.addEventListener("visibilitychange", hide);
    return () => { active = false; stopWatchdog(); video.current?.pause(); document.removeEventListener("visibilitychange", hide); };
  }, [onClose, clip.url]);
  return <div className="absolute inset-0 z-30 overflow-hidden rounded-2xl bg-black" data-testid="wellbeing-video-player">
    <video ref={video} src={clip.url} poster={clip.sourceImageUrl} muted playsInline preload="auto"
      aria-label={`${clip.category} companion moment`} className="h-full w-full object-contain"
      onEnded={() => { stopWatchdog(); onClose(); }} onTimeUpdate={() => {
        if (failed) return;
        if ((video.current?.currentTime ?? 0) >= 3) { stopWatchdog(); onClose(); }
        else if (!blocked) watchPlayback();
      }}
      onError={() => { stopWatchdog(); video.current?.pause(); setFailed(true); }} />
    {failed ? <p role="status" className="absolute inset-x-3 bottom-3 rounded bg-black/70 p-2 text-center text-xs text-white">Couldn’t play this moment. Please try again later.</p>
      : blocked ? <button type="button" className="absolute inset-0 text-white" onClick={() => {
        watchPlayback();
        void video.current?.play().then(() => setBlocked(false)).catch(() => { stopWatchdog(); setFailed(true); });
      }}>Play moment</button> : null}
    <button type="button" className="absolute right-2 top-2 min-h-11 rounded-full bg-black/50 px-3 text-xs text-white" onClick={onClose}>Close</button>
  </div>;
}

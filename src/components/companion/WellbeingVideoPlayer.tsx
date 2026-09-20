import { useEffect, useRef, useState } from "react";
import type { WellbeingPlayback } from "./CompanionWellbeing";

export function WellbeingVideoPlayer({ clip, onClose }: { clip: WellbeingPlayback; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const play = video.current?.play();
    play?.catch(() => { if (active) setBlocked(true); });
    const hide = () => { if (document.visibilityState === "hidden") { video.current?.pause(); onClose(); } };
    document.addEventListener("visibilitychange", hide);
    return () => { active = false; document.removeEventListener("visibilitychange", hide); };
  }, [onClose]);
  return <div className="absolute inset-0 z-30 overflow-hidden rounded-2xl bg-black" data-testid="wellbeing-video-player">
    <video ref={video} src={clip.url} poster={clip.sourceImageUrl} muted playsInline preload="auto"
      aria-label={`${clip.category} companion moment`} className="h-full w-full object-contain"
      onEnded={onClose} onTimeUpdate={() => { if ((video.current?.currentTime ?? 0) >= 3) onClose(); }}
      onError={() => setFailed(true)} />
    {failed ? <p role="status" className="absolute inset-x-3 bottom-3 rounded bg-black/70 p-2 text-center text-xs text-white">Couldn’t play this moment. Please try again later.</p>
      : blocked ? <button type="button" className="absolute inset-0 text-white" onClick={() => {
        void video.current?.play().then(() => setBlocked(false)).catch(() => setFailed(true));
      }}>Play moment</button> : null}
    <button type="button" className="absolute right-2 top-2 min-h-11 rounded-full bg-black/50 px-3 text-xs text-white" onClick={onClose}>Close</button>
  </div>;
}

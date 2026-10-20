import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { Companion } from "@/hooks/useCompanion";
import { getCompanionReactionAnimationUrl } from "@/config/gracewardMotion";
import { getCurrentVisualStageBoundaryLevel } from "@/config/progression";

export function AdventureCompanion({ companion, celebrate = false }: { companion?: Companion | null; celebrate?: boolean }) {
  const reducedMotion = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [videoFinished, setVideoFinished] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // The bundled reactions depict the Young form. Never replace a later form
  // or an unsupported species with a different creature just to show a video.
  const url = companion && companion.current_stage >= 1 && getCurrentVisualStageBoundaryLevel(companion.current_stage) === 1
    ? getCompanionReactionAnimationUrl({ species: companion.spirit_animal, element: companion.core_element, reaction: "celebrate" }) : null;
  const showVideo = Boolean(celebrate && url && !reducedMotion && !videoFinished);
  useEffect(() => { setVideoFinished(false); }, [celebrate, url]);
  useEffect(() => { setImageFailed(false); }, [companion?.current_image_url]);
  useEffect(() => {
    if (!showVideo) return;
    const element = video.current;
    void element?.play()?.catch(() => setVideoFinished(true));
    const timeout = window.setTimeout(() => setVideoFinished(true), 12000);
    const pauseWhenHidden = () => { if (document.hidden) { element?.pause(); setVideoFinished(true); } };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => { window.clearTimeout(timeout); element?.pause(); document.removeEventListener("visibilitychange", pauseWhenHidden); };
  }, [showVideo]);
  return <motion.div className={`gw-companion ${celebrate ? "gw-companion-celebrating" : ""}`}
    animate={celebrate && !reducedMotion ? { scale: [1, 1.07, 1], rotate: [0, -3, 3, 0] } : { scale: 1, rotate: 0 }}
    transition={{ duration: 0.7 }}>
    {showVideo ? <video ref={video} src={url!} muted playsInline preload="metadata" aria-label="Your companion celebrates"
      onEnded={() => setVideoFinished(true)} onError={() => setVideoFinished(true)} />
      : companion?.current_image_url && !imageFailed ? <img src={companion.current_image_url} alt={companion.companion_name || "Your faith companion"} onError={() => setImageFailed(true)} />
      : <div className="gw-companion-placeholder"><Sparkles size={48} /><span>Your adventure awaits</span></div>}
    {celebrate && !reducedMotion && <div className="gw-reward-sparkles" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>}
  </motion.div>;
}

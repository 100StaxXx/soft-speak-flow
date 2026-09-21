import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentVisualStageBoundaryLevel } from "@/config/progression";
import { IDLE_VIDEO_CATEGORIES, WELLBEING_PROMPT_VERSION, type IdleVideoCategory } from "@/shared/companionWellbeing";
import { requestWellbeingClip } from "@/services/companionWellbeingVideo";
import { WellbeingVideoPlayer, type PlaybackEndReason } from "./WellbeingVideoPlayer";

interface Props { companionId: string; stage: number; sourceImageUrl: string; active: boolean }
export function CompanionIdleVideos(props: Props) {
  const { user } = useAuth();
  const stage = getCurrentVisualStageBoundaryLevel(props.stage);
  return <IdleRotation key={`${user?.id}:${props.companionId}:${stage}:${props.sourceImageUrl}`}
    {...props} stage={stage} userId={user?.id} />;
}

function IdleRotation({ companionId, stage, sourceImageUrl, active, userId }: Props & { userId?: string }) {
  const [pageVisible, setPageVisible] = useState(document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const canPlay = active && pageVisible;
  const [index, setIndex] = useState(0);
  const [category, setCategory] = useState<IdleVideoCategory | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const { data } = useQuery({
    queryKey: ["companion-idle-clips", WELLBEING_PROMPT_VERSION, userId, companionId, stage, sourceImageUrl],
    enabled: Boolean(userId && stage > 0 && sourceImageUrl && canPlay),
    queryFn: async () => Promise.all(IDLE_VIDEO_CATEGORIES.map(async (category) => ({ category,
      clip: await requestWellbeingClip({ action: "status", companionId, stage, sourceImageUrl, category }),
    }))),
    // Read-only: the global preparer owns automatic enqueueing.
    staleTime: 20_000, gcTime: 5 * 60_000, retry: false,
    refetchInterval: (query) => canPlay && !query.state.error &&
      !query.state.data?.every(({ clip }) => ["succeeded", "failed"].includes(clip.status)) ? 20_000 : false,
    refetchIntervalInBackground: false,
  });
  const available = (data ?? []).filter(({ clip }) => clip.status === "succeeded" && clip.video_url
    && clip.scene_image_url && clip.prompt_version === WELLBEING_PROMPT_VERSION && !failed.includes(clip.video_url));
  // Newly completed jobs must not change the clip already playing mid-motion.
  const current = available.find((item) => item.category === category) ?? available[0];
  const currentIndex = available.findIndex((item) => item.category === current?.category);
  const next = available[(currentIndex + 1) % (available.length || 1)];
  const ended = useCallback((reason?: PlaybackEndReason) => {
    if (reason === "blocked") setBlocked(true);
    if (reason === "failed" && current?.clip.video_url) setFailed((previous) => [...previous, current.clip.video_url!]);
    setWaiting(true);
  }, [current?.clip.video_url]);
  useEffect(() => {
    if (!waiting || !canPlay) return;
    const timer = setTimeout(() => {
      setCategory(next?.category ?? null);
      setIndex((previous) => previous + 1); setWaiting(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, [waiting, canPlay, next?.category]);
  if (!canPlay || !userId || !current) return null;
  return <div className="pointer-events-none absolute inset-0 z-10" data-testid="companion-idle-videos">
    <img src={current.clip.scene_image_url!} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain" />
    {!blocked && !waiting ? <WellbeingVideoPlayer key={`${current.clip.video_url}:${index}`} automatic
      clip={{ url: current.clip.video_url!, category: current.category, sourceImageUrl, sceneImageUrl: current.clip.scene_image_url! }} onClose={ended} /> : null}
    {!blocked && next && next.clip.video_url !== current.clip.video_url ? <video aria-hidden="true" tabIndex={-1}
      src={next.clip.video_url!} muted playsInline preload="auto" className="absolute h-px w-px opacity-0 pointer-events-none" /> : null}
  </div>;
}

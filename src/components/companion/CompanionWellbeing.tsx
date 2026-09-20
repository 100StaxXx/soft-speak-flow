import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Heart, Leaf, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentVisualStageBoundaryLevel } from "@/config/progression";
import { WELLBEING_CATEGORIES, WELLBEING_OPTIONS, type WellbeingCategory } from "@/shared/companionWellbeing";

export interface WellbeingPlayback { url: string; category: WellbeingCategory; sourceImageUrl: string }
interface Clip { status: "queued" | "submitting" | "processing" | "succeeded" | "failed"; video_url: string | null; can_retry?: boolean }
interface Props {
  companionId: string;
  currentStage: number;
  sourceImageUrl: string;
  isVisible: boolean;
  prefersReducedMotion: boolean;
  onPlay: (clip: WellbeingPlayback) => void;
}
const icons = { mind: Brain, body: Heart, soul: Leaf };

/** Intentional, optional moments. No automatic task creation, XP, streak, or replay on resume. */
export function CompanionWellbeing(props: Props) {
  const { user } = useAuth();
  const stage = getCurrentVisualStageBoundaryLevel(props.currentStage);
  const identity = `${user?.id}:${props.companionId}:${stage}:${props.sourceImageUrl}`;
  // Remount inner state on an account, claimed form, or portrait change.
  return <WellbeingSelection key={identity} {...props} currentStage={stage} signedIn={Boolean(user)} />;
}

function WellbeingSelection({ companionId, currentStage, sourceImageUrl, isVisible, prefersReducedMotion, signedIn, onPlay }: Props & { signedIn: boolean }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<WellbeingCategory | null>(null);
  const [clips, setClips] = useState<Partial<Record<WellbeingCategory, Clip>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const request = useRef(0);
  const mounted = useRef(true);
  const visible = useRef(isVisible);
  visible.current = isVisible;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; }; }, []);
  useEffect(() => { if (!isVisible) { request.current++; setLoading(false); } }, [isVisible]);

  async function load(category: WellbeingCategory, action: "prepare" | "status" | "retry") {
    const { data, error: invokeError } = await supabase.functions.invoke("companion-wellbeing-video", {
      body: { action, companionId, category, stage: currentStage, sourceImageUrl },
      timeout: 20000,
    });
    if (invokeError || data?.error) throw new Error("Couldn't load this animation. You can still choose an activity.");
    return (data?.clip ?? null) as Clip | null;
  }

  const select = async (category: WellbeingCategory, retry = false) => {
    const sequence = ++request.current;
    setSelected(category); setError(null); setSlow(false);
    setPollAttempt((attempt) => attempt + 1);
    const cached = clips[category];
    if (cached?.status === "succeeded" && cached.video_url) {
      setLoading(false);
      if (!prefersReducedMotion && document.visibilityState !== "hidden") onPlay({ url: cached.video_url, category, sourceImageUrl });
      return;
    }
    setLoading(true);
    try {
      const clip = await load(category, retry ? "retry" : "prepare");
      if (!mounted.current || sequence !== request.current || !visible.current) return;
      if (clip) setClips((previous) => ({ ...previous, [category]: clip }));
      if (clip?.status === "succeeded" && clip.video_url && !prefersReducedMotion && document.visibilityState !== "hidden") onPlay({ url: clip.video_url, category, sourceImageUrl });
    } catch (cause) {
      if (mounted.current && sequence === request.current) setError((cause as Error).message);
    } finally {
      if (mounted.current && sequence === request.current) setLoading(false);
    }
  };

  const clip = selected ? clips[selected] : null;
  const pending = clip && ["queued", "submitting", "processing"].includes(clip.status);
  useEffect(() => {
    if (!selected || !pending || !isVisible) return;
    let cancelled = false;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (cancelled) return;
      if (Date.now() - started > 3 * 60_000) { setSlow(true); return; }
      if (document.visibilityState !== "hidden") {
        try {
          const next = await load(selected!, "status");
          if (!cancelled && next) {
            setClips((previous) => ({ ...previous, [selected!]: next }));
            if (next.status === "succeeded" || next.status === "failed") return;
          }
        } catch { /* Transient offline state must not trigger another paid generation. */ }
      }
      timer = setTimeout(poll, 8000);
    }
    timer = setTimeout(poll, 8000);
    return () => { cancelled = true; clearTimeout(timer); };
    // Selection and appearance define the request; polling does not automatically play a result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pending, isVisible, companionId, currentStage, sourceImageUrl, pollAttempt]);

  if (!signedIn || currentStage < 1) return null;
  const option = selected ? WELLBEING_OPTIONS[selected] : null;
  return <section aria-label="Mind Body Soul" className="mt-4 w-full max-w-md text-sm">
    <div className="flex items-center justify-center gap-1" aria-label="Choose a moment">
      {WELLBEING_CATEGORIES.map((category) => {
        const Icon = icons[category];
        return <button key={category} type="button" aria-pressed={selected === category}
          onClick={() => void select(category)} disabled={!isVisible}
          className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 sm:px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected === category ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />{WELLBEING_OPTIONS[category].label}
        </button>;
      })}
    </div>
    {option && selected ? <div className="mt-2 rounded-2xl bg-black/20 p-4" aria-label={`${option.label} ideas`}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-muted-foreground">{option.description} Only if it feels right.</p>
        <button type="button" aria-label="Close ideas" className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full"
          onClick={() => { request.current++; setSelected(null); setLoading(false); }}><X className="h-4 w-4" /></button>
      </div>
      <ul className="mt-2 space-y-1">{option.suggestions.map((idea) => <li key={idea.title}>
        <button type="button" className="min-h-11 w-full rounded-lg py-2 text-left hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Plan: ${idea.title}`} onClick={() => navigate("/journeys", { state: { journeysCreateQuestRequest: {
            id: crypto.randomUUID(), prefill: { title: idea.title, durationMinutes: idea.minutes, category: selected },
          } } })}>
          <span className="block">{idea.title}</span><span className="block text-xs text-muted-foreground">{idea.minutes} min · Plan</span>
        </button>
      </li>)}</ul>
      <div className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {loading ? <p>Loading your companion moment…</p> : error ? <p>{error} <button type="button" className="min-h-11 underline" onClick={() => void select(selected)}>Try again</button></p>
          : clip?.status === "failed" ? <p>This animation is unavailable for now. Your activities are still here.
            {clip.can_retry ? <button type="button" className="ml-2 min-h-11 underline" onClick={() => void select(selected, true)}>Try animation again</button> : null}</p>
          : pending ? <p>{slow ? "This is taking longer than expected. You can leave and check back later." : "Preparing this form’s first video. You can keep using the app."}</p>
          : null}
        {slow && pending ? <button type="button" className="min-h-11 underline" onClick={() => void select(selected)}>Check again</button> : null}
        {clip?.status === "succeeded" && clip.video_url ? <button type="button" className="min-h-11 underline underline-offset-4"
          onClick={() => onPlay({ url: clip.video_url!, category: selected, sourceImageUrl })}>Play companion moment</button> : null}
      </div>
    </div> : null}
  </section>;
}

import { Film, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useCompanionCinema } from "@/hooks/useCompanionCinema";
import { cn } from "@/lib/utils";

export const CompanionCinemaStatus = ({
  companionId,
  className,
}: {
  companionId: string;
  className?: string;
}) => {
  const reducedMotion = useReducedMotion();
  const { nextEvolution } = useCompanionCinema(companionId);
  if (!nextEvolution || nextEvolution.status === "failed") return null;

  const ready = nextEvolution.status === "ready";
  const copy = ready
    ? "Something has changed. Your next form is waiting for the moment you earn it."
    : nextEvolution.status === "rendering_video"
    ? "Your next form has emerged. Its cinematic is being finished now."
    : "Your companion’s next form is taking shape in the background.";

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-stardust-gold/25 bg-[linear-gradient(135deg,rgba(55,42,16,0.48),rgba(20,16,40,0.58))] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.2)]",
        className,
      )}
      data-testid="companion-cinema-status"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,214,102,0.15),transparent_42%)]" />
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-stardust-gold/25 bg-stardust-gold/10 p-2 text-stardust-gold">
          {ready ? <Sparkles className="h-4 w-4" /> : <Film className="h-4 w-4" />}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stardust-gold/80">
            {ready ? "Cinematic ready" : "In the making"}
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">{copy}</p>
          {nextEvolution.boundary_level ? (
            <p className="text-xs text-muted-foreground">
              Level {nextEvolution.boundary_level} evolution
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

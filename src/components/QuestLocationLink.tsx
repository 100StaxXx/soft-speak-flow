import { ExternalLink, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { openQuestLocation, normalizeQuestLocationQuery } from "@/utils/questLocationLinks";

interface QuestLocationLinkProps {
  location: string | null | undefined;
  className?: string;
  label?: string;
  textClassName?: string;
}

export function QuestLocationLink({
  location,
  className,
  label = "Location",
  textClassName,
}: QuestLocationLinkProps) {
  const normalizedLocation = normalizeQuestLocationQuery(location);
  if (!normalizedLocation) return null;

  return (
    <button
      type="button"
      onClick={() => {
        openQuestLocation(normalizedLocation);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.07]",
        className,
      )}
      aria-label={`Open ${normalizedLocation} in maps`}
    >
      <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.06] p-2">
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
          <span>{label}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </div>
        <p className={cn("text-sm leading-relaxed text-foreground whitespace-pre-line break-words", textClassName)}>
          {normalizedLocation}
        </p>
      </div>
    </button>
  );
}

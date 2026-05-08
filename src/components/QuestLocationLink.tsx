import type { MouseEvent, TouchEvent } from "react";
import { ExternalLink, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  QUEST_MAP_PROVIDERS,
  type QuestMapProvider,
  openQuestLocation,
  normalizeQuestLocationQuery,
} from "@/utils/questLocationLinks";

interface QuestLocationLinkProps {
  location: string | null | undefined;
  className?: string;
  label?: string;
  textClassName?: string;
  actionsClassName?: string;
}

const PROVIDER_LABELS: Record<QuestMapProvider, string> = {
  apple: "Apple Maps",
  google: "Google Maps",
};

const stopMapActionPropagation = (
  event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>,
) => {
  event.stopPropagation();
};

export function QuestLocationLink({
  location,
  className,
  label = "Location",
  textClassName,
  actionsClassName,
}: QuestLocationLinkProps) {
  const normalizedLocation = normalizeQuestLocationQuery(location);
  if (!normalizedLocation) return null;

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-left",
        className,
      )}
    >
      <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.06] p-2">
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
          <span>{label}</span>
        </div>
        <p className={cn("text-sm leading-relaxed text-foreground whitespace-pre-line break-words", textClassName)}>
          {normalizedLocation}
        </p>
        <div className={cn("mt-3 flex flex-wrap gap-2", actionsClassName)}>
          {QUEST_MAP_PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openQuestLocation(normalizedLocation, provider);
              }}
              onTouchEnd={stopMapActionPropagation}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={`Open ${normalizedLocation} in ${PROVIDER_LABELS[provider]}`}
            >
              <ExternalLink className="h-3 w-3" />
              {PROVIDER_LABELS[provider]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

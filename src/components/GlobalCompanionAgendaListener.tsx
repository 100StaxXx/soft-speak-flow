import { useEffect } from "react";

import { PRODUCT } from "@/config/product";
import { useCompanionMotion } from "@/contexts/CompanionMotionContext";
import { listenForCompanionAgendaEvents } from "@/lib/companionAgendaEvents";

const MOTION_TYPE_BY_AGENDA_EVENT = {
  ambient: "idle",
  "task-start": "task_start",
  "task-complete": "quest_complete",
  encourage: "xp_gain",
  "welcome-back": "wake",
  milestone: "streak",
} as const;

export const GlobalCompanionAgendaListener = () => {
  const { triggerEvent } = useCompanionMotion();

  useEffect(() => {
    if (PRODUCT.mode !== "cosmiq") return;

    return listenForCompanionAgendaEvents((detail) => {
      triggerEvent({
        type: MOTION_TYPE_BY_AGENDA_EVENT[detail.eventType],
        intensity: detail.eventType === "milestone" ? "heroic" : "medium",
        reason: [
          "cosmiq-agenda",
          detail.eventType,
          detail.category?.toLowerCase(),
          detail.id,
        ].filter(Boolean).join(":"),
      });
    });
  }, [triggerEvent]);

  return null;
};

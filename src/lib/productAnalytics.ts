import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { safeSessionStorage } from "@/utils/storage";

export type ProductExperienceEventName =
  | "app_opened"
  | "next_day_return"
  | "encouragement_opened"
  | "encouragement_completed"
  | "focus_selected"
  | "guide_chat_started"
  | "practice_completed"
  | "companion_response_viewed"
  | "companion_question_answered"
  | "evening_reflection_completed"
  | "feedback_prompt_viewed"
  | "feedback_prompt_opened"
  | "feedback_prompt_dismissed"
  | "memory_preference_changed"
  | "companion_interacted";

type EventProperty = string | number | boolean | null;
type EventProperties = Record<string, EventProperty | undefined>;

const SESSION_STORAGE_KEY = "graceward:experience-session:v1";
const SENSITIVE_PROPERTY_KEY = /content|description|email|label|message|name|note|prompt|reflection|text|title/i;
const log = logger.scope("ProductExperience");

const getSessionId = (): string => {
  const existing = safeSessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  safeSessionStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
};

export const sanitizeProductEventProperties = (
  properties: EventProperties = {},
): Record<string, EventProperty> => {
  const safe: Record<string, EventProperty> = {};
  Object.entries(properties).slice(0, 16).forEach(([key, value]) => {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || SENSITIVE_PROPERTY_KEY.test(key)) return;
    if (value === undefined) return;
    if (typeof value === "string") {
      safe[key] = value.slice(0, 80);
      return;
    }
    if (typeof value === "number" && !Number.isFinite(value)) return;
    safe[key] = value;
  });
  return safe;
};

export async function trackProductExperience(
  eventName: ProductExperienceEventName,
  {
    surface,
    properties,
  }: {
    surface: string;
    properties?: EventProperties;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("product_experience_events").insert({
      event_name: eventName,
      surface: surface.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40),
      session_id: getSessionId(),
      properties: sanitizeProductEventProperties(properties),
      occurred_at: new Date().toISOString(),
    });

    if (error) {
      log.debug("Experience event was not recorded", { eventName, code: error.code });
    }
  } catch (error) {
    log.debug("Experience event recording is unavailable", {
      eventName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

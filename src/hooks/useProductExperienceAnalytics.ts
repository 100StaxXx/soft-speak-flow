import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { trackProductExperience } from "@/lib/productAnalytics";
import { safeLocalStorage, safeSessionStorage } from "@/utils/storage";
import { getEffectiveDailyDate } from "@/utils/timezone";

const LAST_OPEN_PREFIX = "graceward:experience:last-open";
const OPENED_SESSION_PREFIX = "graceward:experience:opened-session";

const dayDistance = (previous: string, current: string): number => {
  const previousMs = Date.parse(`${previous}T12:00:00Z`);
  const currentMs = Date.parse(`${current}T12:00:00Z`);
  if (!Number.isFinite(previousMs) || !Number.isFinite(currentMs)) return 0;
  return Math.max(0, Math.round((currentMs - previousMs) / 86_400_000));
};

export const useProductExperienceAnalytics = () => {
  const { user } = useAuth();
  const { profile } = useProfile();

  useEffect(() => {
    if (!user?.id) return;

    const today = getEffectiveDailyDate(profile?.timezone ?? undefined);
    const sessionKey = `${OPENED_SESSION_PREFIX}:${user.id}:${today}`;
    if (safeSessionStorage.getItem(sessionKey)) return;

    safeSessionStorage.setItem(sessionKey, new Date().toISOString());
    const lastOpenKey = `${LAST_OPEN_PREFIX}:${user.id}`;
    const previousOpen = safeLocalStorage.getItem(lastOpenKey);
    const daysAway = previousOpen ? dayDistance(previousOpen, today) : 0;

    void trackProductExperience("app_opened", {
      surface: "app",
      properties: { returning: Boolean(previousOpen) },
    });
    if (daysAway >= 1) {
      void trackProductExperience("next_day_return", {
        surface: "app",
        properties: { days_away: Math.min(daysAway, 90) },
      });
    }

    safeLocalStorage.setItem(lastOpenKey, today);
  }, [profile?.timezone, user?.id]);
};

export const ProductExperienceAnalyticsBridge = () => {
  useProductExperienceAnalytics();
  return null;
};

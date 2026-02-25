import type { NotificationType } from "./notificationsV2.ts";

export interface CompanionNotificationContext {
  cachedCreatureName?: string | null;
  spiritAnimal?: string | null;
  currentMood?: string | null;
  inactiveDays?: number | null;
}

export interface NotificationCopy {
  title: string;
  body: string;
}

export interface NotificationComposeInput {
  type: NotificationType;
  payload?: Record<string, unknown>;
  companion?: CompanionNotificationContext | null;
}

function getCompanionName(companion?: CompanionNotificationContext | null): string {
  const explicitName = companion?.cachedCreatureName?.trim();
  if (explicitName) return explicitName;

  const species = companion?.spiritAnimal?.trim();
  if (species) return species;

  return "Your companion";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatLeadMinutes(minutesBefore: number): string {
  if (minutesBefore >= 1440) {
    const days = Math.floor(minutesBefore / 1440);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (minutesBefore >= 60) {
    const hours = Math.floor(minutesBefore / 60);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutesBefore} minute${minutesBefore === 1 ? "" : "s"}`;
}

export function composeNotificationCopy(input: NotificationComposeInput): NotificationCopy {
  const payload = input.payload ?? {};

  switch (input.type) {
    case "daily_pep": {
      const companionName = getCompanionName(input.companion);
      const summary = asString(payload.summary, "Your daily pep talk is ready.");
      return {
        title: `${companionName} has a message for you`,
        body: summary,
      };
    }

    case "mentor_nudge": {
      const companionName = getCompanionName(input.companion);
      const message = asString(payload.message, "Your mentor left you a quick nudge.");
      return {
        title: `${companionName} is checking in`,
        body: message,
      };
    }

    case "task_start": {
      const taskText = asString(payload.task_text, "Your quest");
      const xpReward = asNumber(payload.xp_reward, 0);
      return {
        title: "Quest starting now",
        body: xpReward > 0 ? `${taskText} (+${xpReward} XP)` : taskText,
      };
    }

    case "task_reminder": {
      const taskText = asString(payload.task_text, "Your quest");
      const xpReward = asNumber(payload.xp_reward, 0);
      const leadMinutes = asNumber(payload.reminder_minutes_before, 15);
      const leadLabel = formatLeadMinutes(leadMinutes);
      return {
        title: "Quest reminder",
        body: xpReward > 0
          ? `${taskText} starts in ${leadLabel} (+${xpReward} XP)`
          : `${taskText} starts in ${leadLabel}`,
      };
    }

    case "habit_reminder": {
      const title = asString(payload.habit_title, "your habit");
      return {
        title: "Habit reminder",
        body: `Time to work on ${title}.`,
      };
    }

    case "contact_reminder": {
      const name = asString(payload.contact_name, "someone important");
      const reason = asString(payload.reason, "").trim();
      return {
        title: "Time to reach out",
        body: reason ? `Connect with ${name}: ${reason}` : `It could be a good moment to reach out to ${name}.`,
      };
    }

    case "checkin_morning_reminder": {
      return {
        title: "Morning check-in reminder",
        body: "Take 60 seconds to set your intention for today.",
      };
    }

    case "checkin_evening_reminder": {
      return {
        title: "Evening reflection reminder",
        body: "Close the day with a quick reflection and one gratitude.",
      };
    }

    default:
      return {
        title: "Notification",
        body: "You have an update waiting.",
      };
  }
}

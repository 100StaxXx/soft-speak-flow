export interface PushNotificationNavigationDetail {
  url: string;
  queueId?: string | null;
}

const INTERNAL_PATH_PATTERN = /^\/(?!\/)/;

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const normalizeInternalPath = (value: string | null | undefined): string | null => {
  if (!value || !INTERNAL_PATH_PATTERN.test(value)) return null;

  try {
    const parsed = new URL(value, "https://app.cosmiq.quest");
    if (parsed.origin !== "https://app.cosmiq.quest") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const appendTaskId = (path: string, taskId: string | null): string => {
  if (!taskId) return path;
  const parsed = new URL(path, "https://app.cosmiq.quest");
  parsed.searchParams.set("taskId", taskId);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export function resolvePushNotificationDestination(
  payloadInput: unknown,
  notificationType?: string | null,
): string {
  const payload = readRecord(payloadInput) ?? {};
  const taskId = readString(payload.task_id) ?? readString(payload.taskId);
  const type = readString(payload.type) ?? notificationType ?? null;
  const rawUrl = readString(payload.url);
  const deepLink = readString(payload.deepLink);

  if (deepLink?.startsWith("cosmiq://task/")) {
    const deepTaskId = deepLink.replace("cosmiq://task/", "").split("?")[0]?.trim();
    return appendTaskId("/journeys", deepTaskId || taskId);
  }

  if (deepLink === "cosmiq://journeys/plan") {
    return "/journeys";
  }

  const safeUrl = normalizeInternalPath(rawUrl);
  if (safeUrl) {
    if (safeUrl === "/tasks" || safeUrl.startsWith("/tasks?")) {
      return appendTaskId("/journeys", taskId);
    }
    if (safeUrl === "/inbox" || safeUrl.startsWith("/inbox?")) {
      return "/journeys?section=inbox";
    }
    if (safeUrl === "/inspire" || safeUrl.startsWith("/inspire?")) {
      return "/pep-talks";
    }
    if (safeUrl === "/journeys" || safeUrl.startsWith("/journeys?")) {
      return appendTaskId(safeUrl, taskId);
    }
    return safeUrl;
  }

  if (taskId) {
    return appendTaskId("/journeys", taskId);
  }

  switch (type) {
    case "daily_pep":
      return "/pep-talks";
    case "daily_quote":
      return "/mentor";
    case "mentor_nudge":
      return "/companion";
    case "habit_reminder":
    case "task_start":
    case "task_reminder":
    case "plan_day_overdue":
      return "/journeys";
    case "checkin_evening_reminder":
      return "/mentor?open=evening-reflection";
    case "checkin_morning_reminder":
      return "/mentor";
    default:
      return "/mentor";
  }
}

export function getPushNotificationQueueId(payloadInput: unknown): string | null {
  const payload = readRecord(payloadInput);
  if (!payload) return null;
  return readString(payload.queue_id) ?? readString(payload.notification_id);
}

export function buildPushNotificationNavigationDetail(
  payloadInput: unknown,
  notificationType?: string | null,
): PushNotificationNavigationDetail {
  return {
    url: resolvePushNotificationDestination(payloadInput, notificationType),
    queueId: getPushNotificationQueueId(payloadInput),
  };
}

export function normalizePushNotificationNavigationDetail(
  value: unknown,
): PushNotificationNavigationDetail | null {
  if (typeof value === "string") {
    return { url: resolvePushNotificationDestination({ url: value }) };
  }

  const detail = readRecord(value);
  if (!detail) return null;

  const url = readString(detail.url);
  if (!url) return null;

  return {
    url: resolvePushNotificationDestination({ url }),
    queueId: readString(detail.queueId),
  };
}

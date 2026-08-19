import { PRODUCT, type ProductMode } from "@/config/product";
import { getProductRuntimeIdentity } from "@/config/productRuntime";

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

const normalizeInternalPath = (
  value: string | null | undefined,
  productMode: ProductMode,
): string | null => {
  if (
    !value ||
    (!INTERNAL_PATH_PATTERN.test(value) && !value.startsWith("https://"))
  ) {
    return null;
  }

  try {
    const runtime = getProductRuntimeIdentity(productMode);
    const parsed = new URL(value, runtime.primaryWebOrigin);
    if (!runtime.webOrigins.includes(parsed.origin)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export function resolvePushNotificationDestination(
  payloadInput: unknown,
  notificationType?: string | null,
  productMode: ProductMode = PRODUCT.mode,
): string {
  const runtime = getProductRuntimeIdentity(productMode);
  const payload = readRecord(payloadInput) ?? {};
  const taskId = readString(payload.task_id) ?? readString(payload.taskId);
  const dailyEncouragementId = readString(payload.pep_talk_id) ?? readString(payload.pepTalkId);
  const type = readString(payload.type) ?? notificationType ?? null;
  const rawUrl = readString(payload.url);
  const deepLink = readString(payload.deepLink);

  if (deepLink?.startsWith(`${runtime.nativeScheme}://task/`)) {
    return "/mentor";
  }

  if (
    runtime.authProductMode === "cosmiq" &&
    deepLink === `${runtime.nativeScheme}://journeys/plan`
  ) {
    return "/journeys";
  }

  const safeUrl = normalizeInternalPath(rawUrl, productMode);
  if (safeUrl) {
    if (safeUrl === "/tasks" || safeUrl.startsWith("/tasks?")) {
      return "/mentor";
    }
    if (safeUrl === "/inbox" || safeUrl.startsWith("/inbox?")) {
      return "/mentor";
    }
    if (safeUrl === "/inspire" || safeUrl.startsWith("/inspire?")) {
      return "/pep-talks";
    }
    if (safeUrl === "/journeys" || safeUrl.startsWith("/journeys?")) {
      return safeUrl;
    }
    return safeUrl;
  }

  if (taskId) {
    return "/mentor";
  }

  if (type === "daily_pep" && dailyEncouragementId) {
    return `/pep-talk/${encodeURIComponent(dailyEncouragementId)}`;
  }

  switch (type) {
    case "daily_pep":
      return "/mentor#daily-encouragement";
    case "daily_quote":
      return "/mentor";
    case "mentor_nudge":
      return "/guide";
    case "habit_reminder":
    case "task_start":
    case "task_reminder":
    case "plan_day_overdue":
      return "/mentor";
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

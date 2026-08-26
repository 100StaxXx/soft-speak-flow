import type {
  CosmiqAgendaCategory,
  CosmiqAgendaEventType,
} from "@/config/cosmiqAgendaMotion";
import { productScopedStorageKey } from "@/config/productRuntime";

export const COMPANION_AGENDA_EVENT = productScopedStorageKey(
  "companion-agenda-event",
);
const COMPANION_AGENDA_PENDING_STORAGE_KEY = productScopedStorageKey(
  "pending-companion-agenda-event",
);

export interface CompanionAgendaEventDetail {
  id: string;
  eventType: CosmiqAgendaEventType;
  category: CosmiqAgendaCategory | null;
  taskId: string | null;
  taskTitle: string | null;
  occurredAt: number;
  seed: string;
}

export interface DispatchCompanionAgendaEventInput {
  eventType: CosmiqAgendaEventType;
  category?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  seed?: string;
}

export const normalizeCompanionAgendaCategory = (
  value: string | null | undefined,
): CosmiqAgendaCategory | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "mind") return "Mind";
  if (normalized === "body") return "Body";
  if (normalized === "soul") return "Soul";
  return null;
};

const createEventId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `agenda-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const dispatchCompanionAgendaEvent = (
  input: DispatchCompanionAgendaEventInput,
): CompanionAgendaEventDetail | null => {
  if (typeof window === "undefined") return null;

  const occurredAt = Date.now();
  const normalizedCategory = normalizeCompanionAgendaCategory(input.category);
  const category = input.eventType === "task-start" || input.eventType === "task-complete"
    ? normalizedCategory ?? "Mind"
    : null;
  const detail: CompanionAgendaEventDetail = {
    id: createEventId(),
    eventType: input.eventType,
    category,
    taskId: input.taskId?.trim() || null,
    taskTitle: input.taskTitle?.trim() || null,
    occurredAt,
    seed: input.seed?.trim()
      || `${input.taskId?.trim() || "agenda"}:${new Date(occurredAt).toISOString().slice(0, 10)}`,
  };

  window.dispatchEvent(new CustomEvent<CompanionAgendaEventDetail>(
    COMPANION_AGENDA_EVENT,
    { detail },
  ));
  try {
    window.sessionStorage.setItem(
      COMPANION_AGENDA_PENDING_STORAGE_KEY,
      JSON.stringify(detail),
    );
  } catch {
    // A live event still works when storage is unavailable.
  }
  return detail;
};

export const getPendingCompanionAgendaEvent = ({
  maxAgeMs = 120_000,
}: {
  maxAgeMs?: number;
} = {}): CompanionAgendaEventDetail | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(COMPANION_AGENDA_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const detail = JSON.parse(raw) as CompanionAgendaEventDetail;
    if (!detail?.id || Date.now() - detail.occurredAt > maxAgeMs) {
      window.sessionStorage.removeItem(COMPANION_AGENDA_PENDING_STORAGE_KEY);
      return null;
    }
    return detail;
  } catch {
    return null;
  }
};

export const clearPendingCompanionAgendaEvent = (eventId?: string): void => {
  if (typeof window === "undefined") return;
  try {
    if (eventId) {
      const pending = getPendingCompanionAgendaEvent({ maxAgeMs: Number.POSITIVE_INFINITY });
      if (pending?.id !== eventId) return;
    }
    window.sessionStorage.removeItem(COMPANION_AGENDA_PENDING_STORAGE_KEY);
  } catch {
    // Storage cleanup is best effort.
  }
};

export const listenForCompanionAgendaEvents = (
  listener: (detail: CompanionAgendaEventDetail) => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<CompanionAgendaEventDetail>).detail);
  };
  window.addEventListener(COMPANION_AGENDA_EVENT, handleEvent);
  return () => window.removeEventListener(COMPANION_AGENDA_EVENT, handleEvent);
};

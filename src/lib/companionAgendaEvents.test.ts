import { describe, expect, it, vi } from "vitest";
import {
  COMPANION_AGENDA_EVENT,
  dispatchCompanionAgendaEvent,
  clearPendingCompanionAgendaEvent,
  getPendingCompanionAgendaEvent,
  listenForCompanionAgendaEvents,
  normalizeCompanionAgendaCategory,
} from "./companionAgendaEvents";

describe("companionAgendaEvents", () => {
  it("normalizes only the three user-agenda categories", () => {
    expect(normalizeCompanionAgendaCategory(" mind ")).toBe("Mind");
    expect(normalizeCompanionAgendaCategory("BODY")).toBe("Body");
    expect(normalizeCompanionAgendaCategory("Soul")).toBe("Soul");
    expect(normalizeCompanionAgendaCategory("work")).toBeNull();
  });

  it("dispatches a typed agenda event and removes listeners cleanly", () => {
    const listener = vi.fn();
    const unsubscribe = listenForCompanionAgendaEvents(listener);

    const detail = dispatchCompanionAgendaEvent({
      eventType: "task-complete",
      category: "body",
      taskId: "task-1",
      taskTitle: "Run five kilometers",
      seed: "task-1:2026-08-15",
    });

    expect(listener).toHaveBeenCalledWith(detail);
    expect(detail).toMatchObject({
      eventType: "task-complete",
      category: "Body",
      taskId: "task-1",
      seed: "task-1:2026-08-15",
    });

    unsubscribe();
    window.dispatchEvent(new CustomEvent(COMPANION_AGENDA_EVENT, { detail }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPendingCompanionAgendaEvent()).toEqual(detail);
    clearPendingCompanionAgendaEvent(detail!.id);
    expect(getPendingCompanionAgendaEvent()).toBeNull();
  });
});

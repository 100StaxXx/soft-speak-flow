import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountPreference } from "./useAccountPreference";

describe("account screen preferences", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it("restores a closed Inbox after remount", () => {
    const first = renderHook(() => useAccountPreference("a", "inbox-expanded", true, [true, false]));
    act(() => first.result.current[1](false)); first.unmount();
    const second = renderHook(() => useAccountPreference("a", "inbox-expanded", true, [true, false]));
    expect(second.result.current[0]).toBe(false);
  });
  it.each(["day", "agenda", "three-day", "month"])("restores calendar view %s", (view) => {
    const allowed = ["day", "agenda", "three-day", "month"];
    const first = renderHook(() => useAccountPreference("a", "calendar-view", "day", allowed));
    act(() => first.result.current[1](view)); first.unmount();
    expect(renderHook(() => useAccountPreference("a", "calendar-view", "day", allowed)).result.current[0]).toBe(view);
  });
  it("does not overwrite preferences during auth hydration or account switches", () => {
    localStorage.setItem("cosmiq:preferences:a:calendar-view", '"month"');
    const hook = renderHook(({ id }) => useAccountPreference(id, "calendar-view", "day", ["day", "month"]), { initialProps: { id: undefined as string | undefined } });
    expect(hook.result.current[0]).toBe("day");
    hook.rerender({ id: "a" }); expect(hook.result.current[0]).toBe("month");
    hook.rerender({ id: "b" }); expect(hook.result.current[0]).toBe("day");
    act(() => hook.result.current[1]("month"));
    hook.rerender({ id: "a" }); expect(hook.result.current[0]).toBe("month");
    expect(localStorage.getItem("cosmiq:preferences:a:calendar-view")).toBe('"month"');
  });
  it("ignores invalid data and tolerates unavailable storage", () => {
    localStorage.setItem("cosmiq:preferences:a:calendar-view", '"unsupported"');
    const hook = renderHook(() => useAccountPreference("a", "calendar-view", "day", ["day", "month"]));
    expect(hook.result.current[0]).toBe("day");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage full"); });
    act(() => hook.result.current[1]("month"));
    expect(hook.result.current[0]).toBe("month");
  });
});

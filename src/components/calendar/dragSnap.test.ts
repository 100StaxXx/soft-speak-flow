import { describe, expect, it } from "vitest";
import {
  buildDragZoomRailState,
  clampMinuteToRange,
  computeAdaptiveMinute,
  minuteFromRowOffset,
  minuteToTime24,
  snapMinuteByMode,
} from "./dragSnap";

describe("dragSnap", () => {
  it("snaps coarse mode to 15-minute intervals", () => {
    expect(snapMinuteByMode((8 * 60) + 41, "coarse")).toBe((8 * 60) + 45);
    expect(snapMinuteByMode((8 * 60) + 36, "coarse")).toBe((8 * 60) + 30);
  });

  it("snaps fine mode to 5-minute intervals", () => {
    expect(snapMinuteByMode((8 * 60) + 41, "fine")).toBe((8 * 60) + 40);
    expect(snapMinuteByMode((8 * 60) + 43, "fine")).toBe((8 * 60) + 45);
  });

  it("supports no-jump transition from coarse to fine", () => {
    const coarse = computeAdaptiveMinute({
      startMinute: 9 * 60,
      startClientY: 100,
      currentClientY: 122,
      mode: "coarse",
      lastSnappedMinute: 9 * 60,
      fineAnchorMinute: null,
      fineAnchorClientY: null,
    });
    expect(coarse.snappedMinute).toBe((9 * 60) + 15);

    const fineStart = computeAdaptiveMinute({
      startMinute: 9 * 60,
      startClientY: 100,
      currentClientY: 122,
      mode: "fine",
      lastSnappedMinute: coarse.snappedMinute,
      fineAnchorMinute: null,
      fineAnchorClientY: null,
    });

    expect(fineStart.snappedMinute).toBe(coarse.snappedMinute);

    const fineMove = computeAdaptiveMinute({
      startMinute: 9 * 60,
      startClientY: 100,
      currentClientY: 152,
      mode: "fine",
      lastSnappedMinute: fineStart.snappedMinute,
      fineAnchorMinute: fineStart.fineAnchorMinute,
      fineAnchorClientY: fineStart.fineAnchorClientY,
    });

    expect(fineMove.snappedMinute).toBe((9 * 60) + 20);
  });

  it("clamps minute and time output to day bounds", () => {
    expect(clampMinuteToRange(-10)).toBe(0);
    expect(clampMinuteToRange((24 * 60) + 40)).toBe((24 * 60) - 5);
    expect(minuteToTime24((24 * 60) + 40)).toBe("23:55");
  });

  it("maps row offsets to raw minutes before snapping", () => {
    expect(minuteFromRowOffset((8 * 60) + 30, 0, 60)).toBe((8 * 60) + 30);
    expect(minuteFromRowOffset((8 * 60) + 30, 30, 60)).toBe((8 * 60) + 45);
    expect(minuteFromRowOffset((8 * 60) + 30, 60, 60)).toBe(9 * 60);
  });

  it("builds zoom rail ticks around the snapped minute", () => {
    const rail = buildDragZoomRailState("fine", 400, (10 * 60) + 20);

    expect(rail.mode).toBe("fine");
    expect(rail.snappedMinute).toBe((10 * 60) + 20);
    expect(rail.ticks.length).toBeGreaterThanOrEqual(5);
    expect(rail.ticks.some((tick) => tick.isCenter)).toBe(true);
  });
});

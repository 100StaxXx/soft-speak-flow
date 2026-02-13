import { describe, expect, it } from "vitest";
import { TIME_SLOTS, generateTimeSlots } from "./quest-shared";

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

describe("quest-shared time slots", () => {
  it("generates 5-minute slots from 06:00 through 23:55", () => {
    const slots = generateTimeSlots();
    expect(slots[0]).toBe("06:00");
    expect(slots[slots.length - 1]).toBe("23:55");
    expect(slots.length).toBe(216);
  });

  it("keeps a consistent 5-minute interval between adjacent slots", () => {
    for (let i = 1; i < TIME_SLOTS.length; i += 1) {
      expect(toMinutes(TIME_SLOTS[i]) - toMinutes(TIME_SLOTS[i - 1])).toBe(5);
    }
  });
});

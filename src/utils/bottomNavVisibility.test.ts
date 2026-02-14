import { describe, expect, it } from "vitest";
import { shouldShowBottomNav } from "./bottomNavVisibility";

describe("shouldShowBottomNav", () => {
  it("hides nav for unauthenticated users", () => {
    expect(shouldShowBottomNav("/companion", false)).toBe(false);
  });

  it("shows nav for authenticated users on regular app routes", () => {
    expect(shouldShowBottomNav("/companion", true)).toBe(true);
    expect(shouldShowBottomNav("/preview", true)).toBe(true);
    expect(shouldShowBottomNav("/", true)).toBe(true);
  });

  it("hides nav on exact excluded paths", () => {
    expect(shouldShowBottomNav("/welcome", true)).toBe(false);
    expect(shouldShowBottomNav("/terms", true)).toBe(false);
    expect(shouldShowBottomNav("/privacy", true)).toBe(false);
    expect(shouldShowBottomNav("/test-scroll", true)).toBe(false);
    expect(shouldShowBottomNav("/test-day-planner", true)).toBe(false);
  });

  it("hides nav on auth/onboarding paths", () => {
    expect(shouldShowBottomNav("/auth", true)).toBe(false);
    expect(shouldShowBottomNav("/auth/reset-password", true)).toBe(false);
    expect(shouldShowBottomNav("/onboarding", true)).toBe(false);
    expect(shouldShowBottomNav("/onboarding/story", true)).toBe(false);
  });

  it("does not hide similar non-excluded prefixes", () => {
    expect(shouldShowBottomNav("/authentic", true)).toBe(true);
    expect(shouldShowBottomNav("/onboardingish", true)).toBe(true);
  });
});


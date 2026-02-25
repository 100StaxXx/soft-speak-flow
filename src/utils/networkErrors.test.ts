import { afterEach, describe, expect, it } from "vitest";
import { isQueueableWriteError } from "@/utils/networkErrors";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

afterEach(() => {
  if (originalOnlineDescriptor) {
    Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
  }
});

describe("isQueueableWriteError", () => {
  it("returns true when browser is offline", () => {
    setOnline(false);

    expect(isQueueableWriteError(new Error("validation error"))).toBe(true);
  });

  it("returns true for 5xx errors while online", () => {
    setOnline(true);

    expect(isQueueableWriteError({ status: 503, message: "Service unavailable" })).toBe(true);
  });

  it("returns false for semantic validation errors", () => {
    setOnline(true);

    expect(isQueueableWriteError({ status: 400, message: "Invalid field value" })).toBe(false);
  });
});

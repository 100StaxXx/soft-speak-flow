import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeAuthReturnPath,
  normalizeAuthReturnPath,
  peekAuthReturnPath,
  rememberAuthReturnPath,
} from "./authReturnPath";

describe("authReturnPath", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("accepts Cosmiq invite destinations", () => {
    expect(normalizeAuthReturnPath("/join/INVITE_123-abc")).toBe("/join/INVITE_123-abc");
    expect(normalizeAuthReturnPath("%2Fjoin%2FINVITE123")).toBe("/join/INVITE123");
  });

  it("rejects external and unrelated destinations", () => {
    expect(normalizeAuthReturnPath("https://evil.example/join/code")).toBeNull();
    expect(normalizeAuthReturnPath("//evil.example")).toBeNull();
    expect(normalizeAuthReturnPath("/profile")).toBeNull();
  });

  it("remembers an invite until it is consumed", () => {
    rememberAuthReturnPath("/join/INVITE123");
    expect(peekAuthReturnPath()).toBe("/join/INVITE123");
    expect(consumeAuthReturnPath()).toBe("/join/INVITE123");
    expect(peekAuthReturnPath()).toBeNull();
  });
});

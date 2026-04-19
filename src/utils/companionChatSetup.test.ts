import { describe, expect, it } from "vitest";
import {
  isCompanionChatPersistenceSetupError,
  isCompanionChatSetupError,
} from "./companionChatSetup";

describe("companionChatSetup", () => {
  it("detects missing journeys thread tables as setup errors", () => {
    const error = {
      code: "42P01",
      message: "relation \"companion_chat_threads\" does not exist",
      details: null,
      hint: null,
    };

    expect(isCompanionChatSetupError(error)).toBe(true);
    expect(isCompanionChatPersistenceSetupError(error)).toBe(true);
  });

  it("detects missing companion chat rollout columns as setup errors", () => {
    const error = {
      code: "PGRST204",
      message: "Could not find the 'surface' column of 'companion_chats' in the schema cache",
      details: null,
      hint: null,
    };

    expect(isCompanionChatSetupError(error)).toBe(true);
    expect(isCompanionChatPersistenceSetupError(error)).toBe(true);
  });

  it("does not classify unrelated backend issues as setup errors", () => {
    const error = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: null,
      hint: null,
    };

    expect(isCompanionChatSetupError(error)).toBe(false);
    expect(isCompanionChatPersistenceSetupError(error)).toBe(false);
  });
});

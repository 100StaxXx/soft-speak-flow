import { describe, expect, it } from "vitest";

import {
  DEFAULT_MENTOR_AVATAR_POSITION,
  MENTOR_AVATAR_POSITION_MAP,
  MENTOR_DISPLAY_NAMES,
  getMentorDisplaySortIndex,
  resolveActiveMentorSlug,
  resolveMentorSlugAlias,
} from "./mentorRoster";

describe("mentorRoster", () => {
  it("keeps the Graceward Guide names attached to stable mentor slugs", () => {
    expect(MENTOR_DISPLAY_NAMES).toEqual({
      sage: "Micah",
      lyra: "Clara",
      icon: "Lydia",
      charles: "Jude",
      princess: "Grace",
      operator: "Ezra",
      rival: "Caleb",
    });

    expect(resolveMentorSlugAlias("Micah")).toBe("sage");
    expect(resolveMentorSlugAlias("Clara")).toBe("lyra");
    expect(resolveMentorSlugAlias("Lydia")).toBe("icon");
    expect(resolveMentorSlugAlias("Jude")).toBe("charles");
    expect(resolveMentorSlugAlias("Grace")).toBe("princess");
    expect(resolveMentorSlugAlias("Ezra")).toBe("operator");
    expect(resolveMentorSlugAlias("Caleb")).toBe("rival");
  });

  it("maps legacy slugs to the new canonical mentors", () => {
    expect(resolveMentorSlugAlias("atlas")).toBe("sage");
    expect(resolveMentorSlugAlias("carmen")).toBe("icon");
    expect(resolveMentorSlugAlias("solace")).toBe("charles");
    expect(resolveMentorSlugAlias("sienna")).toBe("princess");
    expect(resolveMentorSlugAlias("stryker")).toBe("operator");
    expect(resolveMentorSlugAlias("eli")).toBe("rival");
    expect(resolveMentorSlugAlias("reign")).toBe("reign");
  });

  it("returns only active mentors from resolveActiveMentorSlug", () => {
    expect(resolveActiveMentorSlug("atlas")).toBe("sage");
    expect(resolveActiveMentorSlug("lyra")).toBe("lyra");
    expect(resolveActiveMentorSlug("reign")).toBeNull();
  });

  it("defines the avatar crop positions for the active mentor roster", () => {
    expect(MENTOR_AVATAR_POSITION_MAP.sage).toBe("center 22%");
    expect(MENTOR_AVATAR_POSITION_MAP.lyra).toBe("center 22%");
    expect(MENTOR_AVATAR_POSITION_MAP.icon).toBe("center 18%");
    expect(MENTOR_AVATAR_POSITION_MAP.charles).toBe("center 35%");
    expect(MENTOR_AVATAR_POSITION_MAP.princess).toBe("center 18%");
    expect(MENTOR_AVATAR_POSITION_MAP.operator).toBe("center 25%");
    expect(MENTOR_AVATAR_POSITION_MAP.rival).toBe("center 18%");
    expect(DEFAULT_MENTOR_AVATAR_POSITION).toBe("center 25%");
  });

  it("keeps canonical mentor display order stable", () => {
    expect(getMentorDisplaySortIndex("sage")).toBeLessThan(getMentorDisplaySortIndex("operator"));
    expect(getMentorDisplaySortIndex("operator")).toBeLessThan(getMentorDisplaySortIndex("rival"));
  });
});

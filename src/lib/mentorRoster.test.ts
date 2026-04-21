import { describe, expect, it } from "vitest";

import {
  DEFAULT_MENTOR_AVATAR_POSITION,
  MENTOR_AVATAR_POSITION_MAP,
  getMentorDisplaySortIndex,
  resolveActiveMentorSlug,
  resolveMentorSlugAlias,
} from "./mentorRoster";

describe("mentorRoster", () => {
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
    expect(resolveActiveMentorSlug("reign")).toBeNull();
  });

  it("defines the initial avatar crop positions for the Final 6", () => {
    expect(MENTOR_AVATAR_POSITION_MAP.sage).toBe("center 22%");
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

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MENTOR_AVATAR_POSITION,
  MENTOR_AVATAR_POSITION_MAP,
  getMentorDisplaySortIndex,
  resolveActiveMentorSlug,
  resolveMentorSlugAlias,
} from "./mentorRoster";

describe("mentorRoster", () => {
  it("accepts the active mentor roster slugs", () => {
    expect(resolveMentorSlugAlias("sage")).toBe("sage");
    expect(resolveMentorSlugAlias("lyra")).toBe("lyra");
    expect(resolveMentorSlugAlias("icon")).toBe("icon");
    expect(resolveMentorSlugAlias("charles")).toBe("charles");
    expect(resolveMentorSlugAlias("princess")).toBe("princess");
    expect(resolveMentorSlugAlias("operator")).toBe("operator");
    expect(resolveMentorSlugAlias("rival")).toBe("rival");
  });

  it("rejects legacy mentor slugs", () => {
    expect(resolveMentorSlugAlias("atlas")).toBeNull();
    expect(resolveMentorSlugAlias("carmen")).toBeNull();
    expect(resolveMentorSlugAlias("solace")).toBeNull();
    expect(resolveMentorSlugAlias("elizabeth")).toBeNull();
    expect(resolveMentorSlugAlias("sienna")).toBeNull();
    expect(resolveMentorSlugAlias("stryker")).toBeNull();
    expect(resolveMentorSlugAlias("eli")).toBeNull();
    expect(resolveMentorSlugAlias("reign")).toBeNull();
    expect(resolveActiveMentorSlug("atlas")).toBeNull();
  });

  it("defines the initial avatar crop positions for the active roster", () => {
    expect(MENTOR_AVATAR_POSITION_MAP.sage).toBe("center 22%");
    expect(MENTOR_AVATAR_POSITION_MAP.lyra).toBe("center 18%");
    expect(MENTOR_AVATAR_POSITION_MAP.icon).toBe("center 18%");
    expect(MENTOR_AVATAR_POSITION_MAP.charles).toBe("center 35%");
    expect(MENTOR_AVATAR_POSITION_MAP.princess).toBe("center 18%");
    expect(MENTOR_AVATAR_POSITION_MAP.operator).toBe("center 25%");
    expect(MENTOR_AVATAR_POSITION_MAP.rival).toBe("center 18%");
    expect(DEFAULT_MENTOR_AVATAR_POSITION).toBe("center 25%");
  });

  it("keeps canonical mentor display order stable", () => {
    expect(getMentorDisplaySortIndex("sage")).toBeLessThan(getMentorDisplaySortIndex("lyra"));
    expect(getMentorDisplaySortIndex("lyra")).toBeLessThan(getMentorDisplaySortIndex("operator"));
    expect(getMentorDisplaySortIndex("operator")).toBeLessThan(getMentorDisplaySortIndex("rival"));
  });
});

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MENTOR_AVATAR_POSITION,
  MENTOR_AVATAR_POSITION_MAP,
  filterCanonicalActiveMentors,
  getMentorDisplaySortIndex,
  resolveActiveMentorSlug,
  resolveMentorSlugAlias,
  sortCanonicalMentors,
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

  it("rejects unsupported mentor slugs", () => {
    expect(resolveMentorSlugAlias("legacy-alpha")).toBeNull();
    expect(resolveMentorSlugAlias("legacy-beta")).toBeNull();
    expect(resolveMentorSlugAlias("placeholder")).toBeNull();
    expect(resolveMentorSlugAlias("retired-guide")).toBeNull();
    expect(resolveActiveMentorSlug("legacy-alpha")).toBeNull();
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

  it("filters legacy mentors out of canonical picker lists", () => {
    const roster = [
      { id: "legacy-1", name: "Atlas", slug: "atlas" },
      { id: "sage-1", name: "The Sage", slug: "sage" },
      { id: "legacy-2", name: "Stryker", slug: "stryker" },
      { id: "lyra-1", name: "Lyra", slug: "lyra" },
    ];

    expect(filterCanonicalActiveMentors(roster).map((mentor) => mentor.slug)).toEqual([
      "sage",
      "lyra",
    ]);
  });

  it("sorts canonical mentors using the stable roster order", () => {
    const roster = [
      { id: "operator-1", name: "The Operator", slug: "operator" },
      { id: "sage-1", name: "The Sage", slug: "sage" },
      { id: "legacy-1", name: "Atlas", slug: "atlas" },
      { id: "princess-1", name: "The Princess", slug: "princess" },
      { id: "lyra-1", name: "Lyra", slug: "lyra" },
    ];

    expect(sortCanonicalMentors(roster).map((mentor) => mentor.slug)).toEqual([
      "sage",
      "lyra",
      "princess",
      "operator",
    ]);
  });
});

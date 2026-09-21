import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { COMPANION_VIDEO_CATEGORIES, COMPANION_VIDEO_DAILY_LIMIT } from "./companionWellbeing";

it("keeps the new queue constraint and atomic cap aligned with all seven clip categories", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260920223000_companion_loop_videos.sql"), "utf8");
  const allowed = sql.match(/category IN \(([^)]+)\)/)?.[1].split(",").map((value) => value.trim().replaceAll("'", ""));
  expect(allowed).toEqual([...COMPANION_VIDEO_CATEGORIES]);
  expect(sql).toContain(`>= ${COMPANION_VIDEO_DAILY_LIMIT} THEN`);
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain("BEFORE INSERT");
  expect(sql).toContain("ADD COLUMN scene_image_url text");
  expect(sql).not.toMatch(/DELETE FROM|TRUNCATE|INSERT INTO|UPDATE public\.cost_guardrail_config/i);
});

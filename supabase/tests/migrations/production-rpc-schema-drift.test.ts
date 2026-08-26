import { assertMatch } from "jsr:@std/assert";

const migrationUrl = new URL(
  "../../migrations/20260819130000_repair_account_deletion_and_shared_marker_types.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("production RPC drift repair preserves deletion hardening and fixes marker types", () => {
  assertMatch(
    sql,
    /pg_get_functiondef\('public\.delete_user_account\(uuid\)'::regprocedure\)/i,
  );
  assertMatch(
    sql,
    /v_playlist_start > 0[\s\S]*v_referral_start <= v_playlist_start[\s\S]*RAISE EXCEPTION/i,
  );
  assertMatch(
    sql,
    /WHERE referrer_id = \$1 OR referee_id = \$1[\s\S]*v_referral_codes_start/i,
  );
  assertMatch(
    sql,
    /safe_companion_image_focal_x\)::numeric AS companion_image_focal_x/i,
  );
  assertMatch(
    sql,
    /safe_companion_image_focal_y\)::numeric AS companion_image_focal_y/i,
  );
  assertMatch(sql, /NOTIFY pgrst, 'reload schema'/i);
});

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260815113000_premade_companion_progression_assets.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);
const gracewardLaunchScopeMigrationUrl = new URL(
  "../../migrations/20260815124500_limit_graceward_premade_launch_to_level_5.sql",
  import.meta.url,
);
const gracewardLaunchScopeSql = await Deno.readTextFile(
  gracewardLaunchScopeMigrationUrl,
);
const gracewardExpansionMigrationUrl = new URL(
  "../../migrations/20260815131500_expand_graceward_level_5_premade_catalog.sql",
  import.meta.url,
);
const gracewardExpansionSql = await Deno.readTextFile(
  gracewardExpansionMigrationUrl,
);

Deno.test("premade companion base migration declares the expandable 378-transition contract", () => {
  const matrixSql = sql.slice(
    sql.indexOf("WITH product_species AS"),
    sql.indexOf("INSERT INTO public.companion_premade_asset_contracts"),
  );
  const speciesRows = matrixSql.match(/\('(graceward|cosmiq)', '[a-z]+'\)/g) ?? [];
  const elementRows = matrixSql.match(/\('(fire|ice|storm|nature|void|light)'\)/g) ?? [];
  const boundaryRows = matrixSql.match(/\((1, 0|5, 1|13, 5|21, 13|36, 21|56, 36|81, 56)\)/g) ?? [];

  assertEquals(new Set(speciesRows).size, 9);
  assertEquals(new Set(elementRows).size, 6);
  assertEquals(new Set(boundaryRows).size, 7);
  assert(sql.includes("PRIMARY KEY (product_mode, species, element, boundary_level)"));
});

Deno.test("Graceward launch migration defers visual boundaries above Level 5", () => {
  assert(
    gracewardLaunchScopeSql.includes("product_mode = 'graceward'"),
  );
  assert(gracewardLaunchScopeSql.includes("boundary_level > 5"));
  assert(gracewardLaunchScopeSql.includes("'lion', 'dove', 'wolf'"));
  assert(gracewardLaunchScopeSql.includes("'light', 'nature'"));
  assert(gracewardLaunchScopeSql.includes("visual boundaries 1 and 5"));
});

Deno.test("Graceward expansion restores every Level 1-5 picker combination", () => {
  const speciesRows = gracewardExpansionSql.match(
    /\('(lamb|lion|stag|dove|eagle|wolf)'\)/g,
  ) ?? [];
  const elementRows = gracewardExpansionSql.match(
    /\('(fire|ice|storm|nature|void|light)'\)/g,
  ) ?? [];
  const boundaryRows = gracewardExpansionSql.match(/\((1, 0|5, 1)\)/g) ?? [];

  assertEquals(new Set(speciesRows).size, 6);
  assertEquals(new Set(elementRows).size, 6);
  assertEquals(new Set(boundaryRows).size, 2);
  assert(gracewardExpansionSql.includes("ON CONFLICT (product_mode, species, element, boundary_level) DO UPDATE"));
  assert(gracewardExpansionSql.includes("visual boundaries 1 and 5"));
});

Deno.test("premade companion migration only backfills published portrait/video pairs", () => {
  assert(sql.includes("portrait.name = contract.portrait_storage_path"));
  assert(sql.includes("video.name = contract.video_storage_path"));
  assert(sql.includes("animation_provider = 'higgsfield'"));
  assert(sql.includes("animation_provider_model = 'premade'"));
  assert(sql.includes("error_code = 'replaced_by_premade_asset'"));
});

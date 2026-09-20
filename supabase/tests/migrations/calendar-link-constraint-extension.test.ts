const sql = Deno.readTextFileSync("supabase/migrations/20260919210000_safe_calendar_quest_links.sql");

Deno.test("calendar-link checks extend the entire existing predicate instead of editing an IN-list token", () => {
  if ((sql.match(/pg_get_expr\(conbin, conrelid\)/g) ?? []).length !== 2) {
    throw new Error("Both checks must preserve their existing predicate.");
  }
  if ((sql.match(/CHECK \(\(%s\) OR source = %L\)/g) ?? []).length !== 2) {
    throw new Error("Both checks must explicitly OR the calendar-link source.");
  }
  if (sql.includes("replace(definition,")) {
    throw new Error("Text substitution can corrupt an OR-based constraint.");
  }
});

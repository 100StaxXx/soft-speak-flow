// Run: deno run --no-lock --node-modules-dir=none --allow-read --allow-env --allow-net scripts/test-calendar-migration.ts
// Uses in-memory PostgreSQL; never connects to Supabase or reads any credentials.
import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
const db = new PGlite();
const files = [
  '../supabase/tests/calendar-schema-fixture.sql',
  '../supabase/migrations/20251221161726_c4aa64ec-f802-4930-9147-2d978d1bfae4.sql',
  '../supabase/migrations/20260212190000_calendar_integration_foundation.sql',
  '../supabase/migrations/20260227200000_create_quest_outlook_task_links.sql',
  '../supabase/migrations/20260919210000_safe_calendar_quest_links.sql',
  '../supabase/migrations/20260919210100_calendar_task_export_intents.sql',
  '../supabase/migrations/20260919210200_calendar_background_sync.sql',
  '../supabase/tests/calendar-link-isolation.sql',
  '../supabase/tests/calendar-task-export-isolation.sql',
  '../supabase/tests/calendar-background-sync-isolation.sql',
];
try {
  for (const file of files) {
    await db.exec(await Deno.readTextFile(new URL(file, import.meta.url)));
    console.log(`Passed: ${file.split('/').pop()}`);
  }
  const { rows } = await db.query('SELECT count(*)::integer AS users FROM auth.users');
  if (rows[0].users !== 0) throw new Error('Integration test failed to roll back its records');
  console.log('Local calendar migration and isolation checks passed. Production schema still requires validation.');
} finally { await db.close(); }

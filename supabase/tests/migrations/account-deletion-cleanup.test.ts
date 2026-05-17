function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("account deletion cleanup migrations restore hardened relational cleanup", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260517003500_restore_hardened_delete_user_account.sql",
      import.meta.url,
    ),
  );
  const timeoutSource = await Deno.readTextFile(
    new URL(
      "../../migrations/20260517183000_extend_delete_user_account_statement_timeout.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.delete_user_account") &&
      source.includes("c.column_name = 'companion_id'") &&
      source.includes("companion_id = ANY($1)"),
    "Expected generic companion-linked cleanup before deleting user_companion",
  );
  assert(
    source.includes("companion-animation-videos") &&
      source.includes("storage.objects owner cleanup skipped") &&
      source.includes("storage.objects prefix cleanup skipped") &&
      source.includes("EXCEPTION WHEN OTHERS THEN"),
    "Expected SQL-side storage cleanup to include animation videos and remain best-effort",
  );
  assert(
    source.includes("delete_user_account profile delete blocked by constraint"),
    "Expected final profile delete to preserve actionable constraint diagnostics",
  );
  assert(
    !source.includes("DELETE FROM auth.users"),
    "Expected auth deletion to stay in the delete-user Edge Function",
  );
  assert(
    timeoutSource.includes("ALTER FUNCTION public.delete_user_account(uuid)") &&
      timeoutSource.includes("statement_timeout") &&
      timeoutSource.includes("'20s'"),
    "Expected the account deletion RPC to have enough statement-timeout budget for multi-table cleanup",
  );
});

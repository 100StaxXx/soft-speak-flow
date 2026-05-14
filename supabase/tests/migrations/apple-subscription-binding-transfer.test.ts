function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("Apple subscription binding transfer migration preserves recovery invariants", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260514110000_add_atomic_apple_subscription_binding_transfer.sql",
      import.meta.url,
    ),
  );

  const targetSubscriptionCheckIndex = source.indexOf(
    "WHERE user_id = p_target_user_id",
  );
  const sourceMigrationIndex = source.indexOf(
    "UPDATE public.subscriptions",
  );
  const idempotentReturnIndex = source.indexOf("'idempotent', true");
  const idempotentRevocationIndex = source.indexOf(
    "v_transfer_metadata := v_binding.metadata->'apple_binding_admin_transfer'",
  );

  assert(
    idempotentReturnIndex >= 0,
    "Expected the transfer RPC to return a no-op before rewriting existing transfer metadata",
  );
  assert(
    idempotentRevocationIndex >= 0 &&
      idempotentReturnIndex >= 0 &&
      idempotentRevocationIndex < idempotentReturnIndex &&
      source.includes("'previousAccessRevoked', v_previous_access_revoked"),
    "Expected the idempotent path to revoke stale previous access before returning",
  );
  assert(
    targetSubscriptionCheckIndex >= 0 &&
      idempotentReturnIndex >= 0 &&
      targetSubscriptionCheckIndex < idempotentReturnIndex,
    "Expected target subscription conflicts to be checked before the idempotent return path",
  );
  assert(
    targetSubscriptionCheckIndex >= 0 &&
      sourceMigrationIndex >= 0 &&
      targetSubscriptionCheckIndex < sourceMigrationIndex,
    "Expected target subscription conflicts to be checked before any source subscription migration",
  );
  assert(
    source.includes(
      "IF FOUND AND (NOT v_subscription_found OR v_target_subscription.id <> v_subscription.id) THEN",
    ),
    "Expected target subscription conflicts even when the source transaction has no subscription row",
  );
  assert(
    source.includes("NOT EXISTS") &&
      source.includes("UPDATE public.account_entitlements AS ae") &&
      source.includes("WHERE s.user_id = ae.user_id"),
    "Expected stale previous subscription entitlements without backing subscription rows to be revoked",
  );
  assert(
    source.includes(
      "ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT",
    ) &&
      source.includes("idx_payment_history_apple_original_transaction_id") &&
      source.includes(
        "apple_original_transaction_id = v_original_transaction_id",
      ) &&
      source.includes(
        "metadata->>'original_transaction_id' = v_original_transaction_id",
      ) &&
      source.includes(
        "apple_original_transaction_id IS DISTINCT FROM v_original_transaction_id",
      ) &&
      source.includes(
        "metadata->>'apple_binding_transfer_status' IS DISTINCT FROM 'transferred'",
      ),
    "Expected payment history to carry, migrate, and backfill Apple original transaction metadata",
  );
  assert(
    source.includes("'previous_bound_user_id', v_previous_bound_user_id") &&
      source.includes("'previous_subscription_user_id'"),
    "Expected binding audit metadata to preserve divergent binding and subscription owners",
  );
  assert(
    source.includes(
      "GET DIAGNOSTICS v_payment_history_migrated = ROW_COUNT;",
    ) &&
      source.includes("'paymentHistoryMigrated', v_payment_history_migrated"),
    "Expected payment history migration counts to be returned from all transfer paths",
  );
  assert(
    source.includes("NOTIFY pgrst, 'reload schema'"),
    "Expected the new RPC to refresh PostgREST schema cache after migration",
  );
});

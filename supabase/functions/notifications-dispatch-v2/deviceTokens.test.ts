import {
  selectDeviceTokensForDispatch,
  type DispatchDeviceTokenRow,
} from "./deviceTokens.ts";

function token(id: string, installationId: string | null, updatedAt: string, deviceToken = id): DispatchDeviceTokenRow {
  return {
    id,
    installation_id: installationId,
    updated_at: updatedAt,
    device_token: deviceToken,
  };
}

Deno.test("selectDeviceTokensForDispatch keeps only the newest row per installation", () => {
  const selected = selectDeviceTokensForDispatch([
    token("row-1", "install-a", "2026-04-12T18:00:00.000Z", "token-old"),
    token("row-2", "install-a", "2026-04-12T18:05:00.000Z", "token-new"),
  ]);

  if (selected.length !== 1) {
    throw new Error(`Expected one token for a single install, got ${selected.length}`);
  }

  if (selected[0].id !== "row-2" || selected[0].device_token !== "token-new") {
    throw new Error(`Expected the newest installation row to win, got ${JSON.stringify(selected)}`);
  }
});

Deno.test("selectDeviceTokensForDispatch suppresses legacy rows when install-aware rows exist", () => {
  const selected = selectDeviceTokensForDispatch([
    token("legacy-1", null, "2026-04-12T18:00:00.000Z", "legacy-token"),
    token("install-1", "install-a", "2026-04-12T18:05:00.000Z", "install-token"),
  ]);

  if (selected.length !== 1 || selected[0].id !== "install-1") {
    throw new Error(`Expected legacy rows to be suppressed once install-aware rows exist, got ${JSON.stringify(selected)}`);
  }
});

Deno.test("selectDeviceTokensForDispatch keeps one token per installation for multi-device users", () => {
  const selected = selectDeviceTokensForDispatch([
    token("install-1", "install-a", "2026-04-12T18:05:00.000Z", "token-a"),
    token("install-2", "install-b", "2026-04-12T18:10:00.000Z", "token-b"),
  ]);

  if (selected.length !== 2) {
    throw new Error(`Expected one token per installation, got ${selected.length}`);
  }

  const ids = selected.map((row) => row.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(["install-1", "install-2"])) {
    throw new Error(`Unexpected install fanout result: ${JSON.stringify(selected)}`);
  }
});

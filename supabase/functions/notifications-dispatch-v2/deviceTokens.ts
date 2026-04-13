export interface DispatchDeviceTokenRow {
  id: string;
  device_token: string;
  updated_at: string | null;
  installation_id: string | null;
}

function toTimestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickNewestRow(
  current: DispatchDeviceTokenRow | undefined,
  candidate: DispatchDeviceTokenRow,
): DispatchDeviceTokenRow {
  if (!current) return candidate;

  const currentTimestamp = toTimestamp(current.updated_at);
  const candidateTimestamp = toTimestamp(candidate.updated_at);
  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp ? candidate : current;
  }

  return candidate.id > current.id ? candidate : current;
}

export function selectDeviceTokensForDispatch(
  rows: readonly DispatchDeviceTokenRow[],
): DispatchDeviceTokenRow[] {
  if (rows.length <= 1) {
    return [...rows];
  }

  const installationAwareRows = rows.filter((row) => {
    return typeof row.installation_id === "string" && row.installation_id.trim().length > 0;
  });

  if (installationAwareRows.length > 0) {
    const newestByInstallation = new Map<string, DispatchDeviceTokenRow>();

    for (const row of installationAwareRows) {
      const installationId = row.installation_id!.trim();
      newestByInstallation.set(
        installationId,
        pickNewestRow(newestByInstallation.get(installationId), row),
      );
    }

    return [...newestByInstallation.values()].sort((left, right) => {
      return toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
    });
  }

  const newestByToken = new Map<string, DispatchDeviceTokenRow>();
  for (const row of rows) {
    newestByToken.set(
      row.device_token,
      pickNewestRow(newestByToken.get(row.device_token), row),
    );
  }

  return [...newestByToken.values()].sort((left, right) => {
    return toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
  });
}


export type UpdateChannel = "pwa" | "ios_store";

export interface UpdateAvailability {
  hasUpdate: boolean;
  channel: UpdateChannel | null;
  currentVersion: string | null;
  latestVersion: string | null;
}

export interface UseUpdateAvailabilityResult extends UpdateAvailability {
  updateAction: () => Promise<void>;
  dismiss: (versionKey: string) => void;
}

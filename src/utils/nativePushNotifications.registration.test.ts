import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => "ios"),
}));

const storageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {},
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: {
    getItem: (key: string) => storageState.store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageState.store.set(key, value);
      return true;
    },
    removeItem: (key: string) => {
      storageState.store.delete(key);
      return true;
    },
    clear: () => {
      storageState.store.clear();
      return true;
    },
  },
}));

import {
  buildDeviceTokenRegistrationPlan,
  getOrCreatePushInstallationId,
} from "@/utils/nativePushNotifications";

describe("native push registration planning", () => {
  beforeEach(() => {
    storageState.store.clear();
  });

  afterEach(() => {
    storageState.store.clear();
  });

  it("reuses the same generated installation id for this app install", () => {
    const first = getOrCreatePushInstallationId();
    const second = getOrCreatePushInstallationId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("keeps a same-install registration stable when the token has not changed", () => {
    const plan = buildDeviceTokenRegistrationPlan({
      userId: "user-1",
      installationId: "install-a",
      deviceToken: "token-1",
      userAgent: "test-agent",
      nowIso: "2026-04-12T19:00:00.000Z",
      existingRows: [
        {
          id: "row-1",
          installation_id: "install-a",
          device_token: "token-1",
        },
      ],
    });

    expect(plan.deleteIds).toEqual([]);
    expect(plan.upsertRow.installation_id).toBe("install-a");
    expect(plan.upsertRow.device_token).toBe("token-1");
  });

  it("updates the same install in place when APNs rotates the token", () => {
    const plan = buildDeviceTokenRegistrationPlan({
      userId: "user-1",
      installationId: "install-a",
      deviceToken: "token-2",
      userAgent: "test-agent",
      nowIso: "2026-04-12T19:00:00.000Z",
      existingRows: [
        {
          id: "row-1",
          installation_id: "install-a",
          device_token: "token-1",
        },
      ],
    });

    expect(plan.deleteIds).toEqual([]);
    expect(plan.upsertRow.installation_id).toBe("install-a");
    expect(plan.upsertRow.device_token).toBe("token-2");
  });

  it("does not disturb a different installation for the same user", () => {
    const plan = buildDeviceTokenRegistrationPlan({
      userId: "user-1",
      installationId: "install-a",
      deviceToken: "token-a",
      userAgent: "test-agent",
      nowIso: "2026-04-12T19:00:00.000Z",
      existingRows: [
        {
          id: "row-1",
          installation_id: "install-b",
          device_token: "token-b",
        },
      ],
    });

    expect(plan.deleteIds).toEqual([]);
  });

  it("removes stale rows that reuse the same APNs token on another install", () => {
    const plan = buildDeviceTokenRegistrationPlan({
      userId: "user-1",
      installationId: "install-a",
      deviceToken: "token-a",
      userAgent: "test-agent",
      nowIso: "2026-04-12T19:00:00.000Z",
      existingRows: [
        {
          id: "row-legacy",
          installation_id: null,
          device_token: "token-a",
        },
      ],
    });

    expect(plan.deleteIds).toEqual(["row-legacy"]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => "ios"),
}));

const storageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
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
  supabase: {
    rpc: supabaseMocks.rpc,
  },
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
  buildPushDeviceTokenClaimArgs,
  getOrCreatePushInstallationId,
  saveDeviceTokenForInstallation,
} from "@/utils/nativePushNotifications";

describe("native push registration", () => {
  beforeEach(() => {
    storageState.store.clear();
    supabaseMocks.rpc.mockReset();
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
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

  it("builds claim args for the current install token", () => {
    const args = buildPushDeviceTokenClaimArgs({
      installationId: " install-a ",
      deviceToken: " token-1 ",
      userAgent: " test-agent ",
    });

    expect(args).toEqual({
      p_installation_id: "install-a",
      p_device_token: "token-1",
      p_platform: "ios",
      p_user_agent: "test-agent",
    });
  });

  it("uses the server-side claim RPC so an install can be re-owned across accounts", async () => {
    await saveDeviceTokenForInstallation("user-2", "token-2", "install-a");

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("claim_push_device_token", {
      p_installation_id: "install-a",
      p_device_token: "token-2",
      p_platform: "ios",
      p_user_agent: navigator.userAgent,
    });
  });

  it("surfaces claim RPC errors during token registration", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "duplicate claim failed" },
    });

    await expect(
      saveDeviceTokenForInstallation("user-1", "token-a", "install-a"),
    ).rejects.toMatchObject({ message: "duplicate claim failed" });
  });
});

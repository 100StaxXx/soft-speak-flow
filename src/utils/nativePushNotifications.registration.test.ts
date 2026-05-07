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

const sonnerMocks = vi.hoisted(() => ({
  toast: vi.fn(() => "toast-id"),
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

vi.mock("@/components/ui/sonner", () => ({
  toast: sonnerMocks.toast,
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
  buildForegroundPushToast,
  buildPushDeviceTokenClaimArgs,
  dispatchNativePushReceived,
  getOrCreatePushInstallationId,
  NATIVE_PUSH_RECEIVED_EVENT,
  saveDeviceTokenForInstallation,
  showForegroundPushNotificationToast,
} from "@/utils/nativePushNotifications";

describe("native push registration", () => {
  beforeEach(() => {
    storageState.store.clear();
    supabaseMocks.rpc.mockReset();
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
    sonnerMocks.toast.mockReset();
    sonnerMocks.toast.mockReturnValue("toast-id");
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

  it("builds foreground toast copy from native push payloads", () => {
    expect(
      buildForegroundPushToast({
        id: "native-id",
        title: "Epic Falling Behind",
        body: "Focus on its habits today.",
        data: {
          type: "mentor_nudge",
          queue_id: "queue-1",
          url: "/companion",
        },
      }),
    ).toEqual({
      title: "Epic Falling Behind",
      description: "Focus on its habits today.",
      url: "/companion",
      queueId: "queue-1",
      dedupeKey: "mentor_nudge:native-id",
    });
  });

  it("shows an in-app foreground push toast with navigation action", () => {
    const navigationEvents: unknown[] = [];
    const handleNavigation = (event: Event) => {
      navigationEvents.push((event as CustomEvent<unknown>).detail);
    };
    window.addEventListener("native-push-navigation", handleNavigation);

    try {
      expect(
        showForegroundPushNotificationToast(
          {
            title: "Epic Falling Behind",
            body: "Focus on its habits today.",
            data: {
              type: "mentor_nudge",
              queue_id: "queue-2",
              url: "/companion",
            },
          },
          1_000,
        ),
      ).toBe(true);

      expect(sonnerMocks.toast).toHaveBeenCalledWith(
        "Epic Falling Behind",
        expect.objectContaining({
          id: "foreground-push:mentor_nudge:queue-2",
          description: "Focus on its habits today.",
          action: expect.objectContaining({ label: "Open" }),
        }),
      );

      const options = sonnerMocks.toast.mock.calls[0]?.[1] as
        | { action?: { onClick?: () => void } }
        | undefined;
      options?.action?.onClick?.();

      expect(navigationEvents).toEqual([{ url: "/companion", queueId: "queue-2" }]);
    } finally {
      window.removeEventListener("native-push-navigation", handleNavigation);
    }
  });

  it("dispatches foreground push received events for tray refresh", () => {
    const receivedEvents: unknown[] = [];
    const handleReceived = (event: Event) => {
      receivedEvents.push((event as CustomEvent<unknown>).detail);
    };
    window.addEventListener(NATIVE_PUSH_RECEIVED_EVENT, handleReceived);

    try {
      dispatchNativePushReceived({
        title: "Quest soon",
        body: "Start the thing.",
        data: {
          type: "task_reminder",
          queue_id: "queue-4",
          task_id: "task-4",
          url: "/tasks",
        },
      });

      expect(receivedEvents).toEqual([{ url: "/journeys?taskId=task-4", queueId: "queue-4" }]);
    } finally {
      window.removeEventListener(NATIVE_PUSH_RECEIVED_EVENT, handleReceived);
    }
  });

  it("deduplicates repeated foreground push toasts briefly", () => {
    const notification = {
      title: "Epic Falling Behind",
      body: "Focus on its habits today.",
      data: {
        type: "mentor_nudge",
        queue_id: "queue-3",
        url: "/companion",
      },
    };

    expect(showForegroundPushNotificationToast(notification, 2_000)).toBe(true);
    expect(showForegroundPushNotificationToast(notification, 2_100)).toBe(false);
    expect(sonnerMocks.toast).toHaveBeenCalledTimes(1);
  });
});

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: () => true } }));
vi.mock("@/plugins/NativeCalendarPlugin", () => ({ NativeCalendar: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
import { useCalendarIntegrations } from "./useCalendarIntegrations";
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
describe("Cosmiq calendar authorization", () => {
  beforeEach(() => mocks.invoke.mockReset());
  it.each(["google", "outlook"] as const)("identifies Cosmiq when starting %s authorization", async (provider) => {
    mocks.invoke.mockResolvedValue({ data: { url: "https://accounts.example.test/authorize" }, error: null });
    const { result } = renderHook(() => useCalendarIntegrations({ enabled: false }), { wrapper });
    await act(async () => { await result.current.beginOAuthConnection.mutateAsync({ provider, source: "native", redirectUri: "https://example.test/callback" }); });
    expect(mocks.invoke).toHaveBeenCalledWith(`${provider}-calendar-auth`, { body: {
      action: "getAuthUrl", source: "native", redirectUri: "https://example.test/callback", syncMode: "send_only", productMode: "cosmiq",
    } });
  });
  it.each(["google", "outlook"] as const)("retains the Cosmiq boundary during %s code exchange", async (provider) => {
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useCalendarIntegrations({ enabled: false }), { wrapper });
    await act(async () => { await result.current.completeOAuthConnection.mutateAsync({ provider, code: "one-time-code", state: "signed-state", redirectUri: "https://example.test/callback" }); });
    expect(mocks.invoke).toHaveBeenCalledWith(`${provider}-calendar-auth`, { body: {
      action: "exchangeCode", code: "one-time-code", state: "signed-state", redirectUri: "https://example.test/callback", syncMode: "send_only", productMode: "cosmiq",
    } });
  });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAppListener: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  getProducts: vi.fn(),
  removeCustomerInfoUpdateListener: vi.fn(),
  setLogLevel: vi.fn(),
}));

const inactiveCustomerInfo = {
  entitlements: { active: {}, all: {} },
  subscriptionsByProductIdentifier: {},
  originalAppUserId: "11111111-1111-4111-8111-111111111111",
  requestDate: "2026-01-01T00:00:00.000Z",
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "11111111-1111-4111-8111-111111111111" },
    status: "authenticated",
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (...args: unknown[]) => mocks.addAppListener(...args),
  },
}));

vi.mock("@/utils/platformTargets", () => ({
  isNativeIOS: () => true,
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({
  LOG_LEVEL: {
    DEBUG: "DEBUG",
    INFO: "INFO",
  },
  PAYWALL_RESULT: {
    NOT_PRESENTED: "NOT_PRESENTED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
  PRODUCT_CATEGORY: {
    SUBSCRIPTION: "SUBSCRIPTION",
  },
  Purchases: {
    addCustomerInfoUpdateListener: (...args: unknown[]) => mocks.addCustomerInfoUpdateListener(...args),
    configure: (...args: unknown[]) => mocks.configure(...args),
    getCustomerInfo: (...args: unknown[]) => mocks.getCustomerInfo(...args),
    getOfferings: (...args: unknown[]) => mocks.getOfferings(...args),
    getProducts: (...args: unknown[]) => mocks.getProducts(...args),
    removeCustomerInfoUpdateListener: (...args: unknown[]) => mocks.removeCustomerInfoUpdateListener(...args),
    setLogLevel: (...args: unknown[]) => mocks.setLogLevel(...args),
  },
}));

vi.mock("@revenuecat/purchases-capacitor-ui", () => ({
  RevenueCatUI: {
    presentCustomerCenter: vi.fn(),
    presentPaywall: vi.fn(),
    presentPaywallIfNeeded: vi.fn(),
  },
}));

import { StoreKitProvider, useStoreKitContext } from "./StoreKitProvider";

const never = <T,>() => new Promise<T>(() => {});

const Probe = () => {
  const storeKit = useStoreKitContext();

  return (
    <div>
      <span data-testid="storekit-loading">{String(storeKit.isLoading)}</span>
      <span data-testid="products-loading">{String(storeKit.productsLoading)}</span>
      <span data-testid="entitlement-error">{String(storeKit.entitlementError)}</span>
    </div>
  );
};

describe("StoreKitProvider", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.addAppListener.mockResolvedValue({ remove: vi.fn() });
    mocks.addCustomerInfoUpdateListener.mockResolvedValue("listener-1");
    mocks.configure.mockResolvedValue(undefined);
    mocks.getCustomerInfo.mockResolvedValue({ customerInfo: inactiveCustomerInfo });
    mocks.getOfferings.mockResolvedValue({ current: null, all: {} });
    mocks.getProducts.mockResolvedValue({ products: [] });
    mocks.removeCustomerInfoUpdateListener.mockResolvedValue({ wasRemoved: true });
    mocks.setLogLevel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("times out a stalled entitlement refresh so startup can leave loading", async () => {
    mocks.getCustomerInfo.mockReturnValue(never());

    render(
      <StoreKitProvider>
        <Probe />
      </StoreKitProvider>,
    );

    expect(screen.getByTestId("storekit-loading")).toHaveTextContent("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(screen.getByTestId("storekit-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("entitlement-error")).toHaveTextContent("true");
  });

  it("does not keep entitlement loading true while products are still loading", async () => {
    mocks.getProducts.mockReturnValue(never());

    render(
      <StoreKitProvider>
        <Probe />
      </StoreKitProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("storekit-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("products-loading")).toHaveTextContent("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8100);
    });

    expect(screen.getByTestId("products-loading")).toHaveTextContent("false");
  });
});

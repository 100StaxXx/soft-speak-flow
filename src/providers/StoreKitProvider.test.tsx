import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAppListener: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  getProducts: vi.fn(),
  purchaseStoreProduct: vi.fn(),
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
  STOREKIT_VERSION: {
    STOREKIT_2: "STOREKIT_2",
  },
  Purchases: {
    addCustomerInfoUpdateListener: (...args: unknown[]) => (
      mocks.addCustomerInfoUpdateListener(...args) ?? Promise.resolve("listener-1")
    ),
    configure: (...args: unknown[]) => mocks.configure(...args),
    getCustomerInfo: (...args: unknown[]) => mocks.getCustomerInfo(...args),
    getOfferings: (...args: unknown[]) => mocks.getOfferings(...args),
    getProducts: (...args: unknown[]) => mocks.getProducts(...args) ?? Promise.resolve({ products: [] }),
    purchaseStoreProduct: (...args: unknown[]) => mocks.purchaseStoreProduct(...args),
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
  const [purchaseTransactionId, setPurchaseTransactionId] = useState("");

  return (
    <div>
      <span data-testid="storekit-loading">{String(storeKit.isLoading)}</span>
      <span data-testid="products-loading">{String(storeKit.productsLoading)}</span>
      <span data-testid="entitlement-error">{String(storeKit.entitlementError)}</span>
      <span data-testid="entitlement-product">{storeKit.currentEntitlement?.productId ?? ""}</span>
      <span data-testid="entitlement-app-token">{storeKit.currentEntitlement?.appAccountToken ?? ""}</span>
      <span data-testid="entitlement-rc-original-user">
        {storeKit.currentEntitlement?.revenueCatOriginalAppUserId ?? ""}
      </span>
      <span data-testid="entitlement-sandbox">{String(storeKit.currentEntitlement?.isSandbox)}</span>
      <span data-testid="product-count">{String(storeKit.products.length)}</span>
      <span data-testid="product-ids">{storeKit.products.map((product) => product.identifier).join(",")}</span>
      <span data-testid="purchase-transaction-id">{purchaseTransactionId}</span>
      <button
        type="button"
        onClick={() => {
          void storeKit.purchase("cosmiq_premium_yearly").then((transaction) => {
            setPurchaseTransactionId(transaction?.transactionId ?? "");
          });
        }}
      >
        Purchase
      </button>
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
    mocks.purchaseStoreProduct.mockResolvedValue({
      productIdentifier: "cosmiq_premium_yearly",
      customerInfo: inactiveCustomerInfo,
      transaction: {
        transactionIdentifier: "2000001171944416",
        productId: "cosmiq_premium_yearly",
        purchaseDate: "2026-05-18T00:23:39Z",
      },
    });
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

  it("configures RevenueCat with StoreKit 2", async () => {
    vi.useRealTimers();

    render(
      <StoreKitProvider>
        <Probe />
      </StoreKitProvider>,
    );

    await waitFor(() => {
      expect(mocks.configure).toHaveBeenCalledWith(expect.objectContaining({
        appUserID: "11111111-1111-4111-8111-111111111111",
        storeKitVersion: "STOREKIT_2",
      }));
    });
  });

  it("maps RevenueCat sandbox metadata without treating originalAppUserId as Apple's app-account token", async () => {
    vi.useRealTimers();
    mocks.getCustomerInfo.mockResolvedValue({
      customerInfo: {
        ...inactiveCustomerInfo,
        entitlements: {
          active: {
            cosmiq_pro: {
              isActive: true,
              productIdentifier: "cosmiq_premium_yearly",
              latestPurchaseDate: "2026-05-18T12:00:00.000Z",
              latestPurchaseDateMillis: 1779105600000,
              expirationDate: "2099-01-01T00:00:00.000Z",
              isSandbox: true,
            },
          },
          all: {},
        },
        subscriptionsByProductIdentifier: {
          cosmiq_premium_yearly: {
            storeTransactionId: "store-tx-1",
            purchaseDate: "2026-05-18T12:00:00.000Z",
            expiresDate: "2099-01-01T00:00:00.000Z",
            isSandbox: true,
          },
        },
      },
    });

    render(
      <StoreKitProvider>
        <Probe />
      </StoreKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("entitlement-product")).toHaveTextContent("cosmiq_premium_yearly");
    });
    expect(screen.getByTestId("entitlement-app-token")).toHaveTextContent("");
    expect(screen.getByTestId("entitlement-rc-original-user")).toHaveTextContent(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByTestId("entitlement-sandbox")).toHaveTextContent("true");
  });

  it("returns the raw purchase transaction when customer info has not hydrated the entitlement yet", async () => {
    vi.useRealTimers();
    mocks.getProducts.mockResolvedValue({
      products: [
        {
          identifier: "cosmiq_premium_yearly",
          title: "Cosmiq Pro Yearly",
          description: "Yearly access",
          price: 99.99,
          priceString: "$99.99",
          productType: "AUTO_RENEWABLE_SUBSCRIPTION",
          subscriptionPeriod: "P1Y",
        },
      ],
    });

    render(
      <StoreKitProvider>
        <Probe />
      </StoreKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("product-count")).toHaveTextContent("1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Purchase" }));

    await waitFor(() => {
      expect(screen.getByTestId("purchase-transaction-id")).toHaveTextContent("2000001171944416");
    });
    expect(mocks.purchaseStoreProduct).toHaveBeenCalled();
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

  it("keeps direct products when offerings fail", async () => {
    vi.useRealTimers();
    mocks.getOfferings.mockRejectedValue(new Error("No offerings configured"));
    mocks.getProducts.mockResolvedValue({
      products: [
        {
          identifier: "cosmiq_premium_monthly",
          title: "Cosmiq Pro Monthly",
          description: "Monthly access",
          price: 9.99,
          priceString: "$9.99",
          productType: "AUTO_RENEWABLE_SUBSCRIPTION",
          subscriptionPeriod: "P1M",
        },
      ],
    });

    render(
      <StoreKitProvider>
        <Probe />
      </StoreKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("product-count")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("product-ids")).toHaveTextContent("cosmiq_premium_monthly");
  });
});

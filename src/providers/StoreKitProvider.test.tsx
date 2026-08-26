import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAppListener: vi.fn(),
  addTransactionListener: vi.fn(),
  currentEntitlements: vi.fn(),
  loadProducts: vi.fn(),
  manageSubscriptions: vi.fn(),
  presentCodeRedemptionSheet: vi.fn(),
  purchase: vi.fn(),
  restorePurchases: vi.fn(),
}));

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

vi.mock("@/plugins/AppleStoreKitPlugin", () => ({
  AppleStoreKit: {
    addListener: (...args: unknown[]) => mocks.addTransactionListener(...args),
    currentEntitlements: (...args: unknown[]) => mocks.currentEntitlements(...args),
    loadProducts: (...args: unknown[]) => mocks.loadProducts(...args),
    manageSubscriptions: (...args: unknown[]) => mocks.manageSubscriptions(...args),
    presentCodeRedemptionSheet: (...args: unknown[]) => mocks.presentCodeRedemptionSheet(...args),
    purchase: (...args: unknown[]) => mocks.purchase(...args),
    restorePurchases: (...args: unknown[]) => mocks.restorePurchases(...args),
  },
}));

import { StoreKitProvider, useStoreKitContext } from "./StoreKitProvider";

const activeYearlyTransaction = {
  productId: "graceward_plus_yearly",
  transactionId: "2000001171944416",
  originalTransactionId: "2000001171944400",
  purchaseDate: "2026-08-08T12:00:00.000Z",
  expirationDate: "2099-08-08T12:00:00.000Z",
  appAccountToken: "11111111-1111-4111-8111-111111111111",
  isSandbox: true,
};

const Probe = () => {
  const storeKit = useStoreKitContext();
  const [purchaseTransactionId, setPurchaseTransactionId] = useState("");

  return (
    <div>
      <span data-testid="storekit-loading">{String(storeKit.isLoading)}</span>
      <span data-testid="product-count">{String(storeKit.products.length)}</span>
      <span data-testid="product-ids">{storeKit.products.map((product) => product.identifier).join(",")}</span>
      <span data-testid="entitlement-product">{storeKit.currentEntitlement?.productId ?? ""}</span>
      <span data-testid="entitlement-sandbox">{String(storeKit.currentEntitlement?.isSandbox)}</span>
      <span data-testid="purchase-transaction-id">{purchaseTransactionId}</span>
      <button type="button" onClick={() => {
        void storeKit.purchase("graceward_plus_founder_yearly").then((transaction) => {
          setPurchaseTransactionId(transaction?.transactionId ?? "");
        });
      }}>
        Purchase
      </button>
      <button type="button" onClick={() => { void storeKit.restorePurchases(); }}>
        Restore
      </button>
      <button type="button" onClick={() => { void storeKit.manageSubscriptions(); }}>
        Manage
      </button>
    </div>
  );
};

describe("StoreKitProvider Apple-only checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addAppListener.mockResolvedValue({ remove: vi.fn() });
    mocks.addTransactionListener.mockResolvedValue({ remove: vi.fn() });
    mocks.currentEntitlements.mockResolvedValue({ transactions: [] });
    mocks.loadProducts.mockResolvedValue({
      products: [
        { identifier: "graceward_plus_monthly", displayName: "Monthly", description: "", price: 8.99, displayPrice: "$8.99", type: "autoRenewable" },
        { identifier: "graceward_plus_yearly", displayName: "Yearly", description: "", price: 49.99, displayPrice: "$49.99", type: "autoRenewable" },
        { identifier: "graceward_plus_founder_yearly", displayName: "Founding", description: "", price: 29.99, displayPrice: "$29.99", type: "autoRenewable" },
      ],
    });
    mocks.purchase.mockResolvedValue({ status: "purchased", transaction: activeYearlyTransaction });
    mocks.restorePurchases.mockResolvedValue({ transactions: [activeYearlyTransaction] });
    mocks.manageSubscriptions.mockResolvedValue(undefined);
  });

  it("loads all three Graceward subscription products directly from StoreKit", async () => {
    render(<StoreKitProvider><Probe /></StoreKitProvider>);

    await waitFor(() => expect(screen.getByTestId("product-count")).toHaveTextContent("3"));
    expect(mocks.loadProducts).toHaveBeenCalledWith({
      productIds: [
        "graceward_plus_yearly",
        "graceward_plus_monthly",
        "graceward_plus_founder_yearly",
      ],
    });
    expect(screen.getByTestId("product-ids")).toHaveTextContent("graceward_plus_founder_yearly");
  });

  it("maps a current Apple entitlement without a third-party customer record", async () => {
    mocks.currentEntitlements.mockResolvedValue({ transactions: [activeYearlyTransaction] });
    render(<StoreKitProvider><Probe /></StoreKitProvider>);

    await waitFor(() => {
      expect(screen.getByTestId("entitlement-product")).toHaveTextContent("graceward_plus_yearly");
    });
    expect(screen.getByTestId("entitlement-sandbox")).toHaveTextContent("true");
  });

  it("purchases through StoreKit 2 with the signed-in account UUID", async () => {
    render(<StoreKitProvider><Probe /></StoreKitProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Purchase" }));

    await waitFor(() => {
      expect(mocks.purchase).toHaveBeenCalledWith({
        productId: "graceward_plus_founder_yearly",
        appAccountToken: "11111111-1111-4111-8111-111111111111",
      });
    });
    expect(screen.getByTestId("purchase-transaction-id")).toHaveTextContent("2000001171944416");
  });

  it("restores Apple purchases and opens Apple's subscription management", async () => {
    render(<StoreKitProvider><Probe /></StoreKitProvider>);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Restore" }));
      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    });

    await waitFor(() => expect(mocks.restorePurchases).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.manageSubscriptions).toHaveBeenCalledTimes(1));
  });
});

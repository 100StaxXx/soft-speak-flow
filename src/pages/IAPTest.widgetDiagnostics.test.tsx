import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWidgetSyncDiagnosticsMock: vi.fn(),
  runWidgetSyncProbeMock: vi.fn(),
  reloadWidgetMock: vi.fn(),
  reloadProductsMock: vi.fn(),
  handlePurchaseMock: vi.fn(),
  handleRestoreMock: vi.fn(),
  handleManageSubscriptionsMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "ios",
    isNativePlatform: () => true,
  },
}));

vi.mock("@/hooks/useAppleSubscription", () => ({
  useAppleSubscription: () => ({
    products: [],
    productsLoading: false,
    productError: null,
    handlePurchase: mocks.handlePurchaseMock,
    handleRestore: mocks.handleRestoreMock,
    handleManageSubscriptions: mocks.handleManageSubscriptionsMock,
    loading: false,
    hasLoadedProducts: true,
    reloadProducts: mocks.reloadProductsMock,
  }),
}));

vi.mock("@/hooks/useStoreKit", () => ({
  useStoreKit: () => ({
    currentEntitlement: null,
    refreshEntitlement: vi.fn().mockResolvedValue(undefined),
    purchaseWithPromoOffer: vi.fn().mockResolvedValue(null),
    redeemOfferCode: vi.fn().mockResolvedValue({ status: "presented", entitlement: null }),
    isAvailable: true,
    products: [],
    productsLoading: false,
    isPro: false,
    activePlan: null,
    expirationDate: null,
    purchase: vi.fn().mockResolvedValue(null),
    restorePurchases: vi.fn().mockResolvedValue(null),
    manageSubscriptions: vi.fn().mockResolvedValue(undefined),
    refreshProducts: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toastMock }),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/utils/appleIAP", () => ({
  PREMIUM_MONTHLY_PRODUCT_ID: "cosmiq_premium_monthly",
  PREMIUM_YEARLY_PRODUCT_ID: "cosmiq_premium_yearly",
  isIAPAvailable: () => true,
  resolvePlanFromProductId: () => "monthly",
  getProductForPlan: () => undefined,
  getPurchaseProductIdForPlan: () => "cosmiq_premium_monthly",
}));

vi.mock("@/plugins/WidgetDataPlugin", () => ({
  WidgetData: {
    updateWidgetData: vi.fn(),
    reloadWidget: mocks.reloadWidgetMock,
    getWidgetSyncDiagnostics: mocks.getWidgetSyncDiagnosticsMock,
    runWidgetSyncProbe: mocks.runWidgetSyncProbeMock,
  },
}));

import IAPTest from "./IAPTest";

describe("IAPTest widget diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reloadProductsMock.mockResolvedValue([]);
    mocks.handlePurchaseMock.mockResolvedValue(true);
    mocks.handleRestoreMock.mockResolvedValue(undefined);
    mocks.handleManageSubscriptionsMock.mockResolvedValue(undefined);
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
    window.sessionStorage.clear();
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/iap-test"]}>
        <IAPTest />
      </MemoryRouter>,
    );

  it("renders successful native diagnostics and probe results", async () => {
    mocks.getWidgetSyncDiagnosticsMock.mockResolvedValueOnce({
      appGroupAccessible: true,
      hasPayload: true,
      payloadDate: "2026-02-24",
      payloadUpdatedAt: "2026-02-24T08:00:00.000Z",
      payloadByteCount: 184,
      appGroupId: "group.com.darrylgraham.revolution",
      dataKey: "widget_tasks_data",
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    mocks.runWidgetSyncProbeMock.mockResolvedValueOnce({
      appGroupAccessible: true,
      writeSucceeded: true,
      readBackSucceeded: true,
      payloadByteCount: 92,
      errorCode: null,
      errorMessage: null,
      timestamp: "2026-02-24T08:00:10.000Z",
    });

    const view = renderPage();

    fireEvent.click(screen.getByRole("button", { name: /fetch diagnostics/i }));
    await waitFor(() => {
      expect(mocks.getWidgetSyncDiagnosticsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /run write probe/i }));
    await waitFor(() => {
      expect(mocks.runWidgetSyncProbeMock).toHaveBeenCalledTimes(1);
    });

    expect(view.container.textContent).toContain("PASS");
    expect(view.container.textContent).toContain('"writeSucceeded": true');
    expect(view.container.textContent).toContain('"readBackSucceeded": true');
  }, 10000);

  it("renders stable probe failure code and message", async () => {
    mocks.getWidgetSyncDiagnosticsMock.mockResolvedValueOnce({
      appGroupAccessible: false,
      hasPayload: false,
      payloadDate: null,
      payloadUpdatedAt: null,
      payloadByteCount: 0,
      appGroupId: "group.com.darrylgraham.revolution",
      dataKey: "widget_tasks_data",
      lastErrorCode: "APP_GROUP_INACCESSIBLE",
      lastErrorMessage: "Failed to access App Group container",
    });
    mocks.runWidgetSyncProbeMock.mockResolvedValueOnce({
      appGroupAccessible: false,
      writeSucceeded: false,
      readBackSucceeded: false,
      payloadByteCount: 0,
      errorCode: "APP_GROUP_INACCESSIBLE",
      errorMessage: "Failed to access App Group container",
      timestamp: "2026-02-24T08:05:00.000Z",
    });

    const view = renderPage();

    fireEvent.click(screen.getByRole("button", { name: /fetch diagnostics/i }));
    await waitFor(() => {
      expect(mocks.getWidgetSyncDiagnosticsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /run write probe/i }));
    await waitFor(() => {
      expect(mocks.runWidgetSyncProbeMock).toHaveBeenCalledTimes(1);
    });

    expect(view.container.textContent).toContain("FAIL");
    expect(view.container.textContent).toContain("APP_GROUP_INACCESSIBLE");
    expect(view.container.textContent).toContain("Failed to access App Group container");
  }, 10000);
});

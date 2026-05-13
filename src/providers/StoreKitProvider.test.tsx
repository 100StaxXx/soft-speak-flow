import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAppListener: vi.fn(),
  addStoreKitListener: vi.fn(),
  getCurrentEntitlement: vi.fn(),
  getProducts: vi.fn(),
  startTransactionListener: vi.fn(),
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

vi.mock("@/plugins/StoreKitPlugin", () => ({
  StoreKit: {
    addListener: (...args: unknown[]) => mocks.addStoreKitListener(...args),
    getCurrentEntitlement: (...args: unknown[]) => mocks.getCurrentEntitlement(...args),
    getProducts: (...args: unknown[]) => mocks.getProducts(...args),
    startTransactionListener: (...args: unknown[]) => mocks.startTransactionListener(...args),
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
    mocks.addStoreKitListener.mockResolvedValue({ remove: vi.fn() });
    mocks.startTransactionListener.mockResolvedValue({ started: true });
    mocks.getProducts.mockResolvedValue({ products: [] });
    mocks.getCurrentEntitlement.mockResolvedValue({ entitlement: null });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("times out a stalled entitlement refresh so startup can leave loading", async () => {
    mocks.getCurrentEntitlement.mockReturnValue(never());

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
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(screen.getByTestId("products-loading")).toHaveTextContent("false");
  });
});

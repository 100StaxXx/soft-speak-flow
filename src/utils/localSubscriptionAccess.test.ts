import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessState } from "@/hooks/useAccessState";
import type { StoreKitTransaction } from "@/types/subscription";
import {
  buildLocalSubscriptionAccessState,
  LOCAL_SUBSCRIPTION_ACTIVATION_GRACE_MS,
  readFreshLocalSubscriptionAccess,
  readLocalSubscriptionAccess,
  rememberLocalSubscriptionAccess,
  rememberRejectedLocalSubscriptionTransaction,
} from "./localSubscriptionAccess";

const userId = "11111111-1111-4111-8111-111111111111";
const storageKey = `cosmiq.localSubscriptionAccess.v1.${userId}`;

const activeAccessState: AccessState = {
  has_access: true,
  access_source: "subscription",
  trial_ends_at: null,
  subscribed: true,
  status: "active",
  plan: "yearly",
  subscription_end: "2099-01-01T00:00:00.000Z",
};

const transaction = (overrides: Partial<StoreKitTransaction> = {}): StoreKitTransaction => ({
  transactionId: "tx-1",
  originalTransactionId: "original-tx-1",
  productId: "cosmiq_premium_yearly",
  purchaseDate: "2026-05-18T12:00:00.000Z",
  expirationDate: "2099-01-01T00:00:00.000Z",
  appAccountToken: userId,
  isSandbox: false,
  ...overrides,
});

describe("localSubscriptionAccess", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("builds local access for a transaction with a matching Apple app-account token", () => {
    expect(buildLocalSubscriptionAccessState(transaction(), userId, "yearly")).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "yearly",
    });
  });

  it("does not passively trust tokenless production transactions", () => {
    const tokenlessProduction = transaction({
      appAccountToken: undefined,
      isSandbox: false,
    });

    expect(buildLocalSubscriptionAccessState(tokenlessProduction, userId, "yearly")).toBeNull();
    expect(buildLocalSubscriptionAccessState(tokenlessProduction, userId, "yearly", {
      trustCurrentSession: true,
    })).toMatchObject({
      has_access: true,
      subscribed: true,
      plan: "yearly",
    });
  });

  it("can grant current-session activation grace before RevenueCat exposes expiration", () => {
    const justPurchased = transaction({
      appAccountToken: undefined,
      isSandbox: false,
      expirationDate: undefined,
    });

    expect(buildLocalSubscriptionAccessState(justPurchased, userId, "yearly", {
      trustCurrentSession: true,
      allowActivationGraceWithoutExpiration: true,
    })).toMatchObject({
      has_access: true,
      subscribed: true,
      plan: "yearly",
      subscription_end: new Date(
        new Date("2026-05-18T12:00:00.000Z").getTime() + LOCAL_SUBSCRIPTION_ACTIVATION_GRACE_MS,
      ).toISOString(),
    });
    expect(buildLocalSubscriptionAccessState(justPurchased, userId, "yearly", {
      trustCurrentSession: true,
    })).toBeNull();
  });

  it("allows tokenless sandbox transactions", () => {
    expect(buildLocalSubscriptionAccessState(transaction({
      appAccountToken: undefined,
      isSandbox: true,
    }), userId, "yearly")).toMatchObject({
      has_access: true,
      subscribed: true,
      plan: "yearly",
    });
  });

  it("stores wrapped records with freshness and transaction keys", () => {
    rememberLocalSubscriptionAccess(userId, activeAccessState, transaction());

    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as {
      version?: number;
      accessState?: AccessState;
      storedAt?: string;
      transactionKeys?: string[];
    };

    expect(stored).toMatchObject({
      version: 2,
      accessState: expect.objectContaining({
        has_access: true,
        plan: "yearly",
      }),
      storedAt: "2026-05-18T12:00:00.000Z",
      transactionKeys: ["original-tx-1", "tx-1"],
    });
    expect(readLocalSubscriptionAccess(userId)).toMatchObject({ subscribed: true });
    expect(readFreshLocalSubscriptionAccess(userId)).toMatchObject({ subscribed: true });
  });

  it("keeps legacy flat records readable but not fresh", () => {
    localStorage.setItem(storageKey, JSON.stringify(activeAccessState));

    expect(readLocalSubscriptionAccess(userId)).toMatchObject({
      has_access: true,
      subscribed: true,
    });
    expect(readFreshLocalSubscriptionAccess(userId)).toBeNull();
  });

  it("expires fresh activation access after the grace window", () => {
    rememberLocalSubscriptionAccess(userId, activeAccessState, transaction());

    vi.setSystemTime(new Date(
      new Date("2026-05-18T12:00:00.000Z").getTime() + LOCAL_SUBSCRIPTION_ACTIVATION_GRACE_MS + 1,
    ));

    expect(readLocalSubscriptionAccess(userId)).toMatchObject({ subscribed: true });
    expect(readFreshLocalSubscriptionAccess(userId)).toBeNull();
  });

  it("removes remembered access when its transaction is later rejected", () => {
    rememberLocalSubscriptionAccess(userId, activeAccessState, transaction());
    rememberRejectedLocalSubscriptionTransaction(userId, transaction());

    expect(readLocalSubscriptionAccess(userId)).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});

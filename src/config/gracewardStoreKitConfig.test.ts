import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type StoreKitIntroductoryOffer = {
  paymentMode: string;
  subscriptionPeriod: string;
};

type StoreKitSubscription = {
  productID: string;
  introductoryOffer: StoreKitIntroductoryOffer | null;
};

type StoreKitConfiguration = {
  settings: {
    _applicationInternalID: string;
  };
  subscriptionGroups: Array<{
    subscriptions: StoreKitSubscription[];
  }>;
};

const loadGracewardStoreKitConfiguration = (): StoreKitConfiguration => {
  const configurationPath = resolve(process.cwd(), "ios/App/App/GracewardProducts.storekit");
  return JSON.parse(readFileSync(configurationPath, "utf8")) as StoreKitConfiguration;
};

describe("Graceward StoreKit configuration", () => {
  it("keeps the subscription catalog scoped to Graceward", () => {
    const configuration = loadGracewardStoreKitConfiguration();
    const productIds = configuration.subscriptionGroups.flatMap(({ subscriptions }) =>
      subscriptions.map(({ productID }) => productID),
    );

    expect(configuration.settings._applicationInternalID).toBe("com.darrylgraham.graceward");
    expect(productIds).toEqual([
      "graceward_plus_monthly",
      "graceward_plus_yearly",
      "graceward_plus_founder_yearly",
    ]);
  });

  it("offers a seven-day free trial on standard plans only", () => {
    const configuration = loadGracewardStoreKitConfiguration();
    const subscriptions = configuration.subscriptionGroups.flatMap(({ subscriptions }) => subscriptions);
    const byProductId = Object.fromEntries(
      subscriptions.map((subscription) => [subscription.productID, subscription]),
    );
    const expectedTrial = {
      paymentMode: "free",
      subscriptionPeriod: "P1W",
    };

    expect(byProductId.graceward_plus_monthly.introductoryOffer).toMatchObject(expectedTrial);
    expect(byProductId.graceward_plus_yearly.introductoryOffer).toMatchObject(expectedTrial);
    expect(byProductId.graceward_plus_founder_yearly.introductoryOffer).toBeNull();
  });
});

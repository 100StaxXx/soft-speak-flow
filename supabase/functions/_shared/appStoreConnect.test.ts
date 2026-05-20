function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const appStoreConnectModule = await import("./appStoreConnect.ts");

Deno.test("Apple custom offer-code attributes default to no expiration and 25,000 redemptions", () => {
  Deno.env.delete("APPLE_OFFER_CODE_EXPIRATION_DATE");
  Deno.env.delete("APPLE_OFFER_CODE_MAX_REDEMPTIONS_PER_CUSTOM_CODE");

  const createAttributes =
    appStoreConnectModule.buildAppleCustomOfferCodeCreateAttributes("CREATOR123");
  const updateAttributes =
    appStoreConnectModule.buildAppleCustomOfferCodeUpdateAttributes();

  assert(createAttributes.customCode === "CREATOR123", "Expected custom code to be set");
  assert(!("active" in createAttributes), "Expected create to omit active");
  assert(createAttributes.numberOfCodes === 25000, "Expected 25,000 default redemptions");
  assert(!("expirationDate" in createAttributes), "Expected no default expiration date");
  assert(updateAttributes.numberOfCodes === 25000, "Expected update redemption limit");
  assert(!("expirationDate" in updateAttributes), "Expected update to omit expiration date");
});

Deno.test("ensureAppleCustomOfferCode replaces stale campaign custom codes before creating under the active offer", async () => {
  Deno.env.set("APPLE_OFFER_CODE_IDENTIFIER", "referrals");
  Deno.env.delete("APPLE_OFFER_CODE_EXPIRATION_DATE");
  Deno.env.delete("APPLE_OFFER_CODE_MAX_REDEMPTIONS_PER_CUSTOM_CODE");

  const calls: string[] = [];
  const client = {
    async findByValue(_customCode: string) {
      calls.push("find");
      throw new Error("Should create directly after stale campaign deactivation");
    },
    async create(customCode: string) {
      calls.push(`create:${customCode}`);
      return {
        id: "new-custom-code-id",
        customCode,
        active: true,
        expirationDate: null,
        numberOfCodes: 25000,
      };
    },
    async update(customCodeId: string) {
      calls.push(`update:${customCodeId}`);
      throw new Error("Should not update stale campaign code");
    },
    async deactivate(customCodeId: string) {
      calls.push(`deactivate:${customCodeId}`);
      return null;
    },
  };

  const result = await appStoreConnectModule.ensureAppleCustomOfferCode({
    customCode: "CREATOR123",
    existingCustomCodeId: "old-custom-code-id",
    existingCampaignIdentifier: "Cosmiq_OfferCode_yearly",
  }, client);

  assert(result.id === "new-custom-code-id", "Expected replacement custom code id");
  assert(
    calls.join(",") === "deactivate:old-custom-code-id,create:CREATOR123",
    `Unexpected stale replacement calls: ${calls.join(",")}`,
  );
});

Deno.test("ensureAppleCustomOfferCode leaves existing custom codes untouched when the campaign matches", async () => {
  Deno.env.set("APPLE_OFFER_CODE_IDENTIFIER", "referrals");
  Deno.env.delete("APPLE_OFFER_CODE_EXPIRATION_DATE");
  Deno.env.delete("APPLE_OFFER_CODE_MAX_REDEMPTIONS_PER_CUSTOM_CODE");

  const calls: string[] = [];
  const client = {
    async findByValue(_customCode: string) {
      calls.push("find");
      return {
        id: "current-custom-code-id",
        customCode: "CREATOR123",
        active: true,
        expirationDate: null,
        numberOfCodes: 1000,
      };
    },
    async create(customCode: string) {
      calls.push(`create:${customCode}`);
      throw new Error("Should not create when existing campaign matches");
    },
    async update(customCodeId: string, attributes: Record<string, unknown>) {
      calls.push(`update:${customCodeId}:${attributes.numberOfCodes}`);
      throw new Error("Should not update existing matching campaign code");
    },
    async deactivate(customCodeId: string) {
      calls.push(`deactivate:${customCodeId}`);
      return null;
    },
  };

  const result = await appStoreConnectModule.ensureAppleCustomOfferCode({
    customCode: "CREATOR123",
    existingCustomCodeId: "current-custom-code-id",
    existingCampaignIdentifier: "Referrals",
  }, client);

  assert(result.id === "current-custom-code-id", "Expected existing custom code id");
  assert(
    calls.join(",") === "find",
    `Unexpected matching campaign calls: ${calls.join(",")}`,
  );
});

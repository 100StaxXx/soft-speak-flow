import { describe, expect, it } from "vitest";
import {
  getProductIndexedDbName,
  getProductRuntimeIdentity,
} from "./productRuntime";

describe("product runtime identity", () => {
  it("keeps Graceward identifiers separate from Cosmiq", () => {
    const graceward = getProductRuntimeIdentity("christian");
    const cosmiq = getProductRuntimeIdentity("cosmiq");

    expect(graceward).toMatchObject({
      authProductMode: "graceward",
      iosBundleId: "com.darrylgraham.graceward",
      nativeScheme: "graceward",
    });
    expect(cosmiq).toMatchObject({
      authProductMode: "cosmiq",
      iosBundleId: "com.darrylgraham.revolution",
      nativeScheme: "cosmiq",
    });
    expect(graceward.webOrigins).not.toContain(cosmiq.primaryWebOrigin);
    expect(cosmiq.webOrigins).not.toContain(graceward.primaryWebOrigin);
  });

  it("uses separate browser databases for Graceward and Cosmiq", () => {
    expect(getProductIndexedDbName("offline-db", "graceward")).toBe(
      "graceward-offline-db",
    );
    expect(getProductIndexedDbName("offline-db", "cosmiq")).toBe(
      "cosmiq-offline-db",
    );
  });
});

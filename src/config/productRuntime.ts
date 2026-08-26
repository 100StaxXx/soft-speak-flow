import { PRODUCT, type ProductMode } from "@/config/product";

export type AuthProductMode = "graceward" | "cosmiq";

export interface ProductRuntimeIdentity {
  authProductMode: AuthProductMode;
  iosBundleId: string;
  nativeScheme: string;
  primaryWebOrigin: string;
  webOrigins: readonly string[];
  publicSiteOrigin: string;
}

const PRODUCT_RUNTIME_IDENTITIES: Record<ProductMode, ProductRuntimeIdentity> = {
  christian: {
    authProductMode: "graceward",
    iosBundleId: "com.darrylgraham.graceward",
    nativeScheme: "graceward",
    primaryWebOrigin: "https://graceward.app",
    webOrigins: ["https://graceward.app", "https://www.graceward.app"],
    publicSiteOrigin: "https://graceward.app",
  },
  cosmiq: {
    authProductMode: "cosmiq",
    iosBundleId: "com.darrylgraham.revolution",
    nativeScheme: "cosmiq",
    primaryWebOrigin: "https://app.cosmiq.quest",
    webOrigins: [
      "https://app.cosmiq.quest",
      "https://cosmiq.quest",
      "https://www.cosmiq.quest",
    ],
    publicSiteOrigin: "https://cosmiq.quest",
  },
};

export const getProductRuntimeIdentity = (
  mode: ProductMode,
): ProductRuntimeIdentity => PRODUCT_RUNTIME_IDENTITIES[mode];

export const PRODUCT_RUNTIME = getProductRuntimeIdentity(PRODUCT.mode);

/**
 * Both products share stable mentor UUIDs, while their user-facing mentor copy
 * lives in separate database surfaces. Never read the Graceward presentation
 * view from a Cosmiq build.
 */
export const PRODUCT_MENTOR_SOURCE = PRODUCT.mode === "christian"
  ? "graceward_guides"
  : "mentors";

export const productScopedStorageKey = (key: string): string =>
  `${PRODUCT_RUNTIME.authProductMode}:${key}`;

export const getProductIndexedDbName = (
  baseName: string,
  productMode: AuthProductMode = PRODUCT_RUNTIME.authProductMode,
): string => `${productMode}-${baseName}`;

export const isCurrentProductWebOrigin = (origin: string): boolean =>
  PRODUCT_RUNTIME.webOrigins.includes(origin);

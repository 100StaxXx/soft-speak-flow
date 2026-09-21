// TypeScript resolves this shim during static analysis. Vite replaces this
// module with the selected product implementation at build/test time.
import { productBackgroundAssets as gracewardBackgroundAssets } from "./productAssets.graceward.ts";

type ProductBackgroundAssets = Omit<
  typeof gracewardBackgroundAssets,
  "product"
> & {
  product: "cosmiq" | "graceward";
};

export const productBackgroundAssets: ProductBackgroundAssets =
  gracewardBackgroundAssets;

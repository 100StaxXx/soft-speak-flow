import { PRODUCT } from "./product";

// Enable only after the matching database migration is installed and verified.
export const GRACEWARD_ADVENTURE_ENABLED = PRODUCT.mode === "christian"
  && import.meta.env.VITE_GRACEWARD_ADVENTURE === "true";

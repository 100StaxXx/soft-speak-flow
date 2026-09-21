/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_PRODUCT_MODE?: "christian" | "cosmiq";
  readonly VITE_APPLE_OFFER_CODE_REDEMPTION_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAPS_DEBUG?: string;
  readonly VITE_ORIENTATION_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

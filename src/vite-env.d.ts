/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APPLE_OFFER_CODE_REDEMPTION_URL?: string;
  readonly VITE_TOLT_PARTNER_PORTAL_URL?: string;
  readonly VITE_TOLT_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

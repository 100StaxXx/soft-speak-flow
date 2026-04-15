/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APPLE_OFFER_CODE_REDEMPTION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

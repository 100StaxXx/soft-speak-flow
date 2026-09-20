import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import { initializeCapacitor } from "./utils/capacitor";
import { logger } from "./utils/logger";
import { isMacDesignedForIPadIOSApp } from "./utils/platformTargets";
import App from "./App";

// Initialize Sentry error tracking (only in production with valid DSN)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.PROD) {
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        // replayIntegration removed - causes WKWebView crashes on iOS
      ],
      tracesSampleRate: 0.1, // 10% of transactions
    });
  });
}

// Global error tracking for unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
});

// Wrapper component to handle Capacitor initialization
const AppWrapper = () => {
  useEffect(() => {
    initializeCapacitor();
  }, []);

  return <App />;
};

// Hide debug indicator once React takes over
document.getElementById('debug-indicator')?.remove();

// Mark native iOS early so CSS hardening can apply from first render.
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
  document.documentElement.classList.add("platform-native-ios");
  document.body.classList.add("platform-native-ios");
  document.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-native-text-selection="allow"], .allow-text-select')) {
      return;
    }
    event.preventDefault();
  }, { capture: true });

  if (isMacDesignedForIPadIOSApp()) {
    document.documentElement.classList.add("platform-mac-hosted-ios");
    document.body.classList.add("platform-mac-hosted-ios");
  }
}

createRoot(document.getElementById("root")!).render(
  <AppWrapper />
);

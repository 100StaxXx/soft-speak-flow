import { createRoot } from "react-dom/client";
import { Suspense, lazy, useEffect } from "react";
import * as Sentry from "@sentry/react";
import "./index.css";
import { initializeCapacitor } from "./utils/capacitor";
import { logger } from "./utils/logger";

// Initialize Sentry error tracking (only in production with valid DSN)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      // replayIntegration removed - causes WKWebView crashes on iOS
    ],
    tracesSampleRate: 0.1, // 10% of transactions
  });
}

// Global error tracking for unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
});

// Register service worker for PWA - skip on Capacitor native (causes WKWebView crashes)
if ('serviceWorker' in navigator && !(window as any).Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Silent fail - not critical for app functionality
    });
  });
}

// Lazy load the main app for code splitting
const App = lazy(() => import("./App.tsx"));

// Wrapper component to handle Capacitor initialization
const AppWrapper = () => {
  useEffect(() => {
    initializeCapacitor();
  }, []);

  return <App />;
};

// Hide debug indicator once React takes over
document.getElementById('debug-indicator')?.remove();

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  }>
    <AppWrapper />
  </Suspense>
);

import { createRoot } from "react-dom/client";
import { Suspense, lazy, useEffect } from "react";
import "./index.css";
import { initializeCapacitor } from "./utils/capacitor";
import { logger } from "./utils/logger";

// Global error tracking for unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
});

// Register service worker for PWA with optimized caching
if ('serviceWorker' in navigator) {
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
    
    // Hide splash screen immediately when app loads (don't wait for auth)
    // This prevents Capacitor timeout warnings
    import('@/utils/capacitor').then(({ hideSplashScreen }) => {
      // Small delay to ensure smooth transition, but much faster than waiting for auth
      setTimeout(() => {
        hideSplashScreen().catch(() => {
          // Ignore errors - splash screen might not be available on web
        });
      }, 500);
    });
  }, []);

  return <App />;
};

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

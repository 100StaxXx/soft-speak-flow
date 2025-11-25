import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import "./index.css";

// Global error tracking for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
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

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  }>
    <App />
  </Suspense>
);

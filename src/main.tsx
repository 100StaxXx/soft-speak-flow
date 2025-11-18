import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import "./index.css";

const App = lazy(() => import("./App").catch(() => {
  return { default: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-2xl font-bold text-foreground">Loading Error</h1>
        <p className="text-muted-foreground">Unable to load the application. Please refresh the page.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )}
}));

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Silent fail - not critical for app functionality
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p>Loading...</p>
      </div>
    </div>
  }>
    <App />
  </Suspense>
);

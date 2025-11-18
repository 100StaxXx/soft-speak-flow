import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA with optimized caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Silent fail - not critical for app functionality
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

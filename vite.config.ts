import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      minify: false,
      includeAssets: ['favicon.ico', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'Cosmiq - Your Personal AI Mentor',
        short_name: 'Cosmiq',
        description: 'Your gamified self-improvement companion with AI mentor, evolving digital companion, and quest-based habit tracking.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        mode: 'development',
        sourcemap: false,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            // Do not cache authenticated API responses to avoid persisting
            // user data offline. Always fetch fresh content instead.
            handler: 'NetworkOnly',
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild', // 3-5x faster than terser
    cssMinify: 'lightningcss',
    rollupOptions: {
      external: ['@capacitor-community/contacts'],
      output: {
        manualChunks: (id) => {
          // Skip externalized modules (contacts has no web implementation)
          if (id.includes('@capacitor-community/contacts')) {
            return undefined;
          }
          
          // CRITICAL: Keep React and all React-dependent libraries in a SINGLE chunk
          // iOS WKWebView can load chunks out of order, causing "createContext" errors
          // when React isn't loaded before components that use it
          
          if (id.includes('node_modules')) {
            // Only split standalone libraries that don't use React contexts/hooks
            // NOTE: recharts was removed - it uses React.useLayoutEffect and must stay with React
            if (id.includes('date-fns')) return 'date-vendor';
            // Only split pure three.js - NOT @react-three/fiber which uses React hooks
            if (id.includes('node_modules/three/')) return 'three-vendor';
            
            // Everything else (React, Radix, React Query, Framer Motion, etc.)
            // stays in a single vendor chunk for iOS compatibility
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1300,
    sourcemap: false, // Disable source maps in production for smaller bundle
    reportCompressedSize: false, // Faster builds
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'framer-motion'
    ],
    exclude: ['@radix-ui/react-icons'],
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: [],  // Temporarily keep console statements to debug iOS black screen
  },
}));

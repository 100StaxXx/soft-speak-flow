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
      external: ['@capacitor/camera'],
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor';
          }
          
          // React Query
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor';
          }
          
          // UI Libraries - Split into smaller chunks
          if (id.includes('node_modules/framer-motion')) {
            return 'animation-vendor';
          }
          
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          
          // Radix UI - Split into logical groups
          if (id.includes('node_modules/@radix-ui/react-dialog') || 
              id.includes('node_modules/@radix-ui/react-alert-dialog')) {
            return 'radix-dialogs';
          }
          
          if (id.includes('node_modules/@radix-ui/react-dropdown-menu') || 
              id.includes('node_modules/@radix-ui/react-popover') ||
              id.includes('node_modules/@radix-ui/react-tooltip')) {
            return 'radix-overlays';
          }
          
          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-ui';
          }
          
          // Form libraries
          if (id.includes('node_modules/react-hook-form') || 
              id.includes('node_modules/@hookform') ||
              id.includes('node_modules/zod')) {
            return 'forms-vendor';
          }
          
          // Chart libraries
          if (id.includes('node_modules/recharts')) {
            return 'charts-vendor';
          }
          
          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'date-vendor';
          }
          
          // Capacitor plugins
          if (id.includes('node_modules/@capacitor')) {
            return 'capacitor-vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false, // Disable source maps in production for smaller bundle
    reportCompressedSize: false, // Faster builds
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
    exclude: ['@radix-ui/react-icons'], // Exclude if not directly used
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));

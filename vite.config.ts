import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

interface ProductBuildIdentity {
  productName: "Graceward" | "Cosmiq";
  nativeScheme: "graceward" | "cosmiq";
  iosBundleId: "com.darrylgraham.graceward" | "com.darrylgraham.revolution";
  title: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  iconPath: string;
  excludedPublicArtifacts: string[];
}

function getProductBuildIdentity(env: Record<string, string>): ProductBuildIdentity {
  const isCosmiq = env.VITE_PRODUCT_MODE?.trim().toLowerCase() === "cosmiq";

  return isCosmiq
    ? {
        productName: "Cosmiq",
        nativeScheme: "cosmiq",
        iosBundleId: "com.darrylgraham.revolution",
        title: "Cosmiq — Turn intention into meaningful momentum",
        description:
          "A living companion for planning, focus, reflection, and personalized cinematic evolution.",
        themeColor: "#155e75",
        backgroundColor: "#071a2d",
        iconPath: "/cosmiq-icon.svg",
        excludedPublicArtifacts: [
          "PRIVACY_POLICY.md",
          "TERMS_OF_SERVICE.md",
          "favicon.ico",
          "favicon.png",
          "icon-192.png",
          "icon-192.svg",
          "icon-512.svg",
          "graceward-motion",
        ],
      }
    : {
        productName: "Graceward",
        nativeScheme: "graceward",
        iosBundleId: "com.darrylgraham.graceward",
        title: "Graceward — Grow in faith, one day at a time",
        description:
          "A Christian companion for Scripture, prayer, reflection, and faithful action.",
        themeColor: "#2f5938",
        backgroundColor: "#f4efe3",
        iconPath: "/icon-192.svg",
        excludedPublicArtifacts: [
          "COSMIQ_PRIVACY_POLICY.md",
          "COSMIQ_TERMS_OF_SERVICE.md",
          "cosmiq-icon.svg",
          "companion-eggs",
          "companion-hatch-videos",
          "companion-launcher-away",
          "companion-presets",
          "landing-backdrops",
          "onboarding",
        ],
      };
}

function productArtifactIsolationPlugin(env: Record<string, string>): Plugin {
  const identity = getProductBuildIdentity(env);

  return {
    name: "product-artifact-isolation",
    apply: "build",
    writeBundle(options) {
      const outputDirectory = path.resolve(
        process.cwd(),
        typeof options.dir === "string" ? options.dir : "dist",
      );

      for (const relativePath of identity.excludedPublicArtifacts) {
        fs.rmSync(path.join(outputDirectory, relativePath), { force: true, recursive: true });
      }
    },
  };
}

function buildAppleAppSiteAssociation(identity: ProductBuildIdentity): string {
  return `${JSON.stringify({
    applinks: {
      apps: [],
      details: [
        {
          appID: `B6VW78ABTR.${identity.iosBundleId}`,
          paths: [
            "/auth",
            "/auth/*",
            "/calendar/oauth/callback",
            "/calendar/oauth/callback/*",
          ],
        },
      ],
    },
  }, null, 2)}\n`;
}

function buildCalendarOAuthCallbackBridge(env: Record<string, string>): string {
  const supabaseUrl = env.VITE_SUPABASE_URL ?? "";
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const identity = getProductBuildIdentity(env);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Returning to ${identity.productName}</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #111827;
        color: #f9fafb;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #111827;
      }

      main {
        width: min(28rem, calc(100vw - 3rem));
        text-align: center;
      }

      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(2rem, 10vw, 4rem);
        line-height: 1;
      }

      p {
        margin: 0 auto 1.5rem;
        color: #cbd5e1;
        font-size: 1rem;
        line-height: 1.6;
      }

      a {
        color: #93c5fd;
        font-weight: 700;
      }

      .button {
        display: inline-flex;
        min-height: 3rem;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 1.25rem;
        background: #bfdbfe;
        color: #0f172a;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Returning to ${identity.productName}</h1>
      <p id="status">Finishing your calendar connection...</p>
      <a id="return-link" class="button" href="${identity.nativeScheme}://calendar/oauth/callback?provider=google&status=error">Return to ${identity.productName}</a>
    </main>
    <script>
      (function () {
        var config = {
          supabaseUrl: ${JSON.stringify(supabaseUrl)},
          supabaseKey: ${JSON.stringify(supabaseKey)}
        };

        var params = new URLSearchParams(window.location.search);
        var statusNode = document.getElementById("status");
        var returnLink = document.getElementById("return-link");

        function setStatus(message) {
          if (statusNode) statusNode.textContent = message;
        }

        function isProvider(value) {
          return value === "google" || value === "outlook";
        }

        function isSource(value) {
          return value === "web" || value === "native";
        }

        function providerLabel(provider) {
          return provider === "outlook" ? "Outlook" : "Google";
        }

        function decodeBase64Url(value) {
          var normalized = value.replace(/-/g, "+").replace(/_/g, "/");
          var padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
          return window.atob(padded);
        }

        function getStateHint(state) {
          if (!state) return null;
          var rawPayload = state.split(".")[0];
          if (!rawPayload) return null;

          try {
            var payload = JSON.parse(decodeBase64Url(rawPayload));
            return {
              provider: isProvider(payload.provider) ? payload.provider : null,
              source: isSource(payload.source) ? payload.source : "web"
            };
          } catch (_error) {
            return null;
          }
        }

        function buildProfileRedirect(provider, status, message) {
          var redirectParams = new URLSearchParams({
            calendar_oauth_provider: provider,
            calendar_oauth_status: status
          });
          if (message) redirectParams.set("calendar_oauth_message", message);
          return "/profile?" + redirectParams.toString();
        }

        function buildNativeRedirect(provider, status, message) {
          var redirectParams = new URLSearchParams({
            provider: provider,
            status: status
          });
          if (message) redirectParams.set("message", message);
          return "${identity.nativeScheme}://calendar/oauth/callback?" + redirectParams.toString();
        }

        function redirectToApp(provider, status, source, message) {
          var appUrl = buildNativeRedirect(provider, status, message);
          if (returnLink) returnLink.setAttribute("href", appUrl);

          if (source === "native") {
            window.location.replace(appUrl);
            window.setTimeout(function () {
              setStatus("Tap the button below if ${identity.productName} did not reopen automatically.");
            }, 1200);
            return;
          }

          window.location.replace(buildProfileRedirect(provider, status, message));
        }

        function getRedirectUri(provider, source) {
          var pathname = window.location.pathname.replace(/\\/$/, "");
          var legacyProvider = params.get("calendar_provider");
          if (isProvider(legacyProvider)) {
            var legacyParams = new URLSearchParams({
              calendar_provider: provider,
              calendar_source: source
            });
            return window.location.origin + pathname + "?" + legacyParams.toString();
          }
          return window.location.origin + pathname;
        }

        function getCallbackContext() {
          var state = params.get("state");
          var hint = getStateHint(state);
          var provider = isProvider(params.get("calendar_provider"))
            ? params.get("calendar_provider")
            : hint && hint.provider
              ? hint.provider
              : "google";
          var source = isSource(params.get("calendar_source"))
            ? params.get("calendar_source")
            : hint && hint.source
              ? hint.source
              : "native";

          return { provider: provider, source: source, state: state };
        }

        function toUserFacingConnectionError(provider, rawMessage) {
          var fallback = "Calendar connection failed. Please try again.";
          if (!rawMessage || typeof rawMessage !== "string") return fallback;

          var normalized = rawMessage.toLowerCase();
          if (normalized.indexOf("integration not configured") !== -1) {
            return providerLabel(provider) + " Calendar is not configured correctly on the server yet. Please contact support.";
          }

          if (normalized.indexOf("invalid or expired oauth state") !== -1) {
            return "Calendar connection expired. Please try again.";
          }

          if (
            provider === "outlook" &&
            (
              normalized.indexOf("aadsts9002325") !== -1 ||
              normalized.indexOf("aadsts9002326") !== -1 ||
              normalized.indexOf("proof key for code exchange") !== -1 ||
              normalized.indexOf("pkce") !== -1 ||
              normalized.indexOf("single-page application") !== -1 ||
              normalized.indexOf("cross-origin token redemption") !== -1 ||
              normalized.indexOf("public client") !== -1
            )
          ) {
            return "Outlook rejected this OAuth client type. Register the callback as a Web redirect URI in Microsoft Entra and use the matching client secret.";
          }

          if (
            normalized.indexOf("redirect_uri") !== -1 ||
            normalized.indexOf("redirect uri") !== -1 ||
            normalized.indexOf("reply address") !== -1 ||
            normalized.indexOf("aadsts50011") !== -1
          ) {
            return providerLabel(provider) + " rejected this callback URI. Please verify the calendar redirect settings for this build.";
          }

          if (
            normalized.indexOf("authorization code is invalid") !== -1 ||
            normalized.indexOf("authorization code has expired") !== -1 ||
            normalized.indexOf("code has expired") !== -1 ||
            normalized.indexOf("code was already redeemed") !== -1 ||
            normalized.indexOf("code has already been redeemed") !== -1 ||
            normalized.indexOf("aadsts54005") !== -1 ||
            normalized.indexOf("aadsts70000") !== -1
          ) {
            return "Calendar connection expired or was already used. Please try connecting again.";
          }

          if (normalized.indexOf("invalid_grant") !== -1) {
            return "The calendar provider rejected this authorization code. Please try connecting again.";
          }

          if (
            normalized.indexOf("invalid_client") !== -1 ||
            normalized.indexOf("client_secret") !== -1 ||
            normalized.indexOf("client secret") !== -1 ||
            normalized.indexOf("client_assertion") !== -1 ||
            normalized.indexOf("client assertion") !== -1 ||
            normalized.indexOf("aadsts7000215") !== -1 ||
            normalized.indexOf("aadsts7000218") !== -1
          ) {
            return providerLabel(provider) + " Calendar is not configured correctly on the server yet. Please contact support.";
          }

          return rawMessage.length <= 180 ? rawMessage : fallback;
        }

        async function getResponseErrorMessage(response, provider) {
          try {
            var payload = await response.json();
            var rawMessage = payload && (
              typeof payload.details === "string"
                ? payload.details
                : typeof payload.error === "string"
                  ? payload.error
                  : typeof payload.message === "string"
                    ? payload.message
                    : ""
            );
            return toUserFacingConnectionError(provider, rawMessage);
          } catch (_error) {
            return "Calendar connection failed. Please try again.";
          }
        }

        async function run() {
          var context = getCallbackContext();
          var state = context.state;
          var provider = context.provider;
          var source = context.source;
          var oauthError = params.get("error");
          var oauthErrorDescription = params.get("error_description");
          var code = params.get("code");

          if (oauthError) {
            redirectToApp(provider, "error", source, oauthErrorDescription || "Calendar connection was cancelled.");
            return;
          }

          if (!code) {
            redirectToApp(provider, "error", source, "Missing authorization code from calendar provider.");
            return;
          }

          if (!config.supabaseUrl || !config.supabaseKey) {
            redirectToApp(provider, "error", source, "Calendar connection is not configured in this build.");
            return;
          }

          var functionUrl = config.supabaseUrl.replace(/\\/$/, "") + "/functions/v1/" + provider + "-calendar-auth";
          var response = await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": config.supabaseKey,
              "Authorization": "Bearer " + config.supabaseKey
            },
            body: JSON.stringify({
              action: "exchangeCode",
              code: code,
              redirectUri: getRedirectUri(provider, source),
              state: state || undefined
            })
          });

          if (!response.ok) {
            redirectToApp(provider, "error", source, await getResponseErrorMessage(response, provider));
            return;
          }

          redirectToApp(provider, "success", source);
        }

        run().catch(function () {
          var context = getCallbackContext();
          redirectToApp(context.provider, "error", context.source, "Calendar connection failed. Please try again.");
        });
      })();
    </script>
  </body>
</html>
`;
}

function calendarOAuthCallbackBridgePlugin(env: Record<string, string>): Plugin {
  const identity = getProductBuildIdentity(env);

  return {
    name: "calendar-oauth-callback-bridge",
    apply: "build",
    generateBundle() {
      const source = buildCalendarOAuthCallbackBridge(env);
      const association = buildAppleAppSiteAssociation(identity);

      this.emitFile({
        type: "asset",
        fileName: "calendar/oauth/callback",
        source,
      });

      this.emitFile({
        type: "asset",
        fileName: "calendar/oauth/callback.html",
        source,
      });

      this.emitFile({
        type: "asset",
        fileName: "apple-app-site-association",
        source: association,
      });

      this.emitFile({
        type: "asset",
        fileName: ".well-known/apple-app-site-association",
        source: association,
      });

      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: [
          "/apple-app-site-association",
          "  Content-Type: application/json; charset=utf-8",
          "/.well-known/apple-app-site-association",
          "  Content-Type: application/json; charset=utf-8",
          "/calendar/oauth/callback",
          "  Content-Type: text/html; charset=utf-8",
          "",
        ].join("\n"),
      });

      this.emitFile({
        type: "asset",
        fileName: "_redirects",
        source: [
          "/calendar/oauth/callback/ /calendar/oauth/callback 200",
          "/* /index.html 200",
          "",
        ].join("\n"),
      });
    },
  };
}

function productDocumentIdentityPlugin(env: Record<string, string>): Plugin {
  const identity = getProductBuildIdentity(env);

  const replaceMeta = (
    html: string,
    attribute: "name" | "property",
    key: string,
    content: string,
  ) => html.replace(
    new RegExp(`(<meta\\s+[^>]*${attribute}=["']${key}["'][^>]*content=)["'][^"']*["']([^>]*>)`, "i"),
    `$1${JSON.stringify(content)}$2`,
  );

  return {
    name: "product-document-identity",
    transformIndexHtml(html) {
      let transformed = html
        .replace(/<title>[^<]*<\/title>/i, `<title>${identity.title}</title>`)
        .replace(/Loading (?:Graceward|Cosmiq)…/g, `Loading ${identity.productName}…`)
        .replace(/(<link\s+rel=["']icon["'][^>]*href=)["'][^"']*["']([^>]*>)/i, `$1"${identity.iconPath}"$2`)
        .replace(/(<link\s+rel=["']apple-touch-icon["'][^>]*href=)["'][^"']*["']([^>]*>)/i, `$1"${identity.iconPath}"$2`);

      transformed = replaceMeta(transformed, "name", "theme-color", identity.themeColor);
      transformed = replaceMeta(transformed, "name", "description", identity.description);
      transformed = replaceMeta(transformed, "name", "author", identity.productName);
      transformed = replaceMeta(transformed, "property", "og:title", identity.title);
      transformed = replaceMeta(transformed, "property", "og:description", identity.description);
      transformed = replaceMeta(transformed, "property", "og:image", identity.iconPath);
      transformed = replaceMeta(transformed, "name", "twitter:title", identity.title);
      transformed = replaceMeta(transformed, "name", "twitter:description", identity.description);
      transformed = replaceMeta(transformed, "name", "twitter:image", identity.iconPath);

      return transformed;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const identity = getProductBuildIdentity(env);

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      productDocumentIdentityPlugin(env),
      calendarOAuthCallbackBridgePlugin(env),
      productArtifactIsolationPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: identity.productName === "Cosmiq"
          ? ['cosmiq-icon.svg']
          : ['favicon.ico', 'icon-192.svg', 'icon-512.svg'],
        manifest: {
          name: identity.title,
          short_name: identity.productName,
          description: identity.description,
          theme_color: identity.themeColor,
          background_color: identity.backgroundColor,
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: identity.iconPath,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          sourcemap: false,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // Keep the install-time precache focused on the app shell.
          globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
          // Public contains the source assets for both products. Exclude the
          // opposite product before Workbox builds the release precache.
          globIgnores: identity.excludedPublicArtifacts,
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) => (
                sameOrigin && request.destination === 'image'
              ),
              handler: 'CacheFirst',
              options: {
                cacheName: `${identity.nativeScheme}-image-cache`,
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
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
      alias: [
        {
          find: "@/assets/backgrounds/productAssets",
          replacement: path.resolve(
            __dirname,
            identity.productName === "Cosmiq"
              ? "./src/assets/backgrounds/productAssets.cosmiq.ts"
              : "./src/assets/backgrounds/productAssets.graceward.ts",
          ),
        },
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
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

            const normalizedId = id.split(path.sep).join("/");

            if (normalizedId.includes('/node_modules/')) {
              // Keep the React runtime and startup React-adjacent UI stack together.
              // Route-only React libraries are left to Rollup so lazy pages do not
              // get pulled back into the initial vendor payload.
              if (
                normalizedId.includes('/node_modules/react/') ||
                normalizedId.includes('/node_modules/react-dom/') ||
                normalizedId.includes('/node_modules/scheduler/') ||
                normalizedId.includes('/node_modules/react-router/') ||
                normalizedId.includes('/node_modules/react-router-dom/') ||
                normalizedId.includes('/node_modules/@tanstack/react-query/') ||
                normalizedId.includes('/node_modules/@supabase/') ||
                normalizedId.includes('/node_modules/framer-motion/') ||
                normalizedId.includes('/node_modules/@radix-ui/') ||
                normalizedId.includes('/node_modules/@floating-ui/') ||
                normalizedId.includes('/node_modules/lucide-react/') ||
                normalizedId.includes('/node_modules/sonner/') ||
                normalizedId.includes('/node_modules/vaul/') ||
                normalizedId.includes('/node_modules/class-variance-authority/') ||
                normalizedId.includes('/node_modules/clsx/') ||
                normalizedId.includes('/node_modules/tailwind-merge/')
              ) {
                return 'vendor';
              }

              if (normalizedId.includes('/node_modules/@sentry/')) return 'sentry-vendor';
              if (normalizedId.includes('/node_modules/@revenuecat/')) return 'revenuecat-vendor';
              if (normalizedId.includes('/node_modules/date-fns/')) return 'date-vendor';
              // Only split pure three.js - NOT @react-three/fiber which uses React hooks.
              if (normalizedId.includes('/node_modules/three/')) return 'three-vendor';

              if (
                normalizedId.includes('/node_modules/@capacitor/core/') ||
                normalizedId.includes('/node_modules/@capacitor/app/') ||
                normalizedId.includes('/node_modules/@capacitor/browser/') ||
                normalizedId.includes('/node_modules/@capacitor/push-notifications/') ||
                normalizedId.includes('/node_modules/@capacitor/screen-orientation/') ||
                normalizedId.includes('/node_modules/@capacitor/splash-screen/')
              ) {
                return 'native-vendor';
              }

              return undefined;
            }
          }
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
  };
});

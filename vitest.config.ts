import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const vitestWorkerExecArgv = process.allowedNodeEnvironmentFlags.has(
  "--no-experimental-webstorage",
)
  ? ["--no-experimental-webstorage"]
  : [];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      // Unit tests must never depend on a developer's private .env.local file.
      // Individual suites mock network behavior; these values only allow the
      // generated Supabase client module to initialize deterministically.
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    poolOptions: {
      threads: {
        execArgv: vitestWorkerExecArgv,
      },
      forks: {
        execArgv: vitestWorkerExecArgv,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "supabase/functions/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      
      // PRODUCTION QUALITY: Warn on explicit `any` types to encourage proper typing
      // Set to "warn" to flag issues without blocking builds during migration
      "@typescript-eslint/no-explicit-any": "warn",
      
      // PRODUCTION QUALITY: Discourage console statements in production code
      // Use the structured logger utility (src/utils/logger.ts) instead
      // Allows console.warn and console.error for legitimate error reporting
      "no-console": ["warn", { 
        allow: ["warn", "error"] 
      }],
    },
  },
);

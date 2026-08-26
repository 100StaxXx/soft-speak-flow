#!/usr/bin/env node

const path = require("node:path");
const { execFileSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const configurationScript = path.join(projectRoot, "scripts", "configure-ios-product-schemes.rb");

try {
  execFileSync("ruby", [configurationScript], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  console.log("[ios:widget-config] Verified both product configurations.");
} catch (error) {
  console.error("[ios:widget-config] Failed to configure product-specific widget targets.");
  process.exit(error?.status || 1);
}

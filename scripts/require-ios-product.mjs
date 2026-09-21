#!/usr/bin/env node

import process from "node:process";

const command = process.argv[2] || "iOS command";

console.error(`[ios] ${command} is intentionally product-specific.`);
console.error(`[ios] Choose the explicit Cosmiq or Graceward variant, for example:`);
console.error(`[ios]   npm run ${command}:cosmiq`);
console.error(`[ios]   npm run ${command}:graceward`);
process.exit(1);

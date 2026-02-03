

# Fix ES Module Script for iOS Sync

## Overview
Rename the widget configuration script to use the `.cjs` extension so it works with your project's ES Module configuration, and update `package.json` to reference the renamed file.

---

## Changes Required

### 1. Rename Script File
| Current | New |
|---------|-----|
| `scripts/fix-widget-config.js` | `scripts/fix-widget-config.cjs` |

The `.cjs` extension tells Node.js to treat the file as CommonJS, allowing `require()` to work even though your project uses `"type": "module"`.

---

### 2. Update package.json Scripts

**Line 14 - ios:sync:**
```json
"ios:sync": "npx cap sync ios && node scripts/fix-widget-config.cjs",
```

**Line 15 - ios:testflight (if present):**
```json
"ios:testflight": "npm run build && npx cap sync ios && node scripts/fix-widget-config.cjs",
```

---

## After Implementation

Run these commands from your **project root**:

```bash
npm run build
npm run ios:sync
npx cap open ios
```

Then rebuild in Xcode with Cmd+R.


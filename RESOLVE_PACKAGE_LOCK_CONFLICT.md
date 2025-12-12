# Resolve package-lock.json Merge Conflict

## Quick Fix

When you have a merge conflict in `package-lock.json`, the easiest solution is to regenerate it:

```bash
# 1. Accept the incoming version (from the pull)
git checkout --theirs package-lock.json

# 2. Regenerate package-lock.json based on package.json
npm install

# 3. Stage the resolved file
git add package-lock.json

# 4. Continue (the stash pop is complete)
# No need to do anything else - the conflict is resolved
```

## Alternative: Use Theirs and Regenerate

```bash
# Accept their version
git checkout --theirs package-lock.json

# Regenerate to match your local package.json
npm install

# Add the resolved file
git add package-lock.json
```

## Why This Works

`package-lock.json` is auto-generated from `package.json`. Regenerating it ensures it matches your current `package.json` and resolves any conflicts automatically.


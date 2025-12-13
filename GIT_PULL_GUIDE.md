# 🔄 Git Pull Guide for MacInCloud

## Current Situation

You're on branch `codex/list-database-read/write-operations` and have unstaged changes. Here's how to handle it:

---

## ✅ Option 1: Stash Changes (Recommended)

**Use this if you want to temporarily save your changes and pull fresh code:**

```bash
# 1. Stash your current changes
git stash push -m "WIP: Local changes before pull"

# 2. Pull latest from your current branch
git pull origin codex/list-database-read/write-operations

# 3. Reapply your stashed changes (optional)
git stash pop
```

**Note:** If you get conflicts when popping the stash, you can review them and resolve manually.

---

## ✅ Option 2: Commit Changes First

**Use this if your local changes are important and should be committed:**

```bash
# 1. Add all changes
git add -A

# 2. Commit with a message
git commit -m "WIP: Local changes"

# 3. Pull latest (this will create a merge commit if needed)
git pull origin codex/list-database-read/write-operations

# 4. Push if you want to share your changes
git push origin codex/list-database-read/write-operations
```

---

## ✅ Option 3: Discard Changes (⚠️ Use with caution)

**Use this ONLY if your local changes are not important:**

```bash
# ⚠️ WARNING: This will permanently delete your uncommitted changes!

# 1. Discard all changes
git reset --hard HEAD

# 2. Clean untracked files
git clean -fd

# 3. Pull latest
git pull origin codex/list-database-read/write-operations
```

---

## 🎯 Recommended for Deployment

Since you're deploying to TestFlight, **Option 1 (Stash)** is usually best:

```bash
# Quick stash and pull
git stash push -m "Before TestFlight deployment"
git pull origin codex/list-database-read/write-operations
```

Then continue with the deployment steps from `TESTFLIGHT_DEPLOYMENT_GUIDE.md`.

---

## 📋 Current Changes You Have

Based on git status, you have:
- Modified files:
  - `BUGS_FINAL_REVIEW.md`
  - `docs/FIREBASE_MIGRATION_STATUS.md`
  - `ios/App/App/capacitor.config.json`
  - `ios/App/Podfile`
  - `src/components/CompanionPersonalization.tsx`
- Deleted: `ios/App/Podfile.lock`
- New files (untracked):
  - `QUICK_DEPLOY_TESTFLIGHT.md`
  - `TESTFLIGHT_DEPLOYMENT_GUIDE.md`
  - `scripts/deploy-testflight.sh`
  - `soft-speak-flow/` (directory)

**Note:** The new documentation files (`QUICK_DEPLOY_TESTFLIGHT.md`, etc.) are the deployment guides we just created. You may want to commit these or stash them.

---

## 🚀 Complete Deployment Workflow

```bash
# 1. Handle local changes
git stash push -m "Before TestFlight deployment"

# 2. Pull latest code
git pull origin codex/list-database-read/write-operations

# 3. Continue with deployment
chmod +x scripts/deploy-testflight.sh
./scripts/deploy-testflight.sh
```

---

## ❓ Which branch should I pull from?

**You're on:** `codex/list-database-read/write-operations`  
**Pull from:** `origin codex/list-database-read/write-operations` ✅

**Don't pull from `main`** unless you specifically want to switch branches. For TestFlight deployment, use your current branch.




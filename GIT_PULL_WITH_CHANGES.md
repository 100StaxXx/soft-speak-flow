# Git Pull with Unstaged Changes

## Quick Solution

If you have unstaged changes and need to pull:

### Option 1: Stash, Pull, Apply Stash (Recommended)

```bash
# Stash your changes
git stash push -m "Local changes before pull"

# Pull the latest changes
git pull

# Apply your stashed changes back
git stash pop
```

### Option 2: Commit First, Then Pull

```bash
# Add and commit your changes
git add .
git commit -m "WIP: Local changes"

# Pull (may create a merge commit)
git pull

# If you want to rebase instead:
git pull --rebase
```

### Option 3: Discard Changes (⚠️ Only if you don't need them)

```bash
# Discard all changes
git restore .

# Then pull
git pull
```

## For Your Current Situation

You're on MacInCloud and need to pull the OAuth configuration changes we just pushed.

**Recommended:**
```bash
git stash push -m "MacInCloud local changes before pull"
git pull
git stash pop
```

This will:
1. Save your local changes
2. Pull the latest code (including the OAuth fixes)
3. Reapply your local changes on top

If there are conflicts when applying the stash, Git will tell you and you can resolve them.


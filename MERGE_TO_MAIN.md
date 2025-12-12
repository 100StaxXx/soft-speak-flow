# Merge Changes to Main Branch

## Current Situation

You want to start pushing all changes to `main` branch from now on.

## Steps to Merge Working Branch to Main

Run these commands on MacInCloud:

```bash
# 1. Stash any local changes
git stash push -m "Local changes before merge"

# 2. Switch to main branch
git checkout main

# 3. Pull latest main
git pull origin main

# 4. Merge the working branch into main
git merge codex/list-database-read/write-operations

# 5. If there are conflicts, resolve them, then:
#    git add .
#    git commit

# 6. Push to main
git push origin main

# 7. Apply your stashed changes (if any)
git stash pop
```

## Going Forward

From now on, all changes will be committed and pushed to `main` branch.

## Alternative: Rebase Instead of Merge

If you prefer a cleaner history:

```bash
git checkout main
git pull origin main
git rebase codex/list-database-read/write-operations
git push origin main
```

## Note

After merging, you can delete the old branch if you want:

```bash
git branch -d codex/list-database-read/write-operations
git push origin --delete codex/list-database-read/write-operations
```


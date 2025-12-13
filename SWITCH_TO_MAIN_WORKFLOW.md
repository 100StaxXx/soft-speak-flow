# Switch to Main Branch Workflow

## Commands to Run on MacInCloud

To merge all changes from `codex/list-database-read/write-operations` to `main`:

```bash
# 1. Make sure all changes are committed on current branch
git status
# If there are uncommitted changes, commit them first

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
```

## Going Forward

From now on:
- **Work on `main` branch directly**
- **Commit and push to `main`**
- No need to create feature branches unless you want to

## After Merging

You can optionally delete the old branch:

```bash
# Delete local branch
git branch -d codex/list-database-read/write-operations

# Delete remote branch (optional)
git push origin --delete codex/list-database-read/write-operations
```

## Note

All the OAuth fixes and configuration changes we made are on the `codex/list-database-read/write-operations` branch. After merging, they'll be on `main` too.


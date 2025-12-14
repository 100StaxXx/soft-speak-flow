# GitHub Authentication Setup for MacInCloud Terminal

GitHub no longer supports password authentication. You need to use either:
1. **Personal Access Token (PAT)** - Easier if you're using HTTPS
2. **SSH Keys** - More secure and convenient once set up

## Option 1: Personal Access Token (Recommended for HTTPS)

### Step 1: Create a Personal Access Token on GitHub

1. Go to GitHub.com and log in
2. Click your profile picture → **Settings**
3. Scroll down to **Developer settings** (bottom left)
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**
6. Give it a name like "MacInCloud Terminal"
7. Select scopes: at minimum check **repo** (for private repos) or **public_repo** (for public repos only)
8. Click **Generate token**
9. **COPY THE TOKEN IMMEDIATELY** - you won't be able to see it again!

### Step 2: Use the Token When Pushing

When you run `git push`, use the token as your password:
- Username: `100StaxXx`
- Password: **Paste your token here** (not your GitHub password)

### Step 3: Cache Your Credentials (Optional)

To avoid entering the token every time:

```bash
# Cache credentials for 1 hour
git config --global credential.helper 'cache --timeout=3600'

# Or cache for the entire session
git config --global credential.helper cache
```

Or use macOS Keychain (more permanent):
```bash
git config --global credential.helper osxkeychain
```

---

## Option 2: SSH Keys (More Secure, No Repeated Password Entry)

### Step 1: Generate SSH Key (if you don't have one)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Press Enter to accept default location. Enter a passphrase (or leave empty for convenience, though less secure).

### Step 2: Add SSH Key to SSH Agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### Step 3: Copy Your Public Key

```bash
cat ~/.ssh/id_ed25519.pub
```

Copy the entire output (starts with `ssh-ed25519`).

### Step 4: Add SSH Key to GitHub

1. Go to GitHub.com → Settings → **SSH and GPG keys**
2. Click **New SSH key**
3. Title: "MacInCloud Terminal"
4. Paste your public key in the "Key" field
5. Click **Add SSH key**

### Step 5: Change Remote URL to SSH

```bash
git remote set-url origin git@github.com:100StaxXx/soft-speak-flow.git
```

Verify:
```bash
git remote -v
```

Now `git push` will use SSH authentication automatically!

---

## Quick Test

After setup, test with:
```bash
git push
```

---

## Troubleshooting

### If PAT still doesn't work:
- Make sure you copied the entire token
- Check token hasn't expired (tokens can have expiration dates)
- Verify the token has `repo` scope

### If SSH doesn't work:
```bash
# Test SSH connection
ssh -T git@github.com

# Should see: "Hi 100StaxXx! You've successfully authenticated..."
```

If you see permission denied, check:
- SSH key was added correctly: `ssh-add -l`
- GitHub has the correct public key

---

## Recommendation

For MacInCloud terminal, **SSH is recommended** because:
- ✅ No need to enter credentials repeatedly
- ✅ More secure
- ✅ Works automatically once configured

But **PAT is faster** if you just need a quick solution right now.


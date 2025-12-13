# Navigate to Project Folder in Terminal

## On MacInCloud (macOS/Linux)

```bash
# Navigate to your project folder
cd ~/soft-speak-flow

# Or if it's in a different location:
cd /path/to/soft-speak-flow

# To see where you currently are:
pwd

# To see what's in the current directory:
ls

# To go up one directory level:
cd ..

# To go to your home directory:
cd ~
```

## On Windows (PowerShell)

```bash
# Navigate to your project folder
cd C:\Users\darry\Projects\Cosmiq\soft-speak-flow

# Or if you're already in the Projects folder:
cd Cosmiq\soft-speak-flow

# To see where you currently are:
pwd

# To see what's in the current directory:
dir

# To go up one directory level:
cd ..

# To go to your user directory:
cd ~
```

## Common Commands

```bash
# Show current directory
pwd

# List files and folders
ls          # macOS/Linux
dir         # Windows

# Change directory
cd folder-name

# Go back to previous directory
cd -

# Go to home directory
cd ~
```

## Finding Your Project

If you're not sure where the project is:

```bash
# Search for the project folder (macOS/Linux)
find ~ -name "soft-speak-flow" -type d 2>/dev/null

# Or check common locations
ls ~/Projects
ls ~/Documents
ls ~/Desktop
```


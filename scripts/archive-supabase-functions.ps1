# Archive Supabase Functions before cleanup
# This is safe to run - it only creates backups

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveDir = "archive/supabase-functions-$timestamp"
New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null

Write-Host "📦 Archiving Supabase functions to $archiveDir..." -ForegroundColor Yellow

# Archive functions
if (Test-Path "supabase/functions") {
    Copy-Item -Path "supabase/functions" -Destination "$archiveDir/functions" -Recurse -Force
    Write-Host "✅ Functions archived" -ForegroundColor Green
}

# Archive config
if (Test-Path "supabase/config.toml") {
    Copy-Item -Path "supabase/config.toml" -Destination "$archiveDir/config.toml" -Force
    Write-Host "✅ Config archived" -ForegroundColor Green
}

# Create manifest
$manifestLines = @(
    "Supabase Functions Archive",
    "Created: $(Get-Date)",
    "Purpose: Backup before cleanup after Firebase migration",
    "",
    "Contents:",
    "- supabase/functions/ (all edge functions)",
    "- supabase/config.toml (function configuration)",
    "",
    "Migration Status:",
    "- All app code migrated to Firebase",
    "- 69 Supabase functions found (none referenced in app)",
    "- Firebase functions: 56 total, 50 referenced",
    "",
    "This archive can be deleted after:",
    "1. Verifying no active cron jobs in Supabase",
    "2. Verifying webhooks point to Firebase",
    "3. Confirming Firebase cron jobs are active",
    "4. Testing all functionality works with Firebase only"
)

$manifestLines | Out-File -FilePath "$archiveDir/MANIFEST.txt" -Encoding UTF8

Write-Host "✅ Archive complete: $archiveDir" -ForegroundColor Green
Write-Host "📋 Review MANIFEST.txt in archive for details" -ForegroundColor Cyan

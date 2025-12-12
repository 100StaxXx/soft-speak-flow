# PowerShell script to remove Supabase dependencies and files
# Run this after verifying migration is complete

Write-Host "🧹 Cleaning up Supabase dependencies and files..." -ForegroundColor Cyan

# Remove Supabase package
Write-Host "📦 Removing @supabase/supabase-js from package.json..." -ForegroundColor Yellow
npm uninstall @supabase/supabase-js

# Remove Supabase integration directory
$supabaseDir = "src/integrations/supabase"
if (Test-Path $supabaseDir) {
    Write-Host "🗑️  Removing $supabaseDir directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $supabaseDir
    Write-Host "✅ Removed Supabase integration directory" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Supabase integration directory not found (may have been removed already)" -ForegroundColor Gray
}

# Check for remaining Supabase references
Write-Host ""
Write-Host "🔍 Checking for remaining Supabase references..." -ForegroundColor Cyan
$remaining = Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx,*.js,*.jsx | 
    Select-String -Pattern "supabase" | 
    Where-Object { $_.Path -notmatch "node_modules" }

if ($remaining.Count -eq 0) {
    Write-Host "✅ No remaining Supabase references found in source code!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Found $($remaining.Count) remaining Supabase references. Please review:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" }
}

Write-Host ""
Write-Host "✨ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update .env files to remove Supabase environment variables"
Write-Host "2. Update documentation to remove Supabase references"
Write-Host "3. Test the application thoroughly"
Write-Host "4. Commit the changes"


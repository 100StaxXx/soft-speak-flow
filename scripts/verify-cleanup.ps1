# Verification Script: Post-Cleanup Verification
# Checks for any remaining Supabase references and verifies Firebase setup

Write-Host "Verifying Supabase Cleanup..." -ForegroundColor Cyan
Write-Host ""

$issues = @()
$warnings = @()

# Check 1: Verify Supabase functions directory is removed
Write-Host "1. Checking Supabase functions directory..." -ForegroundColor Yellow
if (Test-Path "supabase/functions") {
    $issues += "FAILED: supabase/functions directory still exists"
    Write-Host "   FAILED: Directory still exists" -ForegroundColor Red
} else {
    Write-Host "   PASSED: Directory removed" -ForegroundColor Green
}

# Check 2: Verify archive exists
Write-Host "2. Checking archive exists..." -ForegroundColor Yellow
$archives = Get-ChildItem -Path "archive" -Directory -Filter "supabase-functions-*" -ErrorAction SilentlyContinue
if ($archives.Count -gt 0) {
    Write-Host "   PASSED: Archive found at $($archives[0].FullName)" -ForegroundColor Green
} else {
    $warnings += "WARNING: No archive found"
    Write-Host "   WARNING: No archive found" -ForegroundColor Yellow
}

# Check 3: Check for Supabase imports in src/
Write-Host "3. Checking for Supabase imports in src/..." -ForegroundColor Yellow
$supabaseImports = Select-String -Path "src/**/*.ts" -Pattern "@supabase/supabase-js|from.*supabase/client" -ErrorAction SilentlyContinue
if ($supabaseImports) {
    $issues += "FAILED: Found Supabase imports in src/: $($supabaseImports.Count) matches"
    Write-Host "   FAILED: Found $($supabaseImports.Count) Supabase imports" -ForegroundColor Red
    $supabaseImports | ForEach-Object { Write-Host "      - $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
} else {
    Write-Host "   PASSED: No Supabase imports found" -ForegroundColor Green
}

# Check 4: Check for Supabase function calls in src/
Write-Host "4. Checking for Supabase function calls in src/..." -ForegroundColor Yellow
$supabaseCalls = Select-String -Path "src/**/*.ts" -Pattern "supabase\.functions\.invoke|/functions/v1/" -ErrorAction SilentlyContinue
if ($supabaseCalls) {
    $issues += "FAILED: Found Supabase function calls in src/: $($supabaseCalls.Count) matches"
    Write-Host "   FAILED: Found $($supabaseCalls.Count) Supabase function calls" -ForegroundColor Red
    $supabaseCalls | ForEach-Object { Write-Host "      - $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
} else {
    Write-Host "   PASSED: No Supabase function calls found" -ForegroundColor Green
}

# Check 5: Verify Firebase functions exist
Write-Host "5. Checking Firebase functions..." -ForegroundColor Yellow
if (Test-Path "functions/src/index.ts") {
    $firebaseFunctions = Select-String -Path "functions/src/index.ts" -Pattern "export const \w+ = (onCall|onRequest|onSchedule|functions\.https\.)" | Measure-Object
    Write-Host "   PASSED: Found $($firebaseFunctions.Count) Firebase functions" -ForegroundColor Green
} else {
    $issues += "FAILED: Firebase functions directory not found"
    Write-Host "   FAILED: Firebase functions not found" -ForegroundColor Red
}

# Check 6: Verify Firebase cron jobs are defined
Write-Host "6. Checking Firebase cron jobs..." -ForegroundColor Yellow
if (Test-Path "functions/src/index.ts") {
    $cronJobs = Select-String -Path "functions/src/index.ts" -Pattern "onSchedule" | Measure-Object
    if ($cronJobs.Count -ge 4) {
        Write-Host "   PASSED: Found $($cronJobs.Count) Firebase cron jobs" -ForegroundColor Green
    } else {
        $warnings += "WARNING: Expected 4+ cron jobs, found $($cronJobs.Count)"
        Write-Host "   WARNING: Found $($cronJobs.Count) cron jobs (expected 4+)" -ForegroundColor Yellow
    }
} else {
    $issues += "FAILED: Cannot check cron jobs - functions/src/index.ts not found"
    Write-Host "   FAILED: Cannot verify cron jobs" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "All checks passed!" -ForegroundColor Green
    exit 0
} elseif ($issues.Count -eq 0) {
    Write-Host "Some warnings found:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    exit 0
} else {
    Write-Host "Issues found:" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    if ($warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "Warnings:" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    }
    exit 1
}

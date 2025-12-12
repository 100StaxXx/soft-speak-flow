# iOS Build Preparation Script
# Validates environment and prepares for iOS build

Write-Host "🔍 Validating environment variables..." -ForegroundColor Cyan
node scripts/validate-env.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Environment validation failed!" -ForegroundColor Red
    Write-Host "Please fix the issues above before building." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Environment validation passed!" -ForegroundColor Green
Write-Host "`n📦 Ready to build for iOS. Run:" -ForegroundColor Cyan
Write-Host "   npm run ios:build" -ForegroundColor White
Write-Host "`nOr test locally:" -ForegroundColor Cyan
Write-Host "   npm run ios:open" -ForegroundColor White

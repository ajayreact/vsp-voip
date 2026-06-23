# Build VSP-VOIP Android APK for local testing.
#
# Usage:
#   .\scripts\build-mobile-android.ps1
#   .\scripts\build-mobile-android.ps1 -ApiUrl "http://192.168.1.50:3000"
#   .\scripts\build-mobile-android.ps1 -Release
#
# Output:
#   mobile\build\app\outputs\flutter-apk\app-debug.apk   (default)
#   mobile\build\app\outputs\flutter-apk\app-release.apk (-Release)

param(
    [string]$ApiUrl = "https://api.vspphone.com",
    [switch]$Release
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Mobile = Join-Path $Root "mobile"

Write-Host "=== VSP-VOIP Android build ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host "Mode:    $(if ($Release) { 'release' } else { 'debug' })"
Write-Host ""

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw "Flutter SDK not found. Install from https://docs.flutter.dev/get-started/install"
}

Push-Location $Mobile
try {
    flutter pub get

    $define = "--dart-define=API_BASE_URL=$ApiUrl"
    if ($Release) {
        flutter build apk --release $define
        if ($LASTEXITCODE -ne 0) { throw "flutter build apk --release failed" }
        $apk = Join-Path $Mobile "build\app\outputs\flutter-apk\app-release.apk"
    } else {
        flutter build apk --debug $define
        if ($LASTEXITCODE -ne 0) { throw "flutter build apk --debug failed" }
        $apk = Join-Path $Mobile "build\app\outputs\flutter-apk\app-debug.apk"
    }

    if (-not (Test-Path $apk)) {
        throw "Build finished but APK not found at $apk"
    }

    Write-Host ""
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "APK: $apk"
    Write-Host ""
    Write-Host "Install on emulator:" -ForegroundColor Yellow
    Write-Host "  adb install -r `"$apk`""
    Write-Host ""
    Write-Host "Physical device: use -ApiUrl with your PC LAN IP (same Wi-Fi), e.g.:"
    Write-Host "  .\scripts\build-mobile-android.ps1 -ApiUrl http://192.168.1.50:3000"
} finally {
    Pop-Location
}

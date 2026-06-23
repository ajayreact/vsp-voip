#!/usr/bin/env bash
# Build VSP-VOIP iOS app for simulator or device (macOS + Xcode required).
#
# Usage:
#   ./scripts/build-mobile-ios.sh
#   API_BASE_URL=http://192.168.1.50:3000 ./scripts/build-mobile-ios.sh --simulator
#   ./scripts/build-mobile-ios.sh --device
#
# Output:
#   Simulator: run with `flutter run` or open ios/Runner.xcworkspace in Xcode
#   Device:    build/ios/iphoneos/Runner.app (requires signing in Xcode)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
API_URL="${API_BASE_URL:-http://vspphone.com:3000}"
MODE="${1:---simulator}"

echo "=== VSP-VOIP iOS build ==="
echo "API URL: $API_URL"
echo "Mode:    $MODE"
echo ""

cd "$MOBILE"
flutter pub get

DEFINE="--dart-define=API_BASE_URL=$API_URL"

case "$MODE" in
  --simulator)
    flutter build ios --simulator $DEFINE
    echo ""
    echo "SUCCESS — iOS simulator build"
    echo "Run: cd mobile && flutter run $DEFINE"
    ;;
  --device)
    flutter build ios --release $DEFINE
    echo ""
    echo "SUCCESS — iOS device build"
    echo "Open mobile/ios/Runner.xcworkspace in Xcode to sign and install on device."
    echo "Or archive for TestFlight: Product → Archive in Xcode."
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Use --simulator or --device"
    exit 1
    ;;
esac

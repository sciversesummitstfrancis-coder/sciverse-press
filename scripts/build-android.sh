#!/usr/bin/env bash
# Build a standalone, installable release APK for the Sciverse Press Android app.
#
# Usage:
#   scripts/build-android.sh                                   # uses default API URL
#   EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 scripts/build-android.sh
#
# Requirements: Android SDK + JDK 17 (see docs/ANDROID_BUILD.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/mobile"

# --- JDK 17 (RN 0.74 / Expo 51 requires 17, not 21+) ---
if [[ -z "${JAVA_HOME:-}" ]]; then
  for cand in "$HOME/.local/jdk/jdk-17"* /tmp/opencode/jdk/jdk-17* /usr/lib/jvm/java-17-openjdk*; do
    [[ -x "$cand/bin/java" ]] && JAVA_HOME="$cand" && break
  done
fi
: "${JAVA_HOME:?JDK 17 not found. Install it and/or set JAVA_HOME.}"
export PATH="$JAVA_HOME/bin:$PATH"

# --- Android SDK ---
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
export ANDROID_HOME ANDROID_SDK_ROOT
[[ -d "$ANDROID_HOME/platform-tools" ]] || { echo "Android SDK not found at $ANDROID_HOME" >&2; exit 1; }

echo "JAVA_HOME   = $JAVA_HOME"
echo "ANDROID_HOME= $ANDROID_HOME"
java -version 2>&1 | head -1

cd "$MOBILE"

if [[ ! -d android ]]; then
  echo ">> generating native project (expo prebuild)"
  npx expo prebuild -p android
fi

if [[ -n "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo ">> bundling with API base URL: $EXPO_PUBLIC_API_URL"
else
  echo ">> WARNING: EXPO_PUBLIC_API_URL not set; the app will default to http://localhost:4000"
  echo "   That only works on an emulator. On a real phone set it to your machine's LAN IP, e.g."
  echo "   EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 $0"
fi

# Build only the ABIs your phone needs. A single arm64 build is the lightest
# option (≈3x less native compilation, ≈2x smaller APK). Use
# ARCHS="arm64-v8a,armeabi-v7a,x86_64" if you also need emulators.
ARCHS="${ARCHS:-arm64-v8a}"

cd android
./gradlew assembleRelease \
  -PreactNativeArchitectures="$ARCHS" \
  --no-daemon --max-workers=1 --console=plain

APK="$MOBILE/android/app/build/outputs/apk/release/app-release.apk"
VERSION="$(node -p "require('$MOBILE/package.json').version")"
OUT="$ROOT/dist/SciversePress-v$VERSION-release.apk"
mkdir -p "$ROOT/dist"
cp "$APK" "$OUT"

echo
echo "✅ APK built: $OUT"
ls -lh "$OUT"
echo
echo "Install on a connected device with:"
echo "  adb install -r \"$OUT\""

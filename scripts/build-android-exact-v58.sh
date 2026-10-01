#!/data/data/com.termux/files/usr/bin/bash
set -e
MAIN="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$MAIN/android-baseline-v58/assets/public"
DIST="$MAIN/dist"
echo "== EXACT V58 BASELINE BUILD ==" 
test -d "$BASE"
COUNT="$(find "$BASE" -type f | wc -l | tr -d " ")"
[ "$COUNT" = "18" ]
rm -rf "$DIST"
mkdir -p "$DIST"
cp -a "$BASE"/. "$DIST"/
npx cap sync android
cd "$MAIN/android"
./gradlew assembleDebug --no-daemon
APK="$MAIN/android/app/build/outputs/apk/debug/app-debug.apk"
OUT="$HOME/storage/downloads/Project-by-Tirta-V58-EXACT-GITHUB.apk"
cp -f "$APK" "$OUT"
echo "APK: $OUT"
sha256sum "$OUT"

#!/data/data/com.termux/files/usr/bin/bash

set -e

MAIN="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$MAIN/android-baseline-v58/assets/public"
MANIFEST="$MAIN/android-baseline-v58/SHA256SUMS.txt"
DIST="$MAIN/dist"
ANDROID_PUBLIC="$MAIN/android/app/src/main/assets/public"
VERIFY="$MAIN/android-baseline-v58/.verify"
OUT="$HOME/storage/downloads/Project-by-Tirta-V58-EXACT-GITHUB.apk"

echo "============================================================"
echo " PROJECT BY TIRTA"
echo " ANDROID V58 EXACT BUILD"
echo "============================================================"

cd "$MAIN"

echo
echo "== 1. VERIFY EXACT BASELINE =="

test -d "$BASE"
test -f "$MANIFEST"

COUNT="$(find "$BASE" -type f | wc -l | tr -d " ")"
echo "Baseline files: $COUNT"

if [ "$COUNT" != "18" ]; then
    echo "ERROR: baseline harus berisi 18 file."
    exit 1
fi

(
    cd "$BASE"
    sha256sum -c "$MANIFEST"
)

echo "OK: baseline valid."

echo
echo "== 2. RECREATE DIST FROM EXACT BASELINE =="

rm -rf "$DIST"
mkdir -p "$DIST"
cp -a "$BASE"/. "$DIST"/

DIST_COUNT="$(find "$DIST" -type f | wc -l | tr -d " ")"

echo "DIST files: $DIST_COUNT"

if [ "$DIST_COUNT" != "18" ]; then
    echo "ERROR: DIST bukan 18 file."
    exit 1
fi

echo
echo "== 3. CAPACITOR SYNC =="

npx cap sync android

echo
echo "== 4. VERIFY ANDROID ASSETS =="

test -d "$ANDROID_PUBLIC"

ANDROID_COUNT="$(find "$ANDROID_PUBLIC" -type f | wc -l | tr -d " ")"

echo "Android files: $ANDROID_COUNT"

if [ "$ANDROID_COUNT" != "18" ]; then
    echo "ERROR: Android assets/public bukan 18 file."
    exit 1
fi

mkdir -p "$VERIFY"

rm -f "$VERIFY/baseline.sha" "$VERIFY/android.sha"

(
    cd "$BASE"
    find . -type f -print0 |
    sort -z |
    xargs -0 sha256sum
) > "$VERIFY/baseline.sha"

(
    cd "$ANDROID_PUBLIC"
    find . -type f -print0 |
    sort -z |
    xargs -0 sha256sum
) > "$VERIFY/android.sha"

if ! diff -u "$VERIFY/baseline.sha" "$VERIFY/android.sha"; then
    echo "ERROR: Android assets/public berbeda dari baseline."
    exit 1
fi

echo "OK: Android assets/public 100% IDENTIK."

echo
echo "== 5. BUILD APK =="

if [ -f "$MAIN/android/local.properties" ]; then
    echo "SDK: android/local.properties"
elif [ -n "${ANDROID_HOME:-}" ]; then
    echo "SDK: ANDROID_HOME=$ANDROID_HOME"
else
    echo "ERROR: Android SDK belum dikonfigurasi."
    echo "Set ANDROID_HOME atau buat android/local.properties."
    exit 1
fi

cd "$MAIN/android"

./gradlew assembleDebug --no-daemon

APK="$MAIN/android/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$APK" ]; then
    echo "ERROR: APK hasil build tidak ditemukan."
    exit 1
fi

cp -f "$APK" "$OUT"

echo
echo "============================================================"
echo " BUILD BERHASIL"
echo "============================================================"
echo
echo "APK:"
echo "$OUT"
echo
ls -lh "$OUT"
echo
sha256sum "$OUT"
echo "============================================================"

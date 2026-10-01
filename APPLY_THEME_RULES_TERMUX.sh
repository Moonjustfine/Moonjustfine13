#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Project: $ROOT"
echo "Theme rule:"
echo "  - Aurora Glass = global (Super Admin/HR + Karyawan)"
echo "  - Professional HRIS = HR/Admin only"
echo ""

node scripts/audit-theme.mjs
node scripts/audit-database.mjs
node scripts/audit-pwa.mjs
node scripts/audit-translations.mjs
node scripts/audit-professional-release.mjs
node scripts/audit-presentation.mjs

if [ -d node_modules ]; then
  npm run build
else
  echo "node_modules belum ada. Jalankan: npm ci && npm run build"
fi

echo ""
echo "Theme scope fix selesai. Untuk APK: npx cap sync android && cd android && ./gradlew assembleDebug"

#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build-apk.sh — one command from TypeScript source to a signed, installable APK
#
#   1. bundle the React sandbox into a classic IIFE + CSS pair (app/src → app/www)
#   2. stage it into the apktool project (android/assets/www)
#   3. apktool assembles classes.dex (smali) + resources + assets
#   4. tools/sign_apk.py adds an APK Signature Scheme v2 block
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${TOOLCHAIN_DIR:-$HOME/.cache/ant-colony-toolchain}"
JAVA="$DEST/jdk/bin/java"
APKTOOL="$DEST/apktool.jar"
PYTHON="$DEST/venv/bin/python"
OUT_DIR="$ROOT/dist"
APK_NAME="Ant-Colony-Scent-Painting.apk"

if [ ! -x "$JAVA" ] || [ ! -f "$APKTOOL" ] || [ ! -x "$PYTHON" ]; then
  echo "Toolchain missing — running tools/fetch-toolchain.sh"
  "$ROOT/tools/fetch-toolchain.sh"
fi

echo "▸ 1/4  bundling web sandbox"
cd "$ROOT/app"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi
npm run build --silent

echo "▸ 2/4  staging assets into apktool project"
rm -rf "$ROOT/android/assets/www"
mkdir -p "$ROOT/android/assets/www"
cp -R "$ROOT/app/www/." "$ROOT/android/assets/www/"

echo "▸ 3/4  apktool build (smali → dex, aapt resources)"
mkdir -p "$ROOT/build"
"$JAVA" -jar "$APKTOOL" b "$ROOT/android" -o "$ROOT/build/ant-colony-unsigned.apk"

echo "▸ 4/4  signing (APK Signature Scheme v2)"
mkdir -p "$OUT_DIR"
"$PYTHON" "$ROOT/tools/sign_apk.py" \
  "$ROOT/build/ant-colony-unsigned.apk" \
  "$OUT_DIR/$APK_NAME" \
  --key "$ROOT/android/signing/ant-colony.key.pem" \
  --cert "$ROOT/android/signing/ant-colony.cert.pem"

ls -lh "$OUT_DIR/$APK_NAME"
echo "✓ built $OUT_DIR/$APK_NAME"

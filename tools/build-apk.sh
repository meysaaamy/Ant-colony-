#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build-apk.sh — one command from TypeScript source to a signed, installable APK
#
#   1. bundle the React sandbox into a classic IIFE + CSS pair (app/src → app/www)
#   2. stage it into the apktool project (android/assets/www)
#   3. assemble: apktool (smali → dex, aapt resources) with a direct-aapt
#      fallback for sandboxes where the JVM may not fork child processes
#   4. tools/sign_apk.py zip-aligns and signs v1 (JAR) + v2 (APK Signature Scheme)
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
export PATH="$DEST/jdk/bin:$PATH"   # apktool shells out to a bare `java`
set +e
"$JAVA" -jar "$APKTOOL" b "$ROOT/android" -o "$ROOT/build/ant-colony-unsigned.apk" \
  > "$ROOT/build/apktool.log" 2>&1
APKTOOL_STATUS=$?
set -e
tail -3 "$ROOT/build/apktool.log" | sed 's/^/  /'

if [ "$APKTOOL_STATUS" -ne 0 ] || [ ! -s "$ROOT/build/ant-colony-unsigned.apk" ]; then
  # Some sandboxes forbid the JVM from forking, which breaks apktool's aapt
  # invocation. Its smali → dex step is in-process and still succeeds, so we
  # package resources with aapt directly and drop that dex in.
  echo "  ⚠ apktool could not finish — falling back to direct aapt packaging"
  if [ ! -f "$ROOT/android/build/apk/classes.dex" ]; then
    echo "  ✗ classes.dex was not produced either; cannot continue" >&2
    exit 1
  fi
  "$PYTHON" "$ROOT/tools/package_apk.py" --project "$ROOT/android" \
    --out "$ROOT/build/ant-colony-unsigned.apk" --aapt "$DEST/aapt_64"
fi

echo "▸ 4/4  aligning + signing (v1 JAR + v2 APK Signature Scheme)"
mkdir -p "$OUT_DIR"
"$PYTHON" "$ROOT/tools/sign_apk.py" \
  "$ROOT/build/ant-colony-unsigned.apk" \
  "$OUT_DIR/$APK_NAME" \
  --key "$ROOT/android/signing/ant-colony.key.pem" \
  --cert "$ROOT/android/signing/ant-colony.cert.pem"

ls -lh "$OUT_DIR/$APK_NAME"
echo "✓ built $OUT_DIR/$APK_NAME"

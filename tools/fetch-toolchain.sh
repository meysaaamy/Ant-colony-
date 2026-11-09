#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fetch-toolchain.sh — provision a Java runtime + apktool without Android SDK
#
# The sandbox has no Android SDK (dl.google.com is unreachable) and no JDK.
# Everything below is reachable from the allowed package mirrors:
#   • JDK 17 (JRE)  ← PyPI wheel `jdk4py`
#   • apktool       ← npm tarball `apktool-jar` (ships the real apktool jar)
#
# Install location defaults to ~/.cache/ant-colony-toolchain (outside the repo).
# ---------------------------------------------------------------------------
set -euo pipefail

DEST="${TOOLCHAIN_DIR:-$HOME/.cache/ant-colony-toolchain}"
mkdir -p "$DEST"

if [ ! -x "$DEST/jdk/bin/java" ]; then
  echo "→ fetching JDK 17 (jdk4py) from PyPI…"
  python3 -m pip download --no-deps --quiet -d "$DEST/dl" "jdk4py==17.0.9.2"
  python3 - "$DEST" <<'PY'
import glob, os, shutil, sys, zipfile
dest = sys.argv[1]
wheel = glob.glob(os.path.join(dest, "dl", "jdk4py-*.whl"))[0]
with zipfile.ZipFile(wheel) as z:
    z.extractall(os.path.join(dest, "_jdk"))
src = os.path.join(dest, "_jdk", "jdk4py", "java-runtime")
target = os.path.join(dest, "jdk")
if os.path.exists(target):
    shutil.rmtree(target)
shutil.move(src, target)
shutil.rmtree(os.path.join(dest, "_jdk"), ignore_errors=True)
print("  java runtime →", target)
PY
  chmod +x "$DEST/jdk/bin/"* || true
fi

if [ ! -f "$DEST/apktool.jar" ]; then
  echo "→ fetching apktool from npm…"
  curl -sSL "https://registry.npmjs.org/apktool-jar/-/apktool-jar-2.4.1.tgz" -o "$DEST/apktool.tgz"
  tar -xzf "$DEST/apktool.tgz" -C "$DEST"
  cp "$DEST/package/bin/apktool_2.4.1.jar" "$DEST/apktool.jar"
  rm -rf "$DEST/package" "$DEST/apktool.tgz"
  echo "  apktool → $DEST/apktool.jar"
fi

# aapt: apktool bundles it, but the JVM cannot always fork, so keep a copy we
# can execute directly (used by tools/package_apk.py).
if [ ! -x "$DEST/aapt_64" ]; then
  echo "→ extracting aapt from the apktool jar…"
  unzip -o -q -j "$DEST/apktool.jar" "prebuilt/linux/aapt_64" -d "$DEST"
  chmod +x "$DEST/aapt_64"
fi

# Python venv with `cryptography` for the signer
if [ ! -x "$DEST/venv/bin/python" ]; then
  echo "→ creating signing venv (cryptography)…"
  python3 -m venv "$DEST/venv"
  "$DEST/venv/bin/pip" install --quiet --upgrade pip
  "$DEST/venv/bin/pip" install --quiet cryptography
fi

"$DEST/jdk/bin/java" -version 2>&1 | head -1
"$DEST/jdk/bin/java" -jar "$DEST/apktool.jar" --version | sed 's/^/apktool /'
echo "✓ toolchain ready at $DEST"

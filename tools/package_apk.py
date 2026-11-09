#!/usr/bin/env python3
"""
package_apk.py — assemble the APK without letting Apache apktool spawn aapt.

Why this exists
---------------
apktool builds resources by extracting `aapt` to a temp file and executing it.
Some sandboxes (including this one) forbid the JVM from forking child processes,
so apktool dies with:

    AndrolibException: could not exec: [/tmp/brut_util_Jar_…tmp, p, …]

The JVM still compiles smali → `android/build/apk/classes.dex` fine (that step
is in-process), and aapt itself runs perfectly when launched from Python. So we
drive aapt ourselves and assemble the archive from its output plus that dex.

Pipeline
    1. aapt package  → manifest + resources.arsc + res/ + assets/  (aapt-native)
    2. prepend classes.dex (compiled by apktool from smali/)
    3. write build/ant-colony-unsigned.apk (tools/sign_apk.py aligns + signs)

Usage
    python3 tools/package_apk.py --project android --out build/ant-colony-unsigned.apk
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile


def find_aapt(hint: str | None) -> str:
    """Locate an aapt binary: explicit hint, toolchain cache, or PATH."""
    candidates: list[str] = []
    if hint:
        candidates.append(hint)
    toolchain = os.environ.get(
        "TOOLCHAIN_DIR", os.path.expanduser("~/.cache/ant-colony-toolchain")
    )
    candidates += [
        os.path.join(toolchain, "aapt_64"),
        os.path.join(toolchain, "aapt"),
    ]
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    found = shutil.which("aapt")
    if found:
        return found
    raise SystemExit(
        "aapt not found. Run tools/fetch-toolchain.sh (it extracts aapt from "
        "the apktool jar) or pass --aapt."
    )


def find_framework(hint: str | None) -> str:
    """Locate framework-res (needed by aapt -I)."""
    toolchain = os.environ.get(
        "TOOLCHAIN_DIR", os.path.expanduser("~/.cache/ant-colony-toolchain")
    )
    candidates = [
        hint,
        os.path.join(toolchain, "framework", "1.apk"),
        os.path.expanduser("~/.local/share/apktool/framework/1.apk"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    raise SystemExit(
        "framework-res.apk not found. apktool keeps it at\n"
        "  ~/.local/share/apktool/framework/1.apk\n"
        "Populate it once with `apktool if android-framework.apk` (or on a "
        "machine where apktool can build, the first build does it)."
    )


def read_manifest_version(project: str) -> tuple[str, str]:
    """versionCode / versionName from apktool.yml (falls back to 1 / 1.0)."""
    yml = os.path.join(project, "apktool.yml")
    code, name = "1", "1.0"
    if os.path.isfile(yml):
        text = open(yml, encoding="utf-8").read()
        m = re.search(r"""versionCode:\s*['"]?(\d+)['"]?""", text)
        if m:
            code = m.group(1)
        m = re.search(r"""versionName:\s*['"]?([^'"\n]+)['"]?""", text)
        if m:
            name = m.group(1).strip()
    return code, name


def read_sdk(project: str) -> tuple[str, str]:
    yml = os.path.join(project, "apktool.yml")
    min_sdk, target_sdk = "21", "34"
    if os.path.isfile(yml):
        text = open(yml, encoding="utf-8").read()
        m = re.search(r"""minSdkVersion:\s*['"]?(\d+)['"]?""", text)
        if m:
            min_sdk = m.group(1)
        m = re.search(r"""targetSdkVersion:\s*['"]?(\d+)['"]?""", text)
        if m:
            target_sdk = m.group(1)
    return min_sdk, target_sdk


def main() -> int:
    ap = argparse.ArgumentParser(description="Package the apktool project with aapt directly")
    ap.add_argument("--project", default="android")
    ap.add_argument("--out", default="build/ant-colony-unsigned.apk")
    ap.add_argument("--aapt")
    ap.add_argument("--framework")
    ap.add_argument("--dex", default=None, help="defaults to <project>/build/apk/classes.dex")
    args = ap.parse_args()

    project = args.project
    aapt = find_aapt(args.aapt)
    framework = find_framework(args.framework)
    dex = args.dex or os.path.join(project, "build", "apk", "classes.dex")
    if not os.path.isfile(dex):
        raise SystemExit(f"classes.dex missing at {dex} — run `apktool b` first (it builds dex in-process)")

    ver_code, ver_name = read_manifest_version(project)
    min_sdk, target_sdk = read_sdk(project)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "base.apk")
        cmd = [
            aapt, "package", "-f",
            "-M", os.path.join(project, "AndroidManifest.xml"),
            "-S", os.path.join(project, "res"),
            "-I", framework,
            "-A", os.path.join(project, "assets"),
            "-F", base,
            "--min-sdk-version", min_sdk,
            "--target-sdk-version", target_sdk,
            "--version-code", ver_code,
            "--version-name", ver_name,
            "--forced-package-id", "127",
            "-0", "arsc",
            "--no-version-vectors",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        if result.returncode != 0 or not os.path.isfile(base):
            raise SystemExit(f"aapt package failed (exit {result.returncode})")

        with zipfile.ZipFile(base) as zin, zipfile.ZipFile(args.out, "w") as zout:
            zout.write(dex, "classes.dex", compress_type=zipfile.ZIP_DEFLATED)
            for info in zin.infolist():
                zout.writestr(info, zin.read(info.filename))

    size = os.path.getsize(args.out)
    print(
        f"packaged {args.out} ({size} bytes) — "
        f"minSdk {min_sdk}, targetSdk {target_sdk}, v{ver_name} ({ver_code})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

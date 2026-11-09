#!/usr/bin/env python3
"""
sign_apk.py — dependency-light APK signer: zipalign + v1 (JAR) + v2 block.

Why this exists
---------------
This sandbox has no Android SDK / build-tools (dl.google.com is unreachable), so
`zipalign` and `apksigner` are unavailable. Both are self-contained formats, so
we implement them directly:

  1. zipalign   — rebuild the archive so every STORED entry starts on a 4-byte
                  boundary (4096 for .so). Android 11+ is strict about this and
                  Play refuses misaligned APKs.
  2. v1 (JAR)   — META-INF/MANIFEST.MF + CERT.SF + CERT.RSA (PKCS#7). Required
                  by pre-7.0 devices and by several OEM package installers even
                  on modern Android.
  3. v2         — APK Signature Scheme v2 block (chunked SHA-256 over the three
                  archive sections), which Android 7.0+ verifies instead.

Reference: https://source.android.com/docs/security/features/apksigning

Usage:
    python3 sign_apk.py unsigned.apk signed.apk --key key.pem --cert cert.pem
    python3 sign_apk.py unsigned.apk fallback.apk --key … --cert … --v1-only

Keys are created on first run if they do not exist (self-signed, 30 years).
"""

from __future__ import annotations

import argparse
import base64
import datetime
import hashlib
import os
import struct
import sys
import zlib

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import pkcs7
from cryptography.x509.oid import NameOID

MAGIC = b"APK Sig Block 42"
V2_BLOCK_ID = 0x7109871A
ALGO_RSA_PKCS1_SHA256 = 0x0103
CHUNK = 1024 * 1024
EOCD_SIG = b"PK\x05\x06"
CD_SIG = b"PK\x01\x02"
LOCAL_SIG = b"PK\x03\x04"

ALIGN_BYTES = 4
ALIGN_SO = 4096


# --------------------------------------------------------------------------- #
# v2 — APK Signature Scheme v2
# --------------------------------------------------------------------------- #
def lp(payload: bytes) -> bytes:
    """uint32 little-endian length prefix."""
    return struct.pack("<I", len(payload)) + payload


def find_eocd(data: bytes) -> int:
    start = max(0, len(data) - (0xFFFF + 22))
    idx = data.rfind(EOCD_SIG, start)
    if idx < 0:
        raise ValueError("EOCD record not found — not a valid zip/apk")
    return idx


def _chunk_digests(section: bytes) -> list[bytes]:
    """1 MB chunk digests for one contiguous APK section (0xa5 || len || data)."""
    out = []
    for off in range(0, len(section), CHUNK):
        chunk = section[off : off + CHUNK]
        out.append(hashlib.sha256(b"\xa5" + struct.pack("<I", len(chunk)) + chunk).digest())
    return out


def content_digest(sections: list[bytes]) -> bytes:
    """
    CHUNKED_SHA256 content digest (APK Signature Scheme v2).

    Chunking restarts at each of the three signed sections (contents up to the
    central directory, the central directory, the EOCD), which is what
    apksigner does — verified against a production v2-signed APK.
    """
    digests: list[bytes] = []
    for section in sections:
        digests.extend(_chunk_digests(section))
    top = hashlib.sha256()
    top.update(b"\x5a")
    top.update(struct.pack("<I", len(digests)))
    for d in digests:
        top.update(d)
    return top.digest()


def add_v2_block(unsigned: bytes, key, cert) -> bytes:
    eocd_off = find_eocd(unsigned)
    cd_size = struct.unpack_from("<I", unsigned, eocd_off + 12)[0]
    cd_offset = struct.unpack_from("<I", unsigned, eocd_off + 16)[0]

    if cd_offset + cd_size > eocd_off:
        raise ValueError("central directory overlaps EOCD — refusing to sign")

    entries = unsigned[:cd_offset]
    central_dir = unsigned[cd_offset : cd_offset + cd_size]
    eocd = bytearray(unsigned[eocd_off:])

    # Digest covers entries + central directory + EOCD, with the EOCD's
    # central-directory offset pointing at the signing block.
    struct.pack_into("<I", eocd, 16, cd_offset)
    digest = content_digest([entries, central_dir, bytes(eocd)])

    cert_der = cert.public_bytes(serialization.Encoding.DER)
    digest_record = struct.pack("<I", ALGO_RSA_PKCS1_SHA256) + lp(digest)
    signed_data = lp(lp(digest_record)) + lp(lp(cert_der)) + lp(b"")

    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signature_record = struct.pack("<I", ALGO_RSA_PKCS1_SHA256) + lp(signature)
    public_key = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )

    signer = lp(signed_data) + lp(lp(signature_record)) + lp(public_key)
    v2_value = lp(lp(signer))
    pair = struct.pack("<Q", 4 + len(v2_value)) + struct.pack("<I", V2_BLOCK_ID) + v2_value
    block_size = len(pair) + 8 + 16
    block = struct.pack("<Q", block_size) + pair + struct.pack("<Q", block_size) + MAGIC

    new_eocd = bytearray(eocd)
    struct.pack_into("<I", new_eocd, 16, cd_offset + len(block))
    return entries + block + central_dir + bytes(new_eocd)


# --------------------------------------------------------------------------- #
# zip reading / aligned writing
# --------------------------------------------------------------------------- #
class Entry:
    __slots__ = ("name", "data", "method", "date_time", "external_attr", "create_system")

    def __init__(self, name, data, method, date_time, external_attr, create_system=0):
        self.name = name
        self.data = data
        self.method = method  # 0 = store, 8 = deflate
        self.date_time = date_time
        self.external_attr = external_attr
        self.create_system = create_system

    @property
    def align(self) -> int:
        return ALIGN_SO if self.name.endswith(".so") else ALIGN_BYTES


def read_zip(path: str) -> list[Entry]:
    import zipfile

    out: list[Entry] = []
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            out.append(
                Entry(
                    name=info.filename,
                    data=z.read(info.filename),
                    method=8 if info.compress_type == zipfile.ZIP_DEFLATED else 0,
                    date_time=info.date_time,
                    external_attr=info.external_attr,
                    create_system=info.create_system,
                )
            )
    return out


def _dos_time(date_time) -> tuple[int, int]:
    import time as _time

    t = _time.mktime(tuple(date_time) + (0, 0, -1))
    dt = _time.localtime(t)
    dos_time = (dt.tm_hour << 11) | (dt.tm_min << 5) | (dt.tm_sec // 2)
    dos_date = ((dt.tm_year - 1980) << 9) | (dt.tm_mon << 5) | dt.tm_mday
    return dos_time, dos_date


def build_aligned_zip(entries: list[Entry]) -> bytes:
    """
    Write a zip where every STORED entry's payload starts on its alignment
    boundary, using a single padding extra field (the same trick zipalign uses).
    """
    body = bytearray()
    central = bytearray()
    count = 0

    for e in entries:
        raw = e.data
        if e.method == 8:
            co = zlib.compressobj(9, zlib.DEFLATED, -15)
            payload = co.compress(raw) + co.flush()
        else:
            payload = raw

        crc = zlib.crc32(raw) & 0xFFFFFFFF
        name = e.name.encode("utf-8")
        dos_time, dos_date = _dos_time(e.date_time)

        # padding so that (header_start + 30 + namelen + extralen) % align == 0
        base = len(body) + 30 + len(name)
        align = e.align if e.method == 0 else 1
        extra_len = 0 if align == 1 else (-base) % align
        if extra_len and extra_len < 4:
            extra_len += align  # extra field needs a 4-byte header
        if extra_len:
            extra = struct.pack("<HH", 0x0000, extra_len - 4) + b"\x00" * (extra_len - 4)
        else:
            extra = b""

        offset = len(body)
        body += LOCAL_SIG
        body += struct.pack(
            "<HHHHHIIIHH",
            20,              # version needed
            0,               # flags
            e.method,
            dos_time,
            dos_date,
            crc,
            len(payload),
            len(raw),
            len(name),
            len(extra),
        )
        body += name + extra + payload

        central += CD_SIG
        central += struct.pack(
            "<HHHHHHIIIHHHHHII",
            (e.create_system << 8) | 20,  # version made by
            20,                           # version needed
            0,                            # flags
            e.method,
            dos_time,
            dos_date,
            crc,
            len(payload),
            len(raw),
            len(name),
            len(extra),
            0,                            # comment len
            0,                            # disk start
            0,                            # internal attrs
            e.external_attr or 0,
            offset,
        )
        central += name + extra
        count += 1

    cd_offset = len(body)
    eocd = EOCD_SIG + struct.pack(
        "<HHHHIIH",
        0, 0, count, count, len(central), cd_offset, 0,
    )
    return bytes(body + central + eocd)


# --------------------------------------------------------------------------- #
# v1 — JAR signature (MANIFEST.MF / CERT.SF / CERT.RSA)
# --------------------------------------------------------------------------- #
def _wrap(line: bytes, limit: int = 70) -> bytes:
    """JAR manifests wrap at 72 bytes; continuations start with a single space."""
    if len(line) <= limit:
        return line + b"\r\n"
    out = line[:limit] + b"\r\n"
    rest = line[limit:]
    while rest:
        out += b" " + rest[:limit - 1] + b"\r\n"
        rest = rest[limit - 1 :]
    return out


def _section_digest(name: str, data: bytes) -> bytes:
    return b"Name: " + name.encode("utf-8") + b"\r\nSHA-256-Digest: " + base64.b64encode(
        hashlib.sha256(data).digest()
    ) + b"\r\n\r\n"


def build_v1_entries(entries: list[Entry], key, cert) -> list[Entry]:
    """Create META-INF/MANIFEST.MF, META-INF/CERT.SF and META-INF/CERT.RSA."""
    now = datetime.datetime.now()

    sections = [
        _section_digest(e.name, e.data)
        for e in entries
        if not e.name.upper().startswith("META-INF/")
    ]
    manifest = b"Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android SignApk)\r\n\r\n" + b"".join(
        sections
    )

    sf = (
        b"Signature-Version: 1.0\r\n"
        b"Created-By: 1.0 (Android SignApk)\r\n"
        b"SHA-256-Digest-Manifest: "
        + base64.b64encode(hashlib.sha256(manifest).digest())
        + b"\r\n\r\n"
    )
    for e, sec in zip([e for e in entries if not e.name.upper().startswith("META-INF/")], sections):
        sf += _wrap(b"Name: " + e.name.encode("utf-8"))
        sf += _wrap(
            b"SHA-256-Digest: " + base64.b64encode(hashlib.sha256(sec).digest())
        )
        sf += b"\r\n"

    signature = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(sf)
        .add_signer(cert, key, hashes.SHA256())
        .sign(
            serialization.Encoding.DER,
            [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.Binary],
        )
    )

    stamp = now.timetuple()[:6]
    return [
        Entry("META-INF/MANIFEST.MF", manifest, 8, stamp, 0),
        Entry("META-INF/CERT.SF", sf, 8, stamp, 0),
        Entry("META-INF/CERT.RSA", signature, 8, stamp, 0),
    ]


# --------------------------------------------------------------------------- #
# keys
# --------------------------------------------------------------------------- #
def load_or_create_key(key_path: str, cert_path: str):
    if os.path.exists(key_path) and os.path.exists(cert_path):
        with open(key_path, "rb") as fh:
            key = serialization.load_pem_private_key(fh.read(), password=None)
        with open(cert_path, "rb") as fh:
            cert = x509.load_pem_x509_certificate(fh.read())
        return key, cert

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Ant Colony Sandbox"),
            x509.NameAttribute(NameOID.COMMON_NAME, "Ant Colony Scent-Painting Sandbox"),
        ]
    )
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365 * 30))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    os.makedirs(os.path.dirname(key_path) or ".", exist_ok=True)
    with open(key_path, "wb") as fh:
        fh.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
    with open(cert_path, "wb") as fh:
        fh.write(cert.public_bytes(serialization.Encoding.PEM))
    return key, cert


# --------------------------------------------------------------------------- #
# verification helpers
# --------------------------------------------------------------------------- #
def verify_alignment(data: bytes) -> list[str]:
    """Report any STORED entry whose payload is not aligned."""
    problems = []
    off = 0
    while data[off : off + 4] == LOCAL_SIG:
        (method,) = struct.unpack_from("<H", data, off + 8)
        (csize,) = struct.unpack_from("<I", data, off + 18)
        namelen, extralen = struct.unpack_from("<HH", data, off + 26)
        name = data[off + 30 : off + 30 + namelen].decode("utf-8", "replace")
        data_off = off + 30 + namelen + extralen
        if method == 0:
            align = ALIGN_SO if name.endswith(".so") else ALIGN_BYTES
            if data_off % align:
                problems.append(f"{name} at {data_off} not {align}-aligned")
        off = data_off + csize
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description="zipalign + v1/v2 sign an APK")
    ap.add_argument("unsigned")
    ap.add_argument("signed")
    ap.add_argument("--key", default="android/signing/ant-colony.key.pem")
    ap.add_argument("--cert", default="android/signing/ant-colony.cert.pem")
    ap.add_argument("--no-v1", action="store_true", help="skip the JAR (v1) signature")
    ap.add_argument(
        "--v1-only",
        action="store_true",
        help="emit no v2 block at all (fallback for installers that reject v2)",
    )
    args = ap.parse_args()

    key, cert = load_or_create_key(args.key, args.cert)
    entries = read_zip(args.unsigned)

    if not args.no_v1:
        entries = entries + build_v1_entries(entries, key, cert)

    aligned = build_aligned_zip(entries)
    problems = verify_alignment(aligned)
    if problems:
        raise SystemExit("alignment failed: " + "; ".join(problems))

    out = aligned if args.v1_only else add_v2_block(aligned, key, cert)
    with open(args.signed, "wb") as fh:
        fh.write(out)

    sig = "v1 only" if args.v1_only else ("v1+v2" if not args.no_v1 else "v2 only")
    print(
        f"Signed {args.unsigned} -> {args.signed} "
        f"({len(open(args.unsigned, 'rb').read())} -> {len(out)} bytes, {sig}, zip-aligned)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

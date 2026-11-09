#!/usr/bin/env python3
"""
sign_apk.py — minimal, dependency-light APK Signature Scheme v2 signer.

Why this exists
---------------
This sandbox has no Android SDK / build-tools (dl.google.com is unreachable), so
`apksigner` is unavailable. APK Signature Scheme v2 is a self-contained binary
format, so we implement it directly.

Reference: https://source.android.com/docs/security/features/apksigning/v2

Usage:
    python3 sign_apk.py unsigned.apk signed.apk --key key.pem --cert cert.pem

Keys are created on first run if they do not exist (self-signed, 30 years).
Only v2 is emitted; the manifest's minSdkVersion is 24, so every supported
device verifies v2 and no v1/JAR signature is required.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import os
import struct
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID

MAGIC = b"APK Sig Block 42"
V2_BLOCK_ID = 0x7109871A
ALGO_RSA_PKCS1_SHA256 = 0x0103
CHUNK = 1024 * 1024
EOCD_SIG = b"PK\x05\x06"
CD_SIG = b"PK\x01\x02"


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


def sign(unsigned: bytes, key, cert) -> bytes:
    eocd_off = find_eocd(unsigned)
    cd_size = struct.unpack_from("<I", unsigned, eocd_off + 12)[0]
    cd_offset = struct.unpack_from("<I", unsigned, eocd_off + 16)[0]

    if cd_offset + cd_size > eocd_off:
        raise ValueError("central directory overlaps EOCD — refusing to sign")

    entries = unsigned[:cd_offset]
    central_dir = unsigned[cd_offset : cd_offset + cd_size]
    eocd = bytearray(unsigned[eocd_off:])

    # The digest is computed over entries + central directory + EOCD whose
    # central-directory offset points at the signing block (i.e. cd_offset).
    struct.pack_into("<I", eocd, 16, cd_offset)
    digest = content_digest([entries, central_dir, bytes(eocd)])

    cert_der = cert.public_bytes(serialization.Encoding.DER)
    digest_record = struct.pack("<I", ALGO_RSA_PKCS1_SHA256) + lp(digest)
    digests_seq = lp(digest_record)
    certs_seq = lp(cert_der)
    attrs_seq = b""
    signed_data = lp(digests_seq) + lp(certs_seq) + lp(attrs_seq)

    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signature_record = struct.pack("<I", ALGO_RSA_PKCS1_SHA256) + lp(signature)
    signatures_seq = lp(signature_record)
    public_key = key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    signer = lp(signed_data) + lp(signatures_seq) + lp(public_key)
    # v2 block value = length-prefixed sequence of length-prefixed signers.
    v2_value = lp(lp(signer))
    pair = struct.pack("<Q", 4 + len(v2_value)) + struct.pack("<I", V2_BLOCK_ID) + v2_value
    block_size = len(pair) + 8 + 16
    block = (
        struct.pack("<Q", block_size)
        + pair
        + struct.pack("<Q", block_size)
        + MAGIC
    )

    new_eocd = bytearray(eocd)
    struct.pack_into("<I", new_eocd, 16, cd_offset + len(block))
    return entries + block + central_dir + bytes(new_eocd)


def main() -> int:
    ap = argparse.ArgumentParser(description="Sign an APK with APK Signature Scheme v2")
    ap.add_argument("unsigned")
    ap.add_argument("signed")
    ap.add_argument("--key", default="android/signing/ant-colony.key.pem")
    ap.add_argument("--cert", default="android/signing/ant-colony.cert.pem")
    args = ap.parse_args()

    key, cert = load_or_create_key(args.key, args.cert)
    with open(args.unsigned, "rb") as fh:
        data = fh.read()

    out = sign(data, key, cert)
    with open(args.signed, "wb") as fh:
        fh.write(out)
    print(f"Signed {args.unsigned} -> {args.signed} ({len(data)} -> {len(out)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

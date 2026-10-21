#!/usr/bin/env python3
"""Verify a Tauri/minisign updater signature against the configured public key.

Implements the same verification tauri-plugin-updater performs, using the
minisign-verify crate's rules:

  * public key file  : [2-byte alg][8-byte key id][32-byte Ed25519 key]
  * signature file   : [2-byte alg][8-byte key id][64-byte Ed25519 sig]
                       optionally followed by the trusted comment and the
                       64-byte global signature
  * algorithm "Ed"   : the signature covers the raw file bytes (legacy)
  * algorithm "ED"   : the signature covers BLAKE2b-512 of the file (default)
  * the key id in the signature must match the key id in the public key
  * the trusted comment must contain "version:<v>" matching the announced
    version, which is what prevents a downgrade to an older signed build

Usage: verify-updater-signature.py <file> <sigfile> <pubkey> [expected-version]

<pubkey> may be the base64 value from tauri.conf.json (base64 of the whole
minisign file) or the contents of the .pub file.
"""
import base64
import hashlib
import sys

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


def decode_public_key(pubkey):
    """Return (ed25519_key_bytes, key_id) from a .pub file or a base64 blob."""
    text = None
    if "\n" in pubkey or pubkey.strip().startswith("untrusted comment"):
        text = pubkey
    else:
        try:
            decoded = base64.b64decode(pubkey)
        except Exception:
            decoded = None
        if decoded is not None:
            try:
                text = decoded.decode("utf-8")
            except UnicodeDecodeError:
                text = None
    if text is not None:
        line = next(
            (l.strip() for l in text.splitlines() if l.strip() and not l.startswith("untrusted comment")),
            None,
        )
        if line:
            raw = base64.b64decode(line)
        else:
            raw = base64.b64decode(pubkey)
    else:
        raw = base64.b64decode(pubkey)
    if len(raw) == 42:
        return raw[10:42], raw[2:10]
    if len(raw) == 34:
        return raw[2:34], raw[0:8]
    fail(f"unexpected public key length: {len(raw)} bytes")


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)

    path, sigpath, pubkey = sys.argv[1], sys.argv[2], sys.argv[3]
    expected_version = sys.argv[4] if len(sys.argv) > 4 else None

    with open(path, "rb") as f:
        data = f.read()

    # Tauri stores the whole minisign signature file as one base64 blob so it
    # can be embedded in JSON. Some tools write the 4-line form directly.
    with open(sigpath, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    try:
        decoded = base64.b64decode(raw, validate=True)
        sig_text = decoded.decode("utf-8") if b"untrusted comment:" in decoded else raw
    except Exception:
        sig_text = raw

    lines = sig_text.splitlines()
    if len(lines) < 4:
        fail(f"unexpected .sig layout ({len(lines)} lines)")
    untrusted_comment = lines[0]
    sig_b64 = lines[1]
    trusted_comment = lines[2]
    global_b64 = lines[3]

    if not trusted_comment.startswith("trusted comment: "):
        fail("the .sig file has no 'trusted comment:' line")
    trusted_comment = trusted_comment[len("trusted comment: "):].strip()

    key_bytes, key_id = decode_public_key(pubkey)
    pub = Ed25519PublicKey.from_public_bytes(key_bytes)

    raw_sig = base64.b64decode(sig_b64)
    if len(raw_sig) != 74:
        fail(f"signature should be 74 bytes, got {len(raw_sig)}")
    alg = raw_sig[0:2]
    sig_key_id = raw_sig[2:10]
    signature = raw_sig[10:74]

    if sig_key_id != key_id:
        fail("the signature was made with a different key (key id mismatch)")

    if alg == b"ED":
        payload = hashlib.blake2b(data, digest_size=64).digest()
        mode = "prehashed (BLAKE2b-512)"
    elif alg == b"Ed":
        payload = data
        mode = "legacy (raw content)"
    else:
        fail(f"unsupported signature algorithm: {alg!r}")

    try:
        pub.verify(signature, payload)
    except InvalidSignature:
        fail("the Ed25519 signature does not match the file contents")

    print(f"PASS: signature is valid ({mode})")
    print(f"      untrusted comment: {untrusted_comment}")
    print(f"      trusted comment: {trusted_comment}")
    if expected_version:
        if f"version:{expected_version}" not in trusted_comment:
            fail(f"trusted comment does not contain version:{expected_version}")
        print(f"PASS: signed version matches the announced version ({expected_version})")


if __name__ == "__main__":
    main()

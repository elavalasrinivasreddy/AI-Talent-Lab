"""
backend/utils/crypto.py — AES-256-GCM field encryption for sensitive data (e.g. CTC).

Usage:
    from backend.utils.crypto import encrypt_field, decrypt_field

When ``ENCRYPTION_KEY`` is empty, both functions are transparent no-ops so the
feature can be deployed without the key and enabled later by setting the env var.
"""

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _derive_key(key: str) -> bytes:
    """SHA-256 hash the key string to get exactly 32 bytes for AES-256."""
    return hashlib.sha256(key.encode()).digest()


def encrypt_field(plaintext: str, key: str) -> str:
    """AES-256-GCM encrypt a string value.

    Returns base64(nonce + ciphertext_with_tag) as a single string.
    No-op (returns plaintext unchanged) when *key* is empty or None.
    """
    if not key:
        return plaintext

    raw_key = _derive_key(key)
    aesgcm = AESGCM(raw_key)
    nonce = os.urandom(12)  # 96-bit nonce — standard for GCM
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext.encode(), None)
    blob = nonce + ciphertext_with_tag
    return base64.b64encode(blob).decode()


def decrypt_field(ciphertext_b64: str, key: str) -> str:
    """Decrypt a value produced by :func:`encrypt_field`.

    No-op (returns *ciphertext_b64* unchanged) when *key* is empty or None.
    Raises ``ValueError`` if the blob is malformed or the key is wrong.
    """
    if not key:
        return ciphertext_b64

    raw_key = _derive_key(key)
    aesgcm = AESGCM(raw_key)
    blob = base64.b64decode(ciphertext_b64)
    nonce = blob[:12]
    ciphertext_with_tag = blob[12:]
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext_with_tag, None)
    return plaintext_bytes.decode()

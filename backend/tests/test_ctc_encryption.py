"""
tests/test_ctc_encryption.py — AES-256-GCM CTC field encryption tests.

Covers:
  - encrypt/decrypt round-trip
  - no-op behaviour when key is empty
  - nonce uniqueness (same plaintext → different ciphertexts)
  - integration: store encrypted compensation in candidate_applications, read back and decrypt
"""

import json
import pytest
import pytest_asyncio
import asyncpg

from backend.utils.crypto import encrypt_field, decrypt_field


# ── Unit tests ────────────────────────────────────────────────────────────────

def test_encrypt_decrypt_roundtrip():
    key = "super-secret-test-key"
    plaintext = '{"current": 1200000, "expected": 1500000, "declined": false}'
    ciphertext = encrypt_field(plaintext, key)
    assert ciphertext != plaintext
    recovered = decrypt_field(ciphertext, key)
    assert recovered == plaintext


def test_no_op_when_key_empty():
    plaintext = '{"current": 800000, "expected": 1000000, "declined": false}'
    # encrypt with empty key → unchanged
    result = encrypt_field(plaintext, "")
    assert result == plaintext
    # decrypt with empty key → unchanged
    result2 = decrypt_field(plaintext, "")
    assert result2 == plaintext


def test_no_op_when_key_none():
    plaintext = "sensitive-data"
    assert encrypt_field(plaintext, None) == plaintext   # type: ignore[arg-type]
    assert decrypt_field(plaintext, None) == plaintext   # type: ignore[arg-type]


def test_different_nonces():
    """Same plaintext + key must produce different ciphertexts (random nonce)."""
    key = "nonce-test-key"
    plaintext = "repeat me"
    ct1 = encrypt_field(plaintext, key)
    ct2 = encrypt_field(plaintext, key)
    assert ct1 != ct2
    # Both must decrypt correctly though
    assert decrypt_field(ct1, key) == plaintext
    assert decrypt_field(ct2, key) == plaintext


def test_wrong_key_raises():
    key = "correct-key"
    plaintext = "secret-value"
    ciphertext = encrypt_field(plaintext, key)
    with pytest.raises(Exception):
        decrypt_field(ciphertext, "wrong-key")


# ── Integration tests ─────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def _seeded_application(db_pool):
    """Seed the minimum rows needed for a candidate_applications entry and yield its id."""
    async with db_pool.acquire() as conn:
        # org
        org_id = await conn.fetchval(
            """
            INSERT INTO organizations (name, slug, segment, size)
            VALUES ('CryptoTestOrg', 'crypto-test-org', 'startup', 'small')
            ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
            """
        )
        # dept
        dept_id = await conn.fetchval(
            """
            INSERT INTO departments (org_id, name)
            VALUES ($1, 'Engineering')
            ON CONFLICT (org_id, name) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
            """,
            org_id,
        )
        # user (created_by for position)
        user_id = await conn.fetchval(
            """
            INSERT INTO users (org_id, email, password_hash, role, name)
            VALUES ($1, 'crypto-hr@test.com', 'hash', 'hr', 'Crypto HR')
            ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
            """,
            org_id,
        )
        # position
        pos_id = await conn.fetchval(
            """
            INSERT INTO positions (org_id, department_id, role_name, created_by)
            VALUES ($1, $2, 'Backend Engineer', $3)
            RETURNING id
            """,
            org_id, dept_id, user_id,
        )
        # candidate
        cand_id = await conn.fetchval(
            """
            INSERT INTO candidates (org_id, name, email)
            VALUES ($1, 'Alice Candidate', 'alice-crypto@test.com')
            ON CONFLICT (org_id, email) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
            """,
            org_id,
        )
        # application (no compensation_enc yet)
        app_id = await conn.fetchval(
            """
            INSERT INTO candidate_applications (candidate_id, position_id, org_id, department_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (candidate_id, position_id) DO UPDATE SET updated_at=NOW()
            RETURNING id
            """,
            cand_id, pos_id, org_id, dept_id,
        )
    yield {"app_id": app_id, "org_id": org_id, "cand_id": cand_id, "pos_id": pos_id}


@pytest.mark.asyncio
async def test_compensation_stored_and_retrieved(_seeded_application, db_pool):
    """Store encrypted compensation, read it back, decrypt, verify values match."""
    app_id = _seeded_application["app_id"]
    org_id = _seeded_application["org_id"]

    key = "integration-test-key-abc123"
    original = {"current": 1800000, "expected": 2200000, "declined": False}
    compensation_json = json.dumps(original)
    compensation_enc = encrypt_field(compensation_json, key)

    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE candidate_applications SET compensation_enc=$1 WHERE id=$2 AND org_id=$3",
            compensation_enc, app_id, org_id,
        )
        row = await conn.fetchrow(
            "SELECT compensation_enc FROM candidate_applications WHERE id=$1",
            app_id,
        )

    assert row is not None
    stored = row["compensation_enc"]
    # Must not equal plaintext (i.e. it is encrypted)
    assert stored != compensation_json

    decrypted_json = decrypt_field(stored, key)
    recovered = json.loads(decrypted_json)
    assert recovered["current"] == original["current"]
    assert recovered["expected"] == original["expected"]
    assert recovered["declined"] == original["declined"]


@pytest.mark.asyncio
async def test_no_op_key_stores_plaintext(_seeded_application, db_pool):
    """When key is empty, compensation_enc stores plaintext JSON as-is."""
    app_id = _seeded_application["app_id"]
    org_id = _seeded_application["org_id"]

    original = {"current": None, "expected": 1000000, "declined": False}
    compensation_json = json.dumps(original)
    # no-op encryption
    stored_value = encrypt_field(compensation_json, "")
    assert stored_value == compensation_json

    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE candidate_applications SET compensation_enc=$1 WHERE id=$2 AND org_id=$3",
            stored_value, app_id, org_id,
        )
        row = await conn.fetchrow(
            "SELECT compensation_enc FROM candidate_applications WHERE id=$1",
            app_id,
        )

    stored = row["compensation_enc"]
    # decrypt with empty key is also a no-op
    recovered = json.loads(decrypt_field(stored, ""))
    assert recovered["expected"] == 1000000

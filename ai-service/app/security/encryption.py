"""Biometric Template AES-256-GCM Authenticated Encryption / Decryption."""
import os
import base64
import json
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

from app.utils.exceptions import BiometricDecryptionError

def get_cipher_key(secret_string: str) -> bytes:
    """Derive a consistent 32-byte (256-bit) key from the secret string."""
    return hashlib.sha256(secret_string.encode("utf-8")).digest()

def encrypt_biometric_template(template_data: dict, secret_key: str) -> str:
    """
    Encrypt biometric template JSON with AES-256-GCM.
    Returns base64-encoded string: nonce (12 bytes) + ciphertext + tag (16 bytes).
    """
    if not secret_key:
        raise ValueError("Encryption secret key is required")
    key = get_cipher_key(secret_key)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    serialized_payload = json.dumps(template_data).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, serialized_payload, None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")

def decrypt_biometric_template(encrypted_base64: str, secret_key: str) -> dict:
    """
    Decrypt base64-encoded AES-256-GCM ciphertext.
    Returns original dictionary payload.
    Raises BiometricDecryptionError if key is incorrect or data is tampered with.
    """
    if not encrypted_base64:
        raise BiometricDecryptionError("Encrypted payload is missing or empty")

    if not secret_key:
        raise BiometricDecryptionError("Decryption secret key is missing")

    try:
        raw_data = base64.b64decode(encrypted_base64.encode("utf-8"))
    except Exception as e:
        raise BiometricDecryptionError(f"Malformed base64 ciphertext: {str(e)}")

    if len(raw_data) < 28: # 12 bytes nonce + 16 bytes auth tag minimum
        raise BiometricDecryptionError("Encrypted payload length is invalid (minimum 28 bytes required)")

    nonce = raw_data[:12]
    ciphertext = raw_data[12:]
    key = get_cipher_key(secret_key)
    aesgcm = AESGCM(key)

    try:
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    except InvalidTag:
        raise BiometricDecryptionError("Decryption authentication failed: Invalid authentication tag (tampered ciphertext or invalid secret key)")
    except Exception as e:
        raise BiometricDecryptionError(f"Decryption failure: {str(e)}")

    try:
        return json.loads(decrypted_bytes.decode("utf-8"))
    except Exception as e:
        raise BiometricDecryptionError(f"Decrypted payload serialization error: {str(e)}")

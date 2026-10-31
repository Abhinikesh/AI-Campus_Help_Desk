"""
Session Challenge Service — generates and validates short-lived session challenge tokens.

Used to bind the face verification attempt to a specific session instance,
providing a lightweight defence against replay attacks where a previously
captured verification image is re-submitted.

Design decisions:
  - HMAC-SHA256 over (session_id + student_id + timestamp bucket) with the
    internal secret key prevents forgery without a cryptographic oracle.
  - 90-second time buckets allow the client some grace for network latency
    while keeping the window short enough to deter replay.
  - The service is stateless (no database calls). Node.js generates the
    expected challenge from the same inputs and sends it alongside the
    live image payload.  The Python service just verifies the MAC.

Limitations:
  - HMAC-based challenges are NOT liveness detection.  They bind the
    verification call to a specific session but cannot confirm the image
    was captured at that instant.  Faculty supervision and short
    session windows are essential additional controls.
"""
import hmac
import hashlib
import time
import math
from typing import Optional

from app.config import Config


def _time_bucket(window_seconds: int = 90) -> int:
    """Return an integer bucket index that changes every `window_seconds`."""
    return math.floor(time.time() / window_seconds)


def generate_session_challenge(
    session_id: str,
    student_id: str,
    secret_key: Optional[str] = None,
    window_seconds: int = 90,
) -> str:
    """
    Generate a short-lived, session-bound HMAC challenge token.

    Args:
        session_id:      The AttendanceSession _id string.
        student_id:      The authenticated student's _id string.
        secret_key:      HMAC secret (defaults to INTERNAL_API_KEY from Config).
        window_seconds:  Validity window in seconds (default: 90 s).

    Returns:
        A 16-character hex string derived from HMAC-SHA256.
    """
    key = (secret_key or Config.INTERNAL_API_KEY).encode("utf-8")
    bucket = _time_bucket(window_seconds)
    message = f"{session_id}:{student_id}:{bucket}".encode("utf-8")
    raw_hmac = hmac.new(key, message, hashlib.sha256).hexdigest()
    return raw_hmac[:16]


def validate_session_challenge(
    provided_challenge: str,
    session_id: str,
    student_id: str,
    secret_key: Optional[str] = None,
    window_seconds: int = 90,
    allow_previous_bucket: bool = True,
) -> bool:
    """
    Verify that the provided challenge matches the current or previous bucket.

    Args:
        provided_challenge:    Challenge token from the request.
        session_id:            Session identifier.
        student_id:            Authenticated student identifier.
        secret_key:            HMAC secret.
        window_seconds:        Bucket size in seconds.
        allow_previous_bucket: If True, also accept the immediately preceding
                               bucket to tolerate clock skew and slow uploads.

    Returns:
        True if the challenge is valid, False otherwise.
    """
    if not provided_challenge or not session_id or not student_id:
        return False

    expected_current = generate_session_challenge(
        session_id, student_id, secret_key, window_seconds
    )
    if hmac.compare_digest(provided_challenge, expected_current):
        return True

    if allow_previous_bucket:
        key = (secret_key or Config.INTERNAL_API_KEY).encode("utf-8")
        bucket = _time_bucket(window_seconds) - 1
        message = f"{session_id}:{student_id}:{bucket}".encode("utf-8")
        expected_previous = hmac.new(key, message, hashlib.sha256).hexdigest()[:16]
        if hmac.compare_digest(provided_challenge, expected_previous):
            return True

    return False


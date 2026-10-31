"""
Consent Service — enforces explicit biometric consent requirements for enrollment
and verification.

Privacy principles followed:
  - No biometric operation may proceed without active, recorded consent.
  - Consent state is determined by the Node.js backend (ConsentRecord model)
    and forwarded to this service.  The Python service never queries MongoDB
    directly; it trusts the Node.js-supplied consent flag.
  - When consent is withdrawn, this service raises ConsentRequiredError,
    which surfaces a safe message to the student without exposing internals.
  - The Python layer provides an independent consent gate even if the
    Node.js backend were to forward a request erroneously.

This module provides stateless helper functions — no database access.
"""
from typing import Optional

from app.utils.exceptions import ConsentRequiredError


def require_consent(
    has_consent: bool,
    student_id: Optional[str] = None,
    operation: str = "biometric operation",
) -> None:
    """
    Raise ConsentRequiredError if `has_consent` is not True.

    Args:
        has_consent:  Whether the student has active, recorded biometric consent.
        student_id:   Student identifier — used only for internal logging context.
        operation:    Human-readable operation name for the error message.

    Raises:
        ConsentRequiredError: Always raised when has_consent is False or falsy.
    """
    if not has_consent:
        # Do NOT include student_id in the error message (privacy by design)
        raise ConsentRequiredError(
            f"Explicit biometric consent is required before {operation}. "
            "Please visit the Face Registration page to grant consent."
        )


def check_consent_and_raise(
    has_consent: bool,
    consent_date: Optional[str] = None,
    is_active: bool = True,
    operation: str = "biometric operation",
) -> None:
    """
    Extended consent check that validates both presence and active status.

    Args:
        has_consent:   Whether consent was recorded.
        consent_date:  ISO date string when consent was given (informational only).
        is_active:     Whether consent is currently active (not revoked).
        operation:     Human-readable operation name.

    Raises:
        ConsentRequiredError: If consent is missing or has been revoked.
    """
    if not has_consent:
        raise ConsentRequiredError(
            f"No biometric consent record found. "
            f"Student must explicitly opt in before {operation}."
        )

    if not is_active:
        raise ConsentRequiredError(
            f"Biometric consent has been withdrawn. "
            f"The student must re-enroll and grant new consent before {operation}."
        )


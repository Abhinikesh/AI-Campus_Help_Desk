"""Utilities package for image processing and domain exceptions."""
from app.utils.exceptions import (
    BiometricException,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    PoorImageQualityError,
    FaceTooSmallError,
    InvalidImagePayloadError,
    ConsentRequiredError,
    TemplateNotFoundError,
    SessionInvalidError,
    BiometricDecryptionError,
)

__all__ = [
    "BiometricException",
    "NoFaceDetectedError",
    "MultipleFacesDetectedError",
    "PoorImageQualityError",
    "FaceTooSmallError",
    "InvalidImagePayloadError",
    "ConsentRequiredError",
    "TemplateNotFoundError",
    "SessionInvalidError",
    "BiometricDecryptionError",
]

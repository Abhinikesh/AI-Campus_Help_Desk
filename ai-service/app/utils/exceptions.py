"""Domain exceptions for Face Recognition and Biometric Verification."""

class BiometricException(Exception):
    """Base exception for biometric processing failures."""
    def __init__(self, message: str, code: str = "BIOMETRIC_ERROR", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

class NoFaceDetectedError(BiometricException):
    def __init__(self, message: str = "No face detected in the frame. Please look directly at the camera."):
        super().__init__(message, code="NO_FACE_DETECTED", status_code=400)

class MultipleFacesDetectedError(BiometricException):
    def __init__(self, message: str = "Multiple faces detected. Please ensure only one person is in frame."):
        super().__init__(message, code="MULTIPLE_FACES_DETECTED", status_code=400)

class PoorImageQualityError(BiometricException):
    def __init__(self, message: str = "Image quality is too low or lighting is insufficient."):
        super().__init__(message, code="POOR_IMAGE_QUALITY", status_code=400)

class ImageTooBlurryError(PoorImageQualityError):
    def __init__(self, message: str = "The image is blurry. Hold the camera steady and try again."):
        super().__init__(message)
        self.code = "IMAGE_TOO_BLURRY"

class ImageTooDarkError(PoorImageQualityError):
    def __init__(self, message: str = "The image is too dark. Increase ambient lighting and face the light source."):
        super().__init__(message)
        self.code = "IMAGE_TOO_DARK"

class ImageTooBrightError(PoorImageQualityError):
    def __init__(self, message: str = "The image is overexposed. Avoid direct glare or strong backlighting."):
        super().__init__(message)
        self.code = "IMAGE_TOO_BRIGHT"

class ImageLowContrastError(PoorImageQualityError):
    def __init__(self, message: str = "Low contrast detected between face and background."):
        super().__init__(message)
        self.code = "IMAGE_LOW_CONTRAST"

class FaceTooSmallError(BiometricException):
    def __init__(self, message: str = "Face is too small. Please position your face closer to the camera."):
        super().__init__(message, code="FACE_TOO_SMALL", status_code=400)

class FacePositionInvalidError(BiometricException):
    def __init__(self, message: str = "Face is positioned too close to the frame boundary. Please center your face."):
        super().__init__(message, code="FACE_POSITION_INVALID", status_code=400)

class FaceDetectionFailedError(BiometricException):
    def __init__(self, message: str = "Face detection pipeline encountered an unexpected error."):
        super().__init__(message, code="FACE_DETECTION_FAILED", status_code=400)

class InvalidImagePayloadError(BiometricException):
    def __init__(self, message: str = "Invalid or corrupted image payload."):
        super().__init__(message, code="INVALID_IMAGE_PAYLOAD", status_code=400)

class NumericalCorruptionError(BiometricException):
    def __init__(self, message: str = "Numerical corruption detected: embedding contains non-finite values (NaN or Inf)."):
        super().__init__(message, code="NUMERICAL_CORRUPTION", status_code=400)

class EmbeddingExtractionError(BiometricException):
    def __init__(self, message: str = "Failed to extract face embedding from the provided face region."):
        super().__init__(message, code="EMBEDDING_EXTRACTION_FAILED", status_code=400)

class ConsentRequiredError(BiometricException):
    def __init__(self, message: str = "Active biometric consent is required before enrollment or verification."):
        super().__init__(message, code="CONSENT_REQUIRED", status_code=403)

class TemplateNotFoundError(BiometricException):
    def __init__(self, message: str = "No enrolled face template found for this student."):
        super().__init__(message, code="TEMPLATE_NOT_FOUND", status_code=404)

class SessionInvalidError(BiometricException):
    def __init__(self, message: str = "Session token or challenge is invalid or has expired."):
        super().__init__(message, code="SESSION_INVALID", status_code=400)

class BiometricDecryptionError(BiometricException):
    def __init__(self, message: str = "Failed to decrypt biometric template with secure key."):
        super().__init__(message, code="DECRYPTION_FAILED", status_code=500)

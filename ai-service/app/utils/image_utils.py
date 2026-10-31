"""Privacy-first in-memory image processing utilities using OpenCV and NumPy."""
import base64
import binascii
from io import BytesIO
from typing import Tuple, Dict, Any, Optional
import cv2
import numpy as np
from PIL import Image

from app.utils.exceptions import InvalidImagePayloadError, PoorImageQualityError

# Constraints
MIN_IMAGE_DIMENSION = 160
MAX_IMAGE_BYTES = 5 * 1024 * 1024 # 5 MB
MIN_IMAGE_BYTES = 4000 # 4 KB

# Quality thresholds
MIN_BRIGHTNESS = 40.0   # 0 to 255 scale
MAX_BRIGHTNESS = 225.0  # Overexposed threshold
MIN_LAPLACIAN_VAR = 35.0 # Sharpness threshold below which image is blurry

def decode_base64_image(image_payload: str) -> np.ndarray:
    """
    Decodes a base64 or Data URI string directly into an in-memory BGR OpenCV image.
    Never writes raw image data to disk.
    """
    if not image_payload or not isinstance(image_payload, str):
        raise InvalidImagePayloadError("Missing or invalid image payload")

    clean_b64 = image_payload
    if "base64," in image_payload:
        clean_b64 = image_payload.split("base64,")[1]

    try:
        raw_bytes = base64.b64decode(clean_b64)
    except (binascii.Error, ValueError) as e:
        raise InvalidImagePayloadError(f"Malformed base64 image data: {str(e)}")

    byte_len = len(raw_bytes)
    if byte_len < MIN_IMAGE_BYTES:
        raise InvalidImagePayloadError(f"Image payload size too small ({byte_len} bytes)")
    if byte_len > MAX_IMAGE_BYTES:
        raise InvalidImagePayloadError(f"Image payload size exceeds maximum limit of 5MB ({byte_len} bytes)")

    # Read bytes into numpy array
    np_arr = np.frombuffer(raw_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image is None or image.size == 0:
        raise InvalidImagePayloadError("Corrupted or unsupported image binary format")

    h, w = image.shape[:2]
    if h < MIN_IMAGE_DIMENSION or w < MIN_IMAGE_DIMENSION:
        raise InvalidImagePayloadError(f"Image resolution too low ({w}x{h}). Minimum required: {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION}")

    return image

def compute_image_quality(image: np.ndarray) -> Dict[str, Any]:
    """
    Compute photometric and structural quality metrics on an image array:
    - Luminance / Brightness (Mean grayscale intensity)
    - Sharpness / Blur score (Variance of Laplacian)
    - Contrast (Standard deviation of intensities)
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    # Brightness (0 - 255)
    brightness = float(np.mean(gray))

    # Sharpness via Laplacian Variance
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Contrast (Standard deviation)
    contrast = float(np.std(gray))

    # Evaluate suitability
    is_too_dark = brightness < MIN_BRIGHTNESS
    is_too_bright = brightness > MAX_BRIGHTNESS
    is_blurry = laplacian_var < MIN_LAPLACIAN_VAR
    is_low_contrast = contrast < 20.0

    is_suitable = not (is_too_dark or is_too_bright or is_blurry or is_low_contrast)

    quality_score = min(1.0, max(0.0, (laplacian_var / 200.0) * 0.5 + (1.0 - abs(brightness - 128) / 128.0) * 0.5))

    reasons = []
    if is_too_dark:
        reasons.append("Image is too dark. Increase ambient lighting.")
    if is_too_bright:
        reasons.append("Image is overexposed/glare detected.")
    if is_blurry:
        reasons.append("Image is blurry. Keep device steady.")
    if is_low_contrast:
        reasons.append("Low contrast detected between face and background.")

    return {
        "isSuitable": is_suitable,
        "qualityScore": round(quality_score, 3),
        "brightness": round(brightness, 1),
        "sharpness": round(laplacian_var, 1),
        "contrast": round(contrast, 1),
        "dimensions": {"width": image.shape[1], "height": image.shape[0]},
        "feedback": " ".join(reasons) if reasons else "Quality is good for biometric verification."
    }

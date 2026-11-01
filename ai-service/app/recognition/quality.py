"""Face quality analysis and positioning evaluation."""
from typing import Dict, Any, Tuple
import cv2
import numpy as np

from app.config import Config
from app.utils.image_utils import compute_image_quality
from app.recognition.detector import detect_faces, validate_single_face

def analyze_face_quality(image: np.ndarray) -> Dict[str, Any]:
    """
    Comprehensive quality check for biometric enrollment and verification:
    1. Overall photometric quality (brightness, blur, contrast).
    2. Single-face detection validation.
    3. Face bounding box size and centering.
    """
    # 1. Photometric check
    photo_metrics = compute_image_quality(image)

    # 2. Face detection
    boxes = detect_faces(image)
    face_count = len(boxes)

    if face_count == 0:
        return {
            "isValid": False,
            "status": "NO_FACE_DETECTED",
            "message": "No face detected in the frame. Please look directly at the camera.",
            "metrics": photo_metrics,
            "quality": {
                "brightness": "dark" if photo_metrics.get("isTooDark") else ("overexposed" if photo_metrics.get("isTooBright") else "acceptable"),
                "blur": photo_metrics.get("blurLevel", "acceptable"),
                "contrast": "poor" if photo_metrics.get("isLowContrast") else "acceptable",
                "face_position": "none"
            },
            "error": {
                "code": "NO_FACE_DETECTED",
                "message": "No face detected in the frame. Please look directly at the camera."
            },
            "faceCount": 0
        }

    if face_count > 1:
        return {
            "isValid": False,
            "status": "MULTIPLE_FACES_DETECTED",
            "message": f"Multiple faces ({face_count}) detected. Ensure only one person is visible.",
            "metrics": photo_metrics,
            "quality": {
                "brightness": "dark" if photo_metrics.get("isTooDark") else ("overexposed" if photo_metrics.get("isTooBright") else "acceptable"),
                "blur": photo_metrics.get("blurLevel", "acceptable"),
                "contrast": "poor" if photo_metrics.get("isLowContrast") else "acceptable",
                "face_position": "multiple"
            },
            "error": {
                "code": "MULTIPLE_FACES_DETECTED",
                "message": f"Multiple faces ({face_count}) detected. Ensure only one person is visible."
            },
            "faceCount": face_count
        }

    top, right, bottom, left = boxes[0]
    face_w = right - left
    face_h = bottom - top
    img_h, img_w = image.shape[:2]

    # Face size check
    if face_w < Config.MIN_FACE_SIZE or face_h < Config.MIN_FACE_SIZE:
        return {
            "isValid": False,
            "status": "FACE_TOO_SMALL",
            "message": f"Face is too small ({face_w}x{face_h}px). Please move closer to the camera.",
            "metrics": photo_metrics,
            "quality": {
                "brightness": "dark" if photo_metrics.get("isTooDark") else ("overexposed" if photo_metrics.get("isTooBright") else "acceptable"),
                "blur": photo_metrics.get("blurLevel", "acceptable"),
                "contrast": "poor" if photo_metrics.get("isLowContrast") else "acceptable",
                "face_position": "too_small"
            },
            "error": {
                "code": "FACE_TOO_SMALL",
                "message": f"Face is too small ({face_w}x{face_h}px). Please move closer to the camera."
            },
            "faceCount": 1,
            "faceBox": {"top": top, "right": right, "bottom": bottom, "left": left}
        }

    # Face centering check (face center should be within middle 70% of frame)
    face_center_x = (left + right) / 2.0
    face_center_y = (top + bottom) / 2.0

    margin_x = img_w * 0.15
    margin_y = img_h * 0.15

    is_centered = (margin_x <= face_center_x <= img_w - margin_x) and (margin_y <= face_center_y <= img_h - margin_y)

    quality_breakdown = {
        "brightness": "dark" if photo_metrics.get("isTooDark") else ("overexposed" if photo_metrics.get("isTooBright") else "acceptable"),
        "blur": photo_metrics.get("blurLevel", "acceptable"),
        "contrast": "poor" if photo_metrics.get("isLowContrast") else "acceptable",
        "face_position": "acceptable" if is_centered else "off_center"
    }

    if not photo_metrics["isSuitable"]:
        if photo_metrics.get("isBlurry"):
            status_code = "IMAGE_TOO_BLURRY"
        elif photo_metrics.get("isTooDark"):
            status_code = "IMAGE_TOO_DARK"
        elif photo_metrics.get("isTooBright"):
            status_code = "IMAGE_TOO_BRIGHT"
        elif photo_metrics.get("isLowContrast"):
            status_code = "IMAGE_LOW_CONTRAST"
        else:
            status_code = "POOR_IMAGE_QUALITY"

        return {
            "isValid": False,
            "status": status_code,
            "message": photo_metrics["feedback"],
            "metrics": photo_metrics,
            "quality": quality_breakdown,
            "error": {
                "code": status_code,
                "message": photo_metrics["feedback"]
            },
            "faceCount": 1,
            "faceBox": {"top": top, "right": right, "bottom": bottom, "left": left}
        }

    return {
        "isValid": True,
        "status": "ACCEPTABLE",
        "message": "Face image is suitable for biometric processing.",
        "metrics": photo_metrics,
        "quality": quality_breakdown,
        "faceCount": 1,
        "isCentered": is_centered,
        "faceBox": {"top": top, "right": right, "bottom": bottom, "left": left}
    }

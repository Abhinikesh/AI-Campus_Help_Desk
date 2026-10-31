"""Configuration for CampusSphere AI Python Biometric Engine."""
import os

class Config:
    SERVICE_NAME = "campussphere-ai-service"
    VERSION = "2.0.0"
    SECRET_KEY = os.getenv("SECRET_KEY", "campussphere-ai-internal-key-2026")
    INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "campussphere-internal-secret-2026")
    BIOMETRIC_SECRET_KEY = os.getenv("BIOMETRIC_SECRET_KEY", "campussphere-bio-aes-key-32bytes!!")

    # Recognition Model Configuration
    MODEL_NAME = "dlib_face_recognition_resnet_model_v1"
    MODEL_DIMENSIONS = 128
    MODEL_LICENSE = "Creative Commons Zero (CC0) / Boost Software License"

    # Calibration Thresholds (Euclidean Distance on 128-d unit sphere)
    # distance <= MATCH_THRESHOLD: VERIFIED
    # MATCH_THRESHOLD < distance <= REVIEW_THRESHOLD: PENDING_REVIEW
    # distance > REVIEW_THRESHOLD: REJECTED
    MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.55"))
    REVIEW_THRESHOLD = float(os.getenv("REVIEW_THRESHOLD", "0.65"))

    # Image constraints
    MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
    MIN_IMAGE_BYTES = 4000            # 4 KB
    MIN_FACE_SIZE = 70                # 70x70 px minimum face bounding box
    MIN_IMAGE_DIMENSION = 160         # 160x160 px frame

    # Photometric quality limits
    MIN_BRIGHTNESS = 40.0
    MAX_BRIGHTNESS = 225.0
    MIN_SHARPNESS = 35.0

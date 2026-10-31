"""Face Verification Service: Decrypts enrolled templates, processes live capture, and performs 1-to-1 matching."""
from typing import Dict, Any, Optional
import numpy as np

from app.config import Config
from app.utils.image_utils import decode_base64_image
from app.recognition.quality import analyze_face_quality
from app.recognition.detector import validate_single_face
from app.recognition.preprocessing import normalize_lighting
from app.recognition.embedding import generate_face_embedding
from app.recognition.matcher import evaluate_match
from app.security.encryption import decrypt_biometric_template
from app.utils.exceptions import (
    BiometricException,
    ConsentRequiredError,
    TemplateNotFoundError,
    SessionInvalidError,
    PoorImageQualityError,
)

class VerificationService:
    @staticmethod
    def validate_live_image(image_payload: str) -> Dict[str, Any]:
        """
        Evaluate live camera capture quality and face positioning before verification.
        """
        image = decode_base64_image(image_payload)
        return analyze_face_quality(image)

    @staticmethod
    def verify_live_face(
        encrypted_enrolled_data: str,
        live_image_payload: str,
        has_consent: bool = True,
        session_challenge: Optional[str] = None,
        expected_challenge: Optional[str] = None,
        custom_threshold: Optional[float] = None,
        secret_key: str = Config.BIOMETRIC_SECRET_KEY
    ) -> Dict[str, Any]:
        """
        Executes end-to-end one-to-one face verification:
        1. Validates consent & session challenge.
        2. Decrypts enrolled biometric template.
        3. Decodes and analyzes live capture.
        4. Detects face and generates live 128-d embedding.
        5. Computes distance and evaluates against calibrated threshold.
        6. Returns structured result.
        """
        if not has_consent:
            raise ConsentRequiredError("Student has not granted active consent for biometric attendance.")

        if not encrypted_enrolled_data:
            raise TemplateNotFoundError("No enrolled biometric template found for this student.")

        # Validate anti-replay challenge if specified
        if expected_challenge and session_challenge != expected_challenge:
            raise SessionInvalidError("Session QR challenge token mismatch or token expired.")

        # 1. Decrypt enrolled template
        enrolled_template = decrypt_biometric_template(encrypted_enrolled_data, secret_key)
        enrolled_vector = enrolled_template.get("vector")
        if not enrolled_vector:
            raise BiometricException("Decrypted biometric template contains no vector data")

        # 2. Decode and validate live image quality
        live_image = decode_base64_image(live_image_payload)
        quality_report = analyze_face_quality(live_image)

        if not quality_report["isValid"]:
            status_code = quality_report["status"]
            return {
                "success": False,
                "isMatch": False,
                "status": status_code,
                "confidence": 0.0,
                "message": quality_report["message"],
                "qualityMetrics": quality_report["metrics"]
            }

        # 3. Detect single face and normalize lighting
        norm_image = normalize_lighting(live_image)
        bbox = validate_single_face(norm_image)

        # 4. Extract live 128-d embedding
        live_embedding = generate_face_embedding(norm_image, bbox)

        # 5. Compare with enrolled template
        threshold = custom_threshold if custom_threshold is not None else Config.MATCH_THRESHOLD
        match_result = evaluate_match(
            live_vector=live_embedding,
            enrolled_vector=np.array(enrolled_vector, dtype=np.float32),
            match_threshold=threshold,
            review_threshold=Config.REVIEW_THRESHOLD
        )

        return {
            "success": True,
            "isMatch": match_result["isMatch"],
            "status": match_result["status"],
            "confidence": match_result["confidence"],
            "euclideanDistance": match_result["euclideanDistance"],
            "cosineSimilarity": match_result["cosineSimilarity"],
            "thresholdUsed": match_result["thresholdUsed"],
            "qualitySummary": quality_report["metrics"]
        }

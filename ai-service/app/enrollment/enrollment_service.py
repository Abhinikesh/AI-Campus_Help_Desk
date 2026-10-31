"""Face Enrollment Service: Validates quality, detects faces, extracts embeddings, and encrypts templates."""
from typing import List, Dict, Any, Union
import numpy as np

from app.config import Config
from app.utils.image_utils import decode_base64_image
from app.recognition.quality import analyze_face_quality
from app.recognition.detector import validate_single_face
from app.recognition.preprocessing import normalize_lighting
from app.recognition.embedding import generate_face_embedding, aggregate_enrollment_embeddings
from app.security.encryption import encrypt_biometric_template
from app.utils.exceptions import (
    BiometricException,
    ConsentRequiredError,
    PoorImageQualityError,
)

class EnrollmentService:
    @staticmethod
    def validate_enrollment_sample(image_payload: str) -> Dict[str, Any]:
        """
        Validates a candidate enrollment image sample in memory.
        Returns detailed feedback on quality, face count, and positioning.
        """
        image = decode_base64_image(image_payload)
        quality_report = analyze_face_quality(image)
        return quality_report

    @staticmethod
    def process_enrollment(
        student_id: str,
        image_samples: Union[str, List[str]],
        consent_given: bool = True,
        secret_key: str = Config.BIOMETRIC_SECRET_KEY
    ) -> Dict[str, Any]:
        """
        Process single or multi-sample face enrollment:
        1. Validate explicit consent.
        2. Validate quality on all samples.
        3. Detect face and extract embeddings.
        4. Aggregate embeddings into representative template.
        5. Encrypt with AES-256-GCM.
        6. Return encrypted template metadata without persisting raw images.
        """
        if not consent_given:
            raise ConsentRequiredError("Biometric enrollment cannot proceed without explicit student consent.")

        if not student_id:
            raise BiometricException("student_id is required for biometric enrollment")

        if isinstance(image_samples, str):
            image_samples = [image_samples]

        if not image_samples:
            raise BiometricException("At least one face image sample is required for enrollment")

        embeddings = []
        quality_reports = []

        for idx, sample in enumerate(image_samples):
            image = decode_base64_image(sample)
            quality_report = analyze_face_quality(image)
            quality_reports.append(quality_report)

            if not quality_report["isValid"]:
                raise PoorImageQualityError(f"Sample {idx+1} rejected: {quality_report['message']}")

            # Normalize lighting and validate single face
            norm_image = normalize_lighting(image)
            bbox = validate_single_face(norm_image)

            # Generate 128-d unit vector
            emb = generate_face_embedding(norm_image, bbox)
            embeddings.append(emb)

        # Aggregate into representative centroid template
        template_data = aggregate_enrollment_embeddings(embeddings)
        template_data["studentId"] = str(student_id)

        # Encrypt with AES-256-GCM
        encrypted_blob = encrypt_biometric_template(template_data, secret_key)

        return {
            "success": True,
            "studentId": student_id,
            "templateReference": template_data["templateReference"],
            "encryptedData": encrypted_blob,
            "model": template_data["model"],
            "dimensions": template_data["dimensions"],
            "sampleCount": len(embeddings),
            "qualitySummary": {
                "averageQuality": round(sum(q["metrics"]["qualityScore"] for q in quality_reports) / len(quality_reports), 3),
                "isCentered": all(q.get("isCentered", True) for q in quality_reports)
            },
            "message": "Face biometric template successfully generated and encrypted."
        }

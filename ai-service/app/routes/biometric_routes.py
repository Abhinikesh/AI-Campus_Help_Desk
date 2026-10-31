"""
Internal Biometric Routes — legacy /api/internal/biometrics/* compatibility layer.

These routes mirror the /api/ai/enrollment/* and /api/ai/verification/* endpoints
but use the original URL paths that the Part 3 Node.js proxy was configured to call.

They delegate directly to the real EnrollmentService and VerificationService,
which use the deep-learning face_recognition engine (dlib ResNet-based).

The old BiometricProcessor stub referenced in earlier versions has been replaced
by the full production pipeline:
  image → quality check → face detection → embedding → AES-256-GCM encryption
"""
from flask import Blueprint, request, jsonify, current_app
from app.security.auth import require_internal_key
from app.enrollment.enrollment_service import EnrollmentService
from app.verification.verification_service import VerificationService
from app.utils.exceptions import BiometricException

biometric_bp = Blueprint("biometric_bp", __name__)


@biometric_bp.route("/validate-quality", methods=["POST"])
@require_internal_key
def validate_quality():
    """Validate image quality without enrollment — used by Node.js pre-flight checks."""
    data = request.get_json() or {}
    image_data = data.get("imageData") or data.get("liveImageData")

    if not image_data:
        return jsonify({"success": False, "message": "imageData is required"}), 400

    try:
        report = EnrollmentService.validate_enrollment_sample(image_data)
        return jsonify({
            "success": report["isValid"],
            "message": report["message"],
            "metrics": report["metrics"],
            "faceCount": report.get("faceCount", 0)
        }), 200 if report["isValid"] else 400
    except BiometricException as e:
        return jsonify({"success": False, "status": e.code, "message": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "message": "Image quality validation failed"}), 500


@biometric_bp.route("/enroll", methods=["POST"])
@require_internal_key
def enroll_template():
    """
    Enroll a face biometric template.

    Accepts a single imageData or a list of imageSamples.
    Returns AES-256-GCM encrypted template blob and SHA-256 fingerprint.
    Never persists raw images.
    """
    data = request.get_json() or {}
    student_id = data.get("studentId")
    # Accept both legacy single-image and new multi-sample formats
    image_data = data.get("imageData")
    image_samples = data.get("imageSamples") or (
        [image_data] if image_data else None
    )
    consent_given = data.get("consentGiven", True)

    if not student_id or not image_samples:
        return jsonify({
            "success": False,
            "message": "studentId and imageData (or imageSamples) are required"
        }), 400

    secret_key = current_app.config.get("BIOMETRIC_SECRET_KEY")

    try:
        result = EnrollmentService.process_enrollment(
            student_id=student_id,
            image_samples=image_samples,
            consent_given=consent_given,
            secret_key=secret_key,
        )
        # Expose result under a 'data' key for backward compatibility with Part 3 proxy
        return jsonify({
            "success": True,
            "message": result.get("message", "Enrollment successful"),
            "data": {
                "studentId": result["studentId"],
                "templateReference": result["templateReference"],
                "encryptedData": result["encryptedData"],
                "dimensions": result["dimensions"],
                "sampleCount": result["sampleCount"],
                "qualityMetrics": result.get("qualitySummary", {}),
            }
        }), 200
    except BiometricException as e:
        return jsonify({"success": False, "status": e.code, "message": e.message}), e.status_code
    except Exception:
        return jsonify({"success": False, "message": "Enrollment processing failed"}), 500


@biometric_bp.route("/verify", methods=["POST"])
@require_internal_key
def verify_template():
    """
    One-to-one face verification.

    Decrypts enrolled template (Node.js supplies the AES-GCM blob from MongoDB),
    generates a live embedding, and returns match result with confidence score.
    Never logs or persists the raw live image.
    """
    data = request.get_json() or {}
    encrypted_enrolled_data = data.get("encryptedEnrolledData")
    live_image_data = data.get("liveImageData") or data.get("imageData")
    has_consent = data.get("hasConsent", True)
    session_challenge = data.get("sessionChallenge")
    expected_challenge = data.get("expectedChallenge")

    if not encrypted_enrolled_data or not live_image_data:
        return jsonify({
            "success": False,
            "message": "encryptedEnrolledData and liveImageData are required"
        }), 400

    secret_key = current_app.config.get("BIOMETRIC_SECRET_KEY")

    try:
        result = VerificationService.verify_live_face(
            encrypted_enrolled_data=encrypted_enrolled_data,
            live_image_payload=live_image_data,
            has_consent=has_consent,
            session_challenge=session_challenge,
            expected_challenge=expected_challenge,
            secret_key=secret_key,
        )
        return jsonify({
            "success": result.get("isMatch", False),
            "isMatch": result.get("isMatch", False),
            "confidence": result.get("confidence", 0.0),
            "verificationStatus": "verified" if result.get("isMatch") else result.get("status", "not_matched").lower(),
            "euclideanDistance": result.get("euclideanDistance"),
            "cosineSimilarity": result.get("cosineSimilarity"),
            "status": result.get("status"),
            "qualityMetrics": result.get("qualitySummary"),
        }), 200
    except BiometricException as e:
        return jsonify({
            "success": False,
            "isMatch": False,
            "confidence": 0.0,
            "verificationStatus": "rejected",
            "status": e.code,
            "message": e.message,
        }), e.status_code
    except Exception:
        return jsonify({
            "success": False,
            "isMatch": False,
            "confidence": 0.0,
            "verificationStatus": "error",
            "message": "Verification processing failed",
        }), 500

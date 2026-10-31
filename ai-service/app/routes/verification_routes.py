"""Biometric Verification Routes."""
from flask import Blueprint, request, jsonify, current_app
from app.security.auth import require_internal_key
from app.verification.verification_service import VerificationService
from app.utils.exceptions import BiometricException

verification_bp = Blueprint("verification_bp", __name__)

@verification_bp.route("/validate-image", methods=["POST"])
@require_internal_key
def validate_verification_image():
    data = request.get_json() or {}
    image_data = data.get("imageData") or data.get("liveImageData")

    if not image_data:
        return jsonify({"success": False, "message": "imageData is required"}), 400

    try:
        report = VerificationService.validate_live_image(image_data)
        return jsonify({
            "success": report["isValid"],
            "status": report["status"],
            "message": report["message"],
            "metrics": report["metrics"]
        }), 200 if report["isValid"] else 400
    except BiometricException as e:
        return jsonify({"success": False, "status": e.code, "message": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "status": "INTERNAL_ERROR", "message": str(e)}), 500

@verification_bp.route("/verify", methods=["POST"])
@require_internal_key
def verify():
    data = request.get_json() or {}
    encrypted_enrolled_data = data.get("encryptedEnrolledData")
    live_image_data = data.get("liveImageData") or data.get("imageData")
    has_consent = data.get("hasConsent", True)
    session_challenge = data.get("sessionChallenge")
    expected_challenge = data.get("expectedChallenge")
    custom_threshold = data.get("customThreshold")

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
            custom_threshold=custom_threshold,
            secret_key=secret_key
        )
        return jsonify(result), 200
    except BiometricException as e:
        return jsonify({
            "success": False,
            "isMatch": False,
            "status": e.code,
            "confidence": 0.0,
            "message": e.message
        }), e.status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "isMatch": False,
            "status": "VERIFICATION_ERROR",
            "confidence": 0.0,
            "message": str(e)
        }), 500

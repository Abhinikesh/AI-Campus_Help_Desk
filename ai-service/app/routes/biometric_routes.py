"""Internal Biometric routes for quality check, enrollment & verification interfaces."""
from flask import Blueprint, request, jsonify, current_app
from app.security.auth import require_internal_key
from app.security.encryption import encrypt_biometric_template, decrypt_biometric_template
from app.recognition.quality import BiometricProcessor

biometric_bp = Blueprint("biometric_bp", __name__)

@biometric_bp.route("/validate-quality", methods=["POST"])
@require_internal_key
def validate_quality():
    data = request.get_json() or {}
    image_data = data.get("imageData")

    is_valid, msg, metrics = BiometricProcessor.validate_image_payload(image_data)
    return jsonify({
        "success": is_valid,
        "message": msg,
        "metrics": metrics
    }), 200 if is_valid else 400

@biometric_bp.route("/enroll", methods=["POST"])
@require_internal_key
def enroll_template():
    data = request.get_json() or {}
    student_id = data.get("studentId")
    image_data = data.get("imageData")

    if not student_id or not image_data:
        return jsonify({"success": False, "message": "studentId and imageData are required"}), 400

    is_valid, msg, metrics = BiometricProcessor.validate_image_payload(image_data)
    if not is_valid:
        return jsonify({"success": False, "message": f"Quality validation failed: {msg}"}), 400

    template = BiometricProcessor.extract_template_signature(image_data)
    secret_key = current_app.config.get("BIOMETRIC_SECRET_KEY")
    encrypted_blob = encrypt_biometric_template(template, secret_key)

    return jsonify({
        "success": True,
        "message": "Biometric template generated and encrypted securely",
        "data": {
            "studentId": student_id,
            "templateReference": template.get("hashFingerprint"),
            "encryptedData": encrypted_blob,
            "dimensions": template.get("dimensions"),
            "qualityMetrics": metrics
        }
    }), 200

@biometric_bp.route("/verify", methods=["POST"])
@require_internal_key
def verify_template():
    data = request.get_json() or {}
    encrypted_enrolled_data = data.get("encryptedEnrolledData")
    live_image_data = data.get("liveImageData")

    if not encrypted_enrolled_data or not live_image_data:
        return jsonify({"success": False, "message": "encryptedEnrolledData and liveImageData are required"}), 400

    secret_key = current_app.config.get("BIOMETRIC_SECRET_KEY")
    try:
        enrolled_template = decrypt_biometric_template(encrypted_enrolled_data, secret_key)
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to decrypt enrolled template: {str(e)}"}), 500

    is_valid, msg, _ = BiometricProcessor.validate_image_payload(live_image_data)
    if not is_valid:
        return jsonify({
            "success": False,
            "isMatch": False,
            "confidence": 0.0,
            "verificationStatus": "rejected",
            "message": f"Live image quality rejected: {msg}"
        }), 400

    live_template = BiometricProcessor.extract_template_signature(live_image_data)
    is_match, confidence, status = BiometricProcessor.verify_templates(live_template, enrolled_template)

    return jsonify({
        "success": True,
        "isMatch": is_match,
        "confidence": confidence,
        "verificationStatus": status
    }), 200

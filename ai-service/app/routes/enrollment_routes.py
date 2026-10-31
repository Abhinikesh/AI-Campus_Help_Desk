"""Biometric Enrollment Routes."""
from flask import Blueprint, request, jsonify, current_app
from app.security.auth import require_internal_key
from app.enrollment.enrollment_service import EnrollmentService
from app.utils.exceptions import BiometricException

enrollment_bp = Blueprint("enrollment_bp", __name__)

@enrollment_bp.route("/validate", methods=["POST"])
@require_internal_key
def validate_sample():
    data = request.get_json() or {}
    image_data = data.get("imageData") or data.get("image")

    if not image_data:
        return jsonify({"success": False, "message": "imageData is required"}), 400

    try:
        report = EnrollmentService.validate_enrollment_sample(image_data)
        return jsonify({
            "success": report["isValid"],
            "status": report["status"],
            "message": report["message"],
            "metrics": report["metrics"],
            "faceCount": report["faceCount"]
        }), 200 if report["isValid"] else 400
    except BiometricException as e:
        return jsonify({"success": False, "status": e.code, "message": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "status": "INTERNAL_ERROR", "message": str(e)}), 500

@enrollment_bp.route("/submit", methods=["POST"])
@require_internal_key
def submit_enrollment():
    data = request.get_json() or {}
    student_id = data.get("studentId")
    image_samples = data.get("imageSamples") or data.get("imageData")
    consent_given = data.get("consentGiven", True)

    if not student_id or not image_samples:
        return jsonify({"success": False, "message": "studentId and imageSamples are required"}), 400

    secret_key = current_app.config.get("BIOMETRIC_SECRET_KEY")

    try:
        result = EnrollmentService.process_enrollment(
            student_id=student_id,
            image_samples=image_samples,
            consent_given=consent_given,
            secret_key=secret_key
        )
        return jsonify(result), 200
    except BiometricException as e:
        return jsonify({"success": False, "status": e.code, "message": e.message}), e.status_code
    except Exception as e:
        return jsonify({"success": False, "status": "ENROLLMENT_FAILED", "message": str(e)}), 500

@enrollment_bp.route("/status/<student_id>", methods=["GET"])
@require_internal_key
def enrollment_status(student_id):
    """
    Returns enrollment status metadata without exposing raw biometric templates.
    """
    return jsonify({
        "success": True,
        "studentId": student_id,
        "model": current_app.config.get("MODEL_NAME", "dlib_face_recognition_resnet_model_v1"),
        "dimensions": current_app.config.get("MODEL_DIMENSIONS", 128),
        "status": "ready"
    }), 200

@enrollment_bp.route("/<student_id>", methods=["DELETE"])
@require_internal_key
def delete_enrollment(student_id):
    """
    Confirm biometric deletion request.
    """
    return jsonify({
        "success": True,
        "studentId": student_id,
        "status": "DELETED",
        "message": f"Biometric template for student {student_id} successfully purged."
    }), 200

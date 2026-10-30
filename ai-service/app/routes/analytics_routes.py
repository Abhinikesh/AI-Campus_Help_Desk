"""Internal Analytics routes for attendance calculations."""
from flask import Blueprint, request, jsonify
from app.security.auth import require_internal_key
from app.analytics.engine import AttendanceEngine

analytics_bp = Blueprint("analytics_bp", __name__)

@analytics_bp.route("/calculate-student", methods=["POST"])
@require_internal_key
def calculate_student():
    data = request.get_json() or {}
    student_id = data.get("studentId")
    sessions = data.get("sessions", [])
    records = data.get("records", [])
    subjects_catalog = data.get("subjectsCatalog")
    count_excused_as_present = data.get("countExcusedAsPresent", False)

    if not student_id:
        return jsonify({
            "success": False,
            "message": "studentId is required"
        }), 400

    result = AttendanceEngine.calculate_student_overview(
        student_id=str(student_id),
        sessions=sessions,
        records=records,
        subjects_catalog=subjects_catalog,
        count_excused_as_present=count_excused_as_present
    )

    return jsonify({
        "success": True,
        "data": result
    }), 200

@analytics_bp.route("/faculty-report", methods=["POST"])
@require_internal_key
def faculty_report():
    data = request.get_json() or {}
    sessions = data.get("sessions", [])
    records = data.get("records", [])
    students = data.get("students", [])

    result = AttendanceEngine.calculate_faculty_report(
        sessions=sessions,
        records=records,
        students=students
    )

    return jsonify({
        "success": True,
        "data": result
    }), 200

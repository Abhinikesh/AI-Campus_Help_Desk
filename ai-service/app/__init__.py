"""CampusSphere AI - Python Microservice for Attendance Analytics & Face Recognition."""
import os
from flask import Flask, jsonify
from app.config import Config

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # ── Primary AI endpoints (used by Node.js gateway) ──────────────────────
    from app.routes.health_routes import health_bp
    from app.routes.enrollment_routes import enrollment_bp
    from app.routes.verification_routes import verification_bp
    from app.routes.analytics_routes import analytics_bp
    from app.routes.biometric_routes import biometric_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(enrollment_bp, url_prefix="/api/ai/enrollment")
    app.register_blueprint(verification_bp, url_prefix="/api/ai/verification")
    app.register_blueprint(analytics_bp, url_prefix="/api/internal/analytics")

    # ── /api/internal/biometrics/* — real deep-learning routes ──────────────
    # These are the paths the Part 3 Node.js proxy already calls.
    # biometric_bp delegates to EnrollmentService & VerificationService (full pipeline).
    app.register_blueprint(biometric_bp, url_prefix="/api/internal/biometrics")

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "message": "Endpoint not found"}), 404

    @app.errorhandler(413)
    def payload_too_large(e):
        return jsonify({"success": False, "message": "Image payload exceeds 5 MB limit"}), 413

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"success": False, "message": "Internal AI service error"}), 500

    return app

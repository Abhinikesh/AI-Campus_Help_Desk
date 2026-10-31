"""CampusSphere AI - Python Microservice for Attendance Analytics & Face Recognition."""
import os
from flask import Flask, jsonify
from app.config import Config

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # Register Blueprints
    from app.routes.health_routes import health_bp
    from app.routes.enrollment_routes import enrollment_bp
    from app.routes.verification_routes import verification_bp
    from app.routes.analytics_routes import analytics_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(enrollment_bp, url_prefix="/api/ai/enrollment")
    app.register_blueprint(verification_bp, url_prefix="/api/ai/verification")
    app.register_blueprint(analytics_bp, url_prefix="/api/internal/analytics")

    # Compatibility aliases for Part 3 internal routes
    app.register_blueprint(enrollment_bp, url_prefix="/api/internal/biometrics", name="compat_biometrics_enroll")
    app.register_blueprint(verification_bp, url_prefix="/api/internal/biometrics", name="compat_biometrics_verify")

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "message": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"success": False, "message": "Internal AI service error"}), 500

    return app

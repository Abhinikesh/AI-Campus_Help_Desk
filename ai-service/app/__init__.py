"""CampusSphere AI - Python Microservice for Attendance Analytics & Biometrics."""
import os
from flask import Flask, jsonify

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.getenv("SECRET_KEY", "campussphere-ai-internal-key-2026"),
        INTERNAL_API_KEY=os.getenv("INTERNAL_API_KEY", "campussphere-internal-secret-2026"),
        BIOMETRIC_SECRET_KEY=os.getenv("BIOMETRIC_SECRET_KEY", "campussphere-bio-aes-key-32bytes!!")
    )

    if test_config:
        app.config.update(test_config)

    # Register Blueprints
    from app.routes.analytics_routes import analytics_bp
    from app.routes.biometric_routes import biometric_bp

    app.register_blueprint(analytics_bp, url_prefix="/api/internal/analytics")
    app.register_blueprint(biometric_bp, url_prefix="/api/internal/biometrics")

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "healthy",
            "service": "campussphere-ai-service",
            "version": "1.0.0"
        }), 200

    return app

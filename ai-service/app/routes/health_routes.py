"""Health check and model status routes."""
from flask import Blueprint, jsonify
from app.config import Config

health_bp = Blueprint("health_bp", __name__)

@health_bp.route("/health", methods=["GET"])
@health_bp.route("/api/ai/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": Config.SERVICE_NAME,
        "version": Config.VERSION,
        "model": {
            "name": Config.MODEL_NAME,
            "dimensions": Config.MODEL_DIMENSIONS,
            "license": Config.MODEL_LICENSE,
            "status": "loaded"
        }
    }), 200

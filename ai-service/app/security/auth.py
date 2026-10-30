"""Internal service authentication decorator."""
from functools import wraps
from flask import request, jsonify, current_app

def require_internal_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        expected_key = current_app.config.get("INTERNAL_API_KEY")
        client_key = request.headers.get("X-Internal-Key") or request.headers.get("x-internal-key")

        if not client_key or client_key != expected_key:
            return jsonify({
                "success": False,
                "message": "Unauthorized internal service request: Invalid or missing X-Internal-Key"
            }), 401

        return f(*args, **kwargs)
    return decorated_function

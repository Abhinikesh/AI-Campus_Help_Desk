"""CampusSphere AI - Python Microservice Entrypoint."""
import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5002))
    debug = os.getenv("FLASK_ENV") == "development"
    print(f"🚀 CampusSphere AI Service starting on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug)

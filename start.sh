#!/usr/bin/env bash
# ==============================================================================
# CampusSphere AI — One-Click Startup Script
# Starts:
#   1. Python AI Biometric Microservice (:5002)
#   2. Node.js Express Backend API Gateway (:5001)
#   3. React Vite Frontend Client (:5173)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "      🚀 Launching CampusSphere AI Platform              "
echo "=========================================================="
echo ""
echo "  [1/3] Biometric AI Service : http://localhost:5002"
echo "  [2/3] Core Backend API     : http://localhost:5001"
echo "  [3/3] Frontend Web Portal  : http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services simultaneously."
echo "=========================================================="
echo ""

npm run dev

"""Recognition package bundling face detection, embedding, matching, and quality."""
from app.recognition.detector import detect_faces, validate_single_face, extract_face_chip
from app.recognition.preprocessing import normalize_lighting, resize_for_inference
from app.recognition.embedding import generate_face_embedding, aggregate_enrollment_embeddings
from app.recognition.matcher import calculate_comparison_metrics, evaluate_match
from app.recognition.quality import analyze_face_quality

__all__ = [
    "detect_faces",
    "validate_single_face",
    "extract_face_chip",
    "normalize_lighting",
    "resize_for_inference",
    "generate_face_embedding",
    "aggregate_enrollment_embeddings",
    "calculate_comparison_metrics",
    "evaluate_match",
    "analyze_face_quality",
]

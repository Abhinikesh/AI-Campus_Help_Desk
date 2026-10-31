"""Biometric Face Matching & Threshold Calibration Engine."""
from typing import Dict, Any, Tuple
import numpy as np

from app.config import Config
from app.utils.exceptions import BiometricException

def calculate_comparison_metrics(vec_a: np.ndarray, vec_b: np.ndarray) -> Tuple[float, float]:
    """
    Compute Euclidean distance and Cosine similarity between two unit vectors.
    """
    if len(vec_a) != len(vec_b):
        raise BiometricException(f"Dimensionality mismatch: {len(vec_a)} vs {len(vec_b)}")

    # Ensure float32 arrays
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)

    # Normalize if not already unit vectors
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a > 0: a = a / norm_a
    if norm_b > 0: b = b / norm_b

    # Euclidean distance
    diff = a - b
    euclidean_dist = float(np.linalg.norm(diff))

    # Cosine similarity
    cosine_sim = float(np.clip(np.dot(a, b), -1.0, 1.0))

    return round(euclidean_dist, 4), round(cosine_sim, 4)

def evaluate_match(
    live_vector: np.ndarray,
    enrolled_vector: np.ndarray,
    match_threshold: float = Config.MATCH_THRESHOLD,
    review_threshold: float = Config.REVIEW_THRESHOLD
) -> Dict[str, Any]:
    """
    Evaluate one-to-one biometric comparison according to calibrated operating thresholds:
    - distance <= match_threshold: VERIFIED (True positive match)
    - match_threshold < distance <= review_threshold: VERIFICATION_REQUIRES_REVIEW (Marginal match)
    - distance > review_threshold: NOT_MATCHED (Rejection)
    """
    euclidean_dist, cosine_sim = calculate_comparison_metrics(live_vector, enrolled_vector)

    # Confidence score mapping (continuous 0.0 to 1.0)
    # At dist=0.0 -> conf=1.0
    # At dist=match_threshold (0.55) -> conf=0.85
    # At dist=review_threshold (0.65) -> conf=0.65
    # At dist>=1.0 -> conf=0.0
    confidence = max(0.0, min(1.0, 1.0 - (euclidean_dist / 1.15)))

    if euclidean_dist <= match_threshold:
        status = "VERIFIED"
        is_match = True
    elif euclidean_dist <= review_threshold:
        status = "VERIFICATION_REQUIRES_REVIEW"
        is_match = False
    else:
        status = "NOT_MATCHED"
        is_match = False

    return {
        "isMatch": is_match,
        "status": status,
        "confidence": round(confidence, 3),
        "euclideanDistance": euclidean_dist,
        "cosineSimilarity": cosine_sim,
        "thresholdUsed": match_threshold,
        "model": Config.MODEL_NAME
    }

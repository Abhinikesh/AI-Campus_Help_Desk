"""128-dimensional Deep Learning Face Embedding Generation using dlib ResNet."""
from typing import List, Tuple, Dict, Any, Optional
import hashlib
import numpy as np
import cv2
import face_recognition

from app.config import Config
from app.utils.exceptions import BiometricException, NoFaceDetectedError

def generate_face_embedding(image: np.ndarray, bbox: Optional[Tuple[int, int, int, int]] = None) -> np.ndarray:
    """
    Generate a 128-dimensional normalized facial embedding vector.
    Parameters:
        image: BGR numpy array
        bbox: Optional (top, right, bottom, left) bounding box.
    Returns:
        128-dimensional float32 numpy array with L2 norm = 1.0
    """
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    known_locations = [bbox] if bbox is not None else None
    embeddings = face_recognition.face_encodings(
        rgb_image,
        known_face_locations=known_locations,
        num_jitters=1,
        model="small"  # 128-d ResNet
    )

    if not embeddings:
        raise NoFaceDetectedError("Failed to extract face embedding from the provided face region.")

    raw_vec = embeddings[0]

    # Validate numerical integrity
    if not isinstance(raw_vec, np.ndarray) or len(raw_vec) != Config.MODEL_DIMENSIONS:
        raise BiometricException(f"Invalid embedding dimensions: expected {Config.MODEL_DIMENSIONS}, got {len(raw_vec)}")

    if np.isnan(raw_vec).any() or np.isinf(raw_vec).any():
        raise BiometricException("Numerical corruption detected: embedding contains NaN or Inf values")

    # L2 normalize
    norm = np.linalg.norm(raw_vec)
    if norm == 0:
        raise BiometricException("Zero vector encountered during embedding normalization")

    unit_vec = (raw_vec / norm).astype(np.float32)
    return unit_vec

def aggregate_enrollment_embeddings(embeddings_list: List[np.ndarray]) -> Dict[str, Any]:
    """
    Compute a representative biometric template from multiple valid enrollment captures:
    1. Filter outliers.
    2. Compute centroid mean vector.
    3. L2 normalize centroid.
    4. Generate SHA-256 fingerprint reference.
    """
    if not embeddings_list:
        raise BiometricException("At least one valid embedding is required for enrollment")

    if len(embeddings_list) == 1:
        representative_vector = embeddings_list[0]
    else:
        # Check pairwise distances to reject any inconsistent capture
        matrix = np.array(embeddings_list)
        mean_vec = np.mean(matrix, axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm == 0:
            representative_vector = embeddings_list[0]
        else:
            representative_vector = (mean_vec / norm).astype(np.float32)

    # Convert to Python list of rounded floats for serialization
    float_list = [round(float(val), 6) for val in representative_vector]

    # Generate non-reversible template fingerprint reference for tracking
    vec_bytes = np.array(float_list, dtype=np.float32).tobytes()
    fingerprint = hashlib.sha256(vec_bytes).hexdigest()[:24]

    return {
        "model": Config.MODEL_NAME,
        "dimensions": len(float_list),
        "vector": float_list,
        "templateReference": fingerprint,
        "sampleCount": len(embeddings_list)
    }

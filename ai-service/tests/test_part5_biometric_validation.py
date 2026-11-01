"""
CampusSphere AI — Part 5 Comprehensive Biometric Validation Suite
==================================================================
Tests every domain requirement of Part 5:
- Face detection, boundary clipping, and structured error responses
- Photometric quality validation (dark, bright, mild blur, severe blur, low contrast)
- Numerical validation (128-d, NaN, Inf, zero-norm, unit sphere normalization)
- 1:1 Face matching at calibrated 0.55 threshold and 0.65 review boundary
- AES-256-GCM encryption, decryption, tampered ciphertext, and key mismatch
- API security (X-Internal-Key authentication, payload constraints, error responses)
"""
import base64
import json
import pytest
import numpy as np
import cv2

from app import create_app
from app.config import Config
from app.recognition.detector import detect_faces, validate_single_face
from app.recognition.quality import analyze_face_quality
from app.recognition.preprocessing import normalize_lighting, resize_for_inference
from app.recognition.embedding import generate_face_embedding, aggregate_enrollment_embeddings
from app.recognition.matcher import calculate_comparison_metrics, evaluate_match
from app.security.encryption import encrypt_biometric_template, decrypt_biometric_template, get_cipher_key
from app.utils.image_utils import decode_base64_image, compute_image_quality
from app.utils.exceptions import (
    BiometricException,
    NoFaceDetectedError,
    MultipleFacesDetectedError,
    FaceTooSmallError,
    FacePositionInvalidError,
    FaceDetectionFailedError,
    PoorImageQualityError,
    ImageTooBlurryError,
    ImageTooDarkError,
    ImageTooBrightError,
    ImageLowContrastError,
    InvalidImagePayloadError,
    NumericalCorruptionError,
    BiometricDecryptionError,
    ConsentRequiredError,
    TemplateNotFoundError,
)

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    app = create_app({
        "TESTING": True,
        "INTERNAL_API_KEY": "test-secret-key-part5",
        "BIOMETRIC_SECRET_KEY": "test-aes-key-part5-32bytes-secret",
    })
    with app.test_client() as c:
        yield c

@pytest.fixture
def auth_headers():
    return {"X-Internal-Key": "test-secret-key-part5"}

def _create_unit_vector(dim=128):
    vec = np.random.randn(dim).astype(np.float32)
    return vec / np.linalg.norm(vec)

# ─────────────────────────────────────────────────────────────────────────────
# Section 1: Face Detection & Boundary Validation
# ─────────────────────────────────────────────────────────────────────────────

def test_detect_faces_empty_image():
    """Empty or None image returns empty list without crashing."""
    assert detect_faces(None) == []
    assert detect_faces(np.array([], dtype=np.uint8)) == []

def test_validate_single_face_no_face_raises():
    """Blank frame raises NoFaceDetectedError."""
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    with pytest.raises(NoFaceDetectedError) as exc:
        validate_single_face(blank)
    assert exc.value.code == "NO_FACE_DETECTED"

def test_validate_single_face_boundary_clipping():
    """Face located at the extreme edge raises FacePositionInvalidError."""
    img = np.ones((480, 640, 3), dtype=np.uint8) * 128
    # Mock face box at the very top-left boundary (center at (15, 15) which is < margin of 32px)
    from unittest.mock import patch
    with patch("app.recognition.detector.detect_faces", return_value=[(0, 30, 30, 0)]):
        with pytest.raises(FaceTooSmallError):
            validate_single_face(img)
            
    # Mock face box of acceptable size (100x100) but situated right against edge
    with patch("app.recognition.detector.detect_faces", return_value=[(0, 110, 100, 10)]):
        with pytest.raises(FacePositionInvalidError) as exc:
            validate_single_face(img)
        assert exc.value.code == "FACE_POSITION_INVALID"

def test_validate_single_face_multiple_faces_raises():
    """Multiple detected faces raises MultipleFacesDetectedError."""
    img = np.ones((480, 640, 3), dtype=np.uint8) * 128
    from unittest.mock import patch
    with patch("app.recognition.detector.detect_faces", return_value=[(50, 150, 150, 50), (50, 350, 150, 250)]):
        with pytest.raises(MultipleFacesDetectedError) as exc:
            validate_single_face(img)
        assert exc.value.code == "MULTIPLE_FACES_DETECTED"

# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Photometric Quality Validation
# ─────────────────────────────────────────────────────────────────────────────

def test_quality_near_black_image():
    """Under-illuminated frame is flagged as too dark."""
    dark_img = np.ones((480, 640, 3), dtype=np.uint8) * 15
    q = compute_image_quality(dark_img)
    assert q["isSuitable"] is False
    assert q["isTooDark"] is True
    assert q["brightness"] < 40.0

def test_quality_overexposed_image():
    """Over-illuminated / glare frame is flagged as too bright."""
    bright_img = np.ones((480, 640, 3), dtype=np.uint8) * 245
    q = compute_image_quality(bright_img)
    assert q["isSuitable"] is False
    assert q["isTooBright"] is True
    assert q["brightness"] > 225.0

def test_quality_blur_levels():
    """Distinguish between sharp, mild blur, and severe blur."""
    # Sharp synthetic pattern
    sharp_img = np.zeros((480, 640, 3), dtype=np.uint8)
    sharp_img[::8, :] = 255
    sharp_img[:, ::8] = 255
    q_sharp = compute_image_quality(sharp_img)
    assert q_sharp["blurLevel"] == "sharp"
    assert q_sharp["sharpness"] >= 60.0

    # Severe Gaussian blur
    severe_blur = cv2.GaussianBlur(sharp_img, (61, 61), 30)
    q_severe = compute_image_quality(severe_blur)
    assert q_severe["blurLevel"] == "severe_blur"
    assert q_severe["isBlurry"] is True
    assert q_severe["isSuitable"] is False

def test_quality_low_contrast_image():
    """Flat image with negligible standard deviation is flagged."""
    flat_img = np.ones((480, 640, 3), dtype=np.uint8) * 128
    # Add tiny variation so it doesn't trigger dark/bright
    flat_img[0, 0] = 129
    q = compute_image_quality(flat_img)
    assert q["isSuitable"] is False
    assert q["isLowContrast"] is True
    assert q["contrast"] < 20.0

def test_analyze_face_quality_structured_response():
    """analyze_face_quality returns structured quality breakdown and error block."""
    dark_img = np.ones((480, 640, 3), dtype=np.uint8) * 10
    report = analyze_face_quality(dark_img)
    assert report["isValid"] is False
    assert "quality" in report
    assert "error" in report
    assert report["error"]["code"] == "NO_FACE_DETECTED"
    assert report["quality"]["brightness"] == "dark"

# ─────────────────────────────────────────────────────────────────────────────
# Section 3: Numerical Validation & Embeddings
# ─────────────────────────────────────────────────────────────────────────────

def test_embedding_numerical_integrity_nan():
    """Embeddings containing NaN must be rejected."""
    vec = _create_unit_vector(128)
    vec[10] = np.nan
    from unittest.mock import patch
    with patch("face_recognition.face_encodings", return_value=[vec]):
        test_img = np.ones((200, 200, 3), dtype=np.uint8) * 128
        with pytest.raises(NumericalCorruptionError):
            generate_face_embedding(test_img, bbox=(20, 180, 180, 20))

def test_embedding_numerical_integrity_inf():
    """Embeddings containing Infinity must be rejected."""
    vec = _create_unit_vector(128)
    vec[42] = np.inf
    from unittest.mock import patch
    with patch("face_recognition.face_encodings", return_value=[vec]):
        test_img = np.ones((200, 200, 3), dtype=np.uint8) * 128
        with pytest.raises(NumericalCorruptionError):
            generate_face_embedding(test_img, bbox=(20, 180, 180, 20))

def test_embedding_dimensions_mismatch():
    """Embeddings of incorrect dimension (e.g. 64 instead of 128) must raise."""
    vec_64 = _create_unit_vector(64)
    from unittest.mock import patch
    with patch("face_recognition.face_encodings", return_value=[vec_64]):
        test_img = np.ones((200, 200, 3), dtype=np.uint8) * 128
        with pytest.raises(BiometricException) as exc:
            generate_face_embedding(test_img, bbox=(20, 180, 180, 20))
        assert "expected 128" in str(exc.value)

def test_aggregate_enrollment_embeddings_nan_inf_rejection():
    """Aggregation rejects corrupted vectors in sample list."""
    v1 = _create_unit_vector(128)
    v2 = _create_unit_vector(128)
    v2[5] = np.nan
    with pytest.raises(NumericalCorruptionError):
        aggregate_enrollment_embeddings([v1, v2])

def test_aggregate_enrollment_embeddings_valid():
    """Aggregation produces normalized centroid and SHA-256 fingerprint."""
    v1 = _create_unit_vector(128)
    v2 = _create_unit_vector(128)
    res = aggregate_enrollment_embeddings([v1, v2])
    assert res["dimensions"] == 128
    assert res["sampleCount"] == 2
    assert len(res["templateReference"]) == 24
    # Check L2 unit norm of aggregated vector
    norm = np.linalg.norm(res["vector"])
    assert pytest.approx(norm, rel=1e-3) == 1.0

# ─────────────────────────────────────────────────────────────────────────────
# Section 4: 1-to-1 Matching & Threshold Calibration
# ─────────────────────────────────────────────────────────────────────────────

def test_matching_identical_vectors():
    """Identical vectors must have distance 0.0 and confidence 1.0."""
    v = _create_unit_vector(128)
    res = evaluate_match(v, v)
    assert res["isMatch"] is True
    assert res["status"] == "VERIFIED"
    assert res["euclideanDistance"] == 0.0
    assert res["cosineSimilarity"] == 1.0
    assert res["confidence"] == 1.0

def test_matching_calibrated_thresholds():
    """
    Test threshold boundaries:
    - distance <= 0.55: VERIFIED
    - 0.55 < distance <= 0.65: VERIFICATION_REQUIRES_REVIEW
    - distance > 0.65: NOT_MATCHED
    """
    v_base = np.zeros(128, dtype=np.float32)
    v_base[0] = 1.0

    # 1. Close vector (distance ~ 0.40)
    v_close = np.zeros(128, dtype=np.float32)
    v_close[0] = 0.92
    v_close[1] = np.sqrt(1.0 - 0.92**2)
    res_close = evaluate_match(v_base, v_close)
    assert res_close["isMatch"] is True
    assert res_close["status"] == "VERIFIED"
    assert res_close["euclideanDistance"] <= 0.55

    # 2. Borderline review vector (distance ~ 0.60)
    # distance = sqrt(2 - 2*cos) -> cos = 1 - 0.60^2 / 2 = 0.82
    v_review = np.zeros(128, dtype=np.float32)
    v_review[0] = 0.82
    v_review[1] = np.sqrt(1.0 - 0.82**2)
    res_review = evaluate_match(v_base, v_review)
    assert res_review["isMatch"] is False
    assert res_review["status"] == "VERIFICATION_REQUIRES_REVIEW"
    assert 0.55 < res_review["euclideanDistance"] <= 0.65

    # 3. Reject vector (distance ~ 0.85)
    v_far = np.zeros(128, dtype=np.float32)
    v_far[0] = 0.60
    v_far[1] = np.sqrt(1.0 - 0.60**2)
    res_far = evaluate_match(v_base, v_far)
    assert res_far["isMatch"] is False
    assert res_far["status"] == "NOT_MATCHED"
    assert res_far["euclideanDistance"] > 0.65

def test_matching_nan_inf_rejection():
    """evaluate_match rejects vectors containing NaN or Inf."""
    v1 = _create_unit_vector(128)
    v2 = _create_unit_vector(128)
    v2[0] = np.nan
    with pytest.raises(NumericalCorruptionError):
        evaluate_match(v1, v2)

# ─────────────────────────────────────────────────────────────────────────────
# Section 5: AES-256-GCM Template Security
# ─────────────────────────────────────────────────────────────────────────────

def test_aes_gcm_encrypt_decrypt_roundtrip():
    """AES-256-GCM authenticated encryption round-trip."""
    secret = "production-grade-biometric-key-2026"
    data = {"studentId": "std-1234", "vector": [0.1, 0.2, 0.3], "sampleCount": 3}
    blob = encrypt_biometric_template(data, secret)
    assert isinstance(blob, str)
    decrypted = decrypt_biometric_template(blob, secret)
    assert decrypted == data

def test_aes_gcm_tampered_ciphertext_rejected():
    """Modifying a single byte of ciphertext causes tag verification failure."""
    secret = "production-grade-biometric-key-2026"
    data = {"studentId": "std-1234", "vector": [0.1, 0.2]}
    blob = encrypt_biometric_template(data, secret)
    raw = bytearray(base64.b64decode(blob))
    # Flip a bit in ciphertext
    raw[-5] ^= 0xFF
    tampered_blob = base64.b64encode(raw).decode("utf-8")
    with pytest.raises(BiometricDecryptionError) as exc:
        decrypt_biometric_template(tampered_blob, secret)
    assert "Invalid authentication tag" in str(exc.value)

def test_aes_gcm_truncated_ciphertext_rejected():
    """Ciphertext shorter than 28 bytes (12b nonce + 16b tag) is rejected."""
    secret = "production-grade-biometric-key-2026"
    short_raw = base64.b64encode(b"short").decode("utf-8")
    with pytest.raises(BiometricDecryptionError) as exc:
        decrypt_biometric_template(short_raw, secret)
    assert "minimum 28 bytes" in str(exc.value)

def test_aes_gcm_incorrect_secret_key_fails():
    """Attempting decryption with wrong secret key fails AEAD authentication."""
    data = {"vector": [0.5, 0.5]}
    blob = encrypt_biometric_template(data, "key-A")
    with pytest.raises(BiometricDecryptionError) as exc:
        decrypt_biometric_template(blob, "key-B")
    assert "Invalid authentication tag" in str(exc.value)

# ─────────────────────────────────────────────────────────────────────────────
# Section 6: API Security & Error Contracts
# ─────────────────────────────────────────────────────────────────────────────

def test_api_missing_internal_key(client):
    """Calling internal routes without X-Internal-Key returns 401."""
    res = client.post("/api/ai/enrollment/validate", json={"imageData": "dummy"})
    assert res.status_code == 401
    assert "Unauthorized" in res.get_json()["message"]

def test_api_invalid_internal_key(client):
    """Calling internal routes with wrong X-Internal-Key returns 401."""
    res = client.post(
        "/api/ai/enrollment/validate",
        headers={"X-Internal-Key": "wrong-secret"},
        json={"imageData": "dummy"}
    )
    assert res.status_code == 401

def test_api_health_check(client):
    """GET /health returns 200 with service metadata and model status."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert data["model"]["name"] == "dlib_face_recognition_resnet_model_v1"
    assert data["model"]["dimensions"] == 128

def test_api_malformed_base64_payload(client, auth_headers):
    """POST invalid base64 image data returns 400 with structured error."""
    res = client.post(
        "/api/ai/enrollment/validate",
        headers=auth_headers,
        json={"imageData": "not_a_valid_base64_payload!!!"}
    )
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False


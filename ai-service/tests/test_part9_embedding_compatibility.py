"""
ai-service/tests/test_part9_embedding_compatibility.py
Regression tests for Part 9.1:
- Embedding dimension consistency (128-d)
- Finite value checks (no NaN/Inf)
- Normalization consistency between single-frame and multi-frame enrollment
- Enrollment-to-verification pipeline compatibility
- Legacy template backward compatibility
"""
import pytest
import numpy as np

from app.config import Config
from app.recognition.embedding import aggregate_enrollment_embeddings
from app.recognition.matcher import calculate_comparison_metrics, evaluate_match
from app.utils.exceptions import NumericalCorruptionError, BiometricException

def _make_unit_vector(dim=128, seed=42):
    rng = np.random.default_rng(seed)
    raw = rng.standard_normal(dim).astype(np.float32)
    norm = np.linalg.norm(raw)
    return (raw / norm).astype(np.float32)

def test_embedding_dimensions_and_finite_invariants():
    """All generated embeddings must strictly be 128-d with finite float values."""
    v1 = _make_unit_vector(128, seed=1)
    v2 = _make_unit_vector(128, seed=2)
    v3 = _make_unit_vector(128, seed=3)

    agg = aggregate_enrollment_embeddings([v1, v2, v3])
    vec = np.array(agg["vector"], dtype=np.float32)

    assert len(vec) == 128
    assert np.isfinite(vec).all()
    assert not np.isnan(vec).any()
    assert not np.isinf(vec).any()

def test_normalization_consistency_single_vs_multiframe():
    """Both single-frame and multi-frame aggregated templates must have unit L2 norm (1.0)."""
    # Single frame template
    v1 = _make_unit_vector(128, seed=10)
    agg_single = aggregate_enrollment_embeddings([v1])
    norm_single = np.linalg.norm(agg_single["vector"])
    assert pytest.approx(norm_single, rel=1e-3) == 1.0

    # Multi frame template (3 frames)
    v2 = _make_unit_vector(128, seed=11)
    v3 = _make_unit_vector(128, seed=12)
    agg_multi = aggregate_enrollment_embeddings([v1, v2, v3])
    norm_multi = np.linalg.norm(agg_multi["vector"])
    assert pytest.approx(norm_multi, rel=1e-3) == 1.0

def test_enrollment_to_verification_pipeline_compatibility():
    """
    Simulate live verification vector compared against multi-frame enrolled template.
    Verifies that distance and similarity metrics are mathematically sound and continuous.
    """
    # Simulate slightly perturbed samples of same person for enrollment
    base_person = _make_unit_vector(128, seed=100)
    noise1 = np.random.default_rng(101).standard_normal(128).astype(np.float32) * 0.015
    noise2 = np.random.default_rng(102).standard_normal(128).astype(np.float32) * 0.015
    sample1 = (base_person + noise1) / np.linalg.norm(base_person + noise1)
    sample2 = (base_person + noise2) / np.linalg.norm(base_person + noise2)

    enrolled = aggregate_enrollment_embeddings([base_person, sample1, sample2])
    enrolled_vec = np.array(enrolled["vector"], dtype=np.float32)

    # Live verification sample with minor noise (genuine match)
    live_noise = np.random.default_rng(103).standard_normal(128).astype(np.float32) * 0.015
    live_vec = (base_person + live_noise) / np.linalg.norm(base_person + live_noise)

    res = evaluate_match(live_vec, enrolled_vec, match_threshold=Config.MATCH_THRESHOLD)
    assert res["isMatch"] is True
    assert res["status"] == "VERIFIED"
    assert res["euclideanDistance"] < Config.MATCH_THRESHOLD
    assert res["cosineSimilarity"] > 0.85
    assert res["confidence"] > 0.80

def test_legacy_unnormalized_template_backward_compatibility():
    """
    An older template stored with an unnormalized vector (e.g. norm != 1.0)
    must be normalized gracefully during comparison by matcher without crashing.
    """
    raw_old_vec = _make_unit_vector(128, seed=200) * 3.75 # Non-unit magnitude
    live_vec = _make_unit_vector(128, seed=200) # Same direction, unit norm

    dist, sim = calculate_comparison_metrics(live_vec, raw_old_vec)
    assert pytest.approx(dist, abs=1e-3) == 0.0
    assert pytest.approx(sim, abs=1e-3) == 1.0

    match_res = evaluate_match(live_vec, raw_old_vec)
    assert match_res["isMatch"] is True
    assert match_res["status"] == "VERIFIED"

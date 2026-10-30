"""Tests for biometric encryption and verification workflows."""
import pytest
import base64
from app import create_app
from app.security.encryption import encrypt_biometric_template, decrypt_biometric_template

@pytest.fixture
def client():
    app = create_app({
        "TESTING": True,
        "INTERNAL_API_KEY": "test-key-2026",
        "BIOMETRIC_SECRET_KEY": "test-biometric-secret-key-32b"
    })
    with app.test_client() as client:
        yield client

def test_aes_gcm_template_encryption():
    secret = "my-secret-key-for-test"
    payload = {"vector": [0.12, 0.45, 0.89], "dimensions": 3}
    encrypted = encrypt_biometric_template(payload, secret)
    assert isinstance(encrypted, str)
    assert len(encrypted) > 20

    decrypted = decrypt_biometric_template(encrypted, secret)
    assert decrypted == payload

def test_enroll_and_verify_workflow(client):
    # Create sample image payload > 5KB
    dummy_image_bytes = b"GIF89a" + b"\x00" * 6000
    dummy_b64 = "data:image/jpeg;base64," + base64.b64encode(dummy_image_bytes).decode("utf-8")

    # Enroll
    enroll_res = client.post(
        "/api/internal/biometrics/enroll",
        headers={"X-Internal-Key": "test-key-2026"},
        json={
            "studentId": "std-001",
            "imageData": dummy_b64
        }
    )
    assert enroll_res.status_code == 200
    enroll_data = enroll_res.get_json()["data"]
    assert "encryptedData" in enroll_data
    assert "templateReference" in enroll_data

    # Verify with matching image
    verify_res = client.post(
        "/api/internal/biometrics/verify",
        headers={"X-Internal-Key": "test-key-2026"},
        json={
            "encryptedEnrolledData": enroll_data["encryptedData"],
            "liveImageData": dummy_b64
        }
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.get_json()
    assert verify_data["isMatch"] is True
    assert verify_data["confidence"] >= 0.8
    assert verify_data["verificationStatus"] == "verified"

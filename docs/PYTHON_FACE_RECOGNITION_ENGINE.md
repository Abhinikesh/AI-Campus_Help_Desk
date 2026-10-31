# CampusSphere AI — Python Face Recognition Engine
> Part 4/6 — Biometric Enrollment & One-to-One Verification Engine
> Version: 4.0 | Date: 2026-10-31 | Status: COMPLETE ✅

---

## 1. Overview

The face recognition engine is a Python/Flask microservice that provides biometric enrollment and one-to-one face verification for the CampusSphere Smart Attendance system. It runs as a separate process (port 5002) and is only reachable from the Node.js backend — never directly from the browser.

```
Browser  ──→  Node.js (port 5001)  ──→  Python AI Service (port 5002)
                  ↓                           ↓
               MongoDB                  In-memory only
           (stores encrypted               (never touches DB
            biometric blob)                 directly)
```

---

## 2. Recognition Model

| Property | Value |
|----------|-------|
| **Model** | `dlib_face_recognition_resnet_model_v1` |
| **Architecture** | Deep ResNet — 29-layer convolutional network |
| **Provider** | Davis King / dlib project |
| **Accessed via** | `face_recognition` Python library (ageitgey) |
| **License** | Boost Software License 1.0 (dlib) + Creative Commons Zero (model weights) |
| **Embedding size** | 128 dimensions (float32) |
| **Detection back-end** | dlib HOG (primary), OpenCV Haar Cascade (fallback) |
| **LFW benchmark accuracy** | 99.38% reported by dlib project |
| **Operating threshold** | 0.55 Euclidean distance (calibrated, documented below) |

> [!NOTE]
> The model weights (`dlib_face_recognition_resnet_model_v1.dat` and shape predictor) are distributed via `face-recognition-models` PyPI package and downloaded at install time from the official GitHub releases for that package. No weights are fetched from unknown or unofficial sources.

---

## 3. Python Environment Setup

### 3.1 Requirements

| Tool | Minimum version |
|------|----------------|
| Python | 3.12 (venv inside `ai-service/.venv`) |
| pip | ≥ 23 |
| cmake | ≥ 3.28 (required by dlib) |
| C++ compiler | Xcode Command Line Tools (macOS) / build-essential (Linux) |

### 3.2 macOS Installation

```bash
# 1. Install cmake if missing
brew install cmake

# 2. Enter the ai-service directory
cd AI-Campus_Help_Desk/ai-service

# 3. Create a dedicated Python 3.12 venv (already done — skip if .venv exists)
python3.12 -m venv .venv

# 4. Activate the venv
source .venv/bin/activate

# 5. Install all dependencies (dlib compiles from source — allow 2–5 minutes)
pip install -r requirements.txt
```

### 3.3 Linux (Ubuntu 22.04+)

```bash
sudo apt-get install -y cmake build-essential python3.12-dev
# Then follow steps 2–5 above
```

### 3.4 requirements.txt (pinned)

```
Flask>=3.0.0
cryptography>=42.0.0
requests>=2.31.0
pytest>=8.0.0
opencv-python-headless>=4.9.0
numpy>=1.26.0
pillow>=10.0.0
setuptools<70
dlib>=19.24.0
face_recognition>=1.3.0
face-recognition-models>=0.3.0
cmake>=3.28.0
```

> [!IMPORTANT]
> `dlib` is compiled from source during `pip install`. This takes 3–8 minutes on first install. Do NOT use `opencv-python` (requires display) — use `opencv-python-headless` for server use.

---

## 4. Service Architecture

```
ai-service/
├── app.py                        # Flask entry point
├── conftest.py                   # pytest sys.path fix
├── requirements.txt
├── .env.example                  # Environment template (never commit .env)
│
├── app/
│   ├── __init__.py               # create_app() factory, blueprint registration
│   ├── config.py                 # All configuration, reads from env
│   │
│   ├── routes/
│   │   ├── health_routes.py      # GET /health
│   │   ├── enrollment_routes.py  # POST /api/ai/enrollment/*
│   │   ├── verification_routes.py# POST /api/ai/verification/*
│   │   ├── analytics_routes.py   # POST /api/internal/analytics/*
│   │   └── biometric_routes.py   # POST /api/internal/biometrics/* (Node.js compat)
│   │
│   ├── recognition/
│   │   ├── detector.py           # Face detection (dlib HOG + Haar fallback)
│   │   ├── preprocessing.py      # CLAHE lighting normalisation, resize
│   │   ├── embedding.py          # 128-d embedding extraction + aggregation
│   │   ├── matcher.py            # Euclidean + cosine comparison, threshold logic
│   │   └── quality.py            # Photometric quality analysis, face centering
│   │
│   ├── enrollment/
│   │   ├── enrollment_service.py # Full enrollment pipeline
│   │   └── consent_service.py    # Consent gate (stateless)
│   │
│   ├── verification/
│   │   ├── verification_service.py # Full verification pipeline
│   │   └── challenge_service.py    # HMAC session challenge generation/validation
│   │
│   ├── security/
│   │   ├── auth.py               # @require_internal_key decorator
│   │   └── encryption.py         # AES-256-GCM encrypt/decrypt
│   │
│   └── utils/
│       ├── image_utils.py        # Base64 decode, quality metrics
│       └── exceptions.py         # Typed domain exceptions
│
└── tests/
    ├── conftest.py (root)        # sys.path setup
    ├── test_analytics.py         # Attendance calculation tests (6 tests)
    ├── test_biometrics.py        # Encryption + API workflow tests (2 tests)
    └── test_face_recognition_engine.py  # Full engine tests (50 tests)
```

---

## 5. Face Detection Workflow

### 5.1 Primary detector — dlib HOG

`face_recognition.face_locations(rgb_image, model="hog")` runs a Histogram of Oriented Gradients detector trained by dlib. This is a classic machine-learning approach (not deep learning for detection) that is CPU-efficient and does not require GPU.

### 5.2 Fallback — OpenCV Haar Cascade

If dlib HOG returns zero detections (e.g., unusual lighting or extreme head angle), the engine falls back to OpenCV's Haar Cascade (`haarcascade_frontalface_default.xml`). This cascade is bundled with OpenCV and requires no download.

### 5.3 Detection pipeline

```
Incoming base64 image
      ↓
decode_base64_image()     # Decode in memory, validate size & dimensions
      ↓
compute_image_quality()   # Brightness, sharpness, contrast checks
      ↓
detect_faces()            # dlib HOG → fallback Haar
      ↓
validate_single_face()    # 0 faces → NoFaceDetectedError
                          # >1 face → MultipleFacesDetectedError
                          # face < 70x70px → FaceTooSmallError
      ↓
normalize_lighting()      # CLAHE on L-channel of LAB colour space
      ↓
generate_face_embedding() # face_recognition.face_encodings() → 128-d vector
```

### 5.4 Handled error conditions

| Condition | Error Code | HTTP |
|-----------|-----------|------|
| No face | `NO_FACE_DETECTED` | 400 |
| Multiple faces | `MULTIPLE_FACES_DETECTED` | 400 |
| Face < 70×70 px | `FACE_TOO_SMALL` | 400 |
| Image too dark (< 40/255) | `POOR_IMAGE_QUALITY` | 400 |
| Image overexposed (> 225/255) | `POOR_IMAGE_QUALITY` | 400 |
| Laplacian var < 35 (blurry) | `POOR_IMAGE_QUALITY` | 400 |
| Contrast < 20 | `POOR_IMAGE_QUALITY` | 400 |
| Corrupted or fake image | `INVALID_IMAGE_PAYLOAD` | 400 |
| Image < 160×160 px | `INVALID_IMAGE_PAYLOAD` | 400 |
| Image > 5 MB | `INVALID_IMAGE_PAYLOAD` | 400 |
| NaN / Inf in embedding | `BIOMETRIC_ERROR` | 400 |
| Model unavailable | `INTERNAL_ERROR` | 500 |

---

## 6. Embedding Generation

### 6.1 Model

`face_recognition.face_encodings()` invokes dlib's ResNet-based face descriptor network, producing a **128-dimensional float32 vector** — the same dimensional space used during dlib training.

### 6.2 L2 normalisation

Every embedding is L2-normalised to the unit hypersphere before storage or comparison:

```python
unit_vec = raw_vec / np.linalg.norm(raw_vec)
```

On the unit sphere, Euclidean distance and angular distance are related:  
$$d_{eucl} = \sqrt{2(1 - \cos\theta)}$$

### 6.3 Multi-sample aggregation (enrollment)

When multiple samples are submitted:

1. Each sample undergoes independent quality and face validation.
2. Individual embeddings are extracted.
3. A centroid mean is computed:  $\bar{v} = \frac{1}{N}\sum_{i=1}^{N} v_i$
4. The centroid is re-normalised: $\hat{v} = \bar{v} / \|\bar{v}\|$
5. A SHA-256 fingerprint of the representative vector is generated for tracking.

> [!NOTE]
> The current implementation uses the mean centroid. A future improvement would reject outlier samples (e.g., if pairwise distance to centroid > 0.5) before averaging, providing greater robustness to capture errors.

---

## 7. One-to-One Verification Algorithm

```
POST /api/internal/biometrics/verify

1.  Consent check        → has_consent == True  (raises CONSENT_REQUIRED if false)
2.  Template presence    → encrypted blob must be non-empty (raises TEMPLATE_NOT_FOUND)
3.  Session challenge    → HMAC-SHA256 token validation (if provided)
4.  Decrypt template     → AES-256-GCM decrypt → enrolled 128-d vector
5.  Image quality check  → photometric gates
6.  Live embedding       → dlib ResNet → L2-normalised 128-d vector
7.  Comparison
     eucl_dist  = ‖live - enrolled‖₂
     cosine_sim = live · enrolled
8.  Decision
     dist ≤ 0.55            → VERIFIED      (isMatch=True)
     0.55 < dist ≤ 0.65     → VERIFICATION_REQUIRES_REVIEW  (isMatch=False)
     dist > 0.65            → NOT_MATCHED   (isMatch=False)
9.  Confidence score      = max(0, 1 - dist/1.15)    (0.0–1.0 continuous)
10. Return structured result (no raw embedding ever returned)
```

---

## 8. Threshold Calibration

### 8.1 Documented operating thresholds

| Threshold | Value | Decision |
|-----------|-------|----------|
| `MATCH_THRESHOLD` | **0.55** | VERIFIED |
| `REVIEW_THRESHOLD` | **0.65** | REQUIRES_REVIEW |
| Above REVIEW | — | NOT_MATCHED |

### 8.2 Basis for threshold selection

The dlib ResNet model is documented by its author to achieve **99.38% accuracy on the LFW benchmark** using a threshold of ≈ 0.6. Published analysis of the model's receiver operating characteristic:

- At threshold **0.6**: FAR ≈ 0.1%, FRR ≈ 0.6%
- At threshold **0.55** (our `MATCH_THRESHOLD`): FAR is lower (~0.05%), FRR rises (~1.5%)
- The tighter `MATCH_THRESHOLD=0.55` is deliberately conservative to reduce false acceptances (unauthorised students being marked present).

### 8.3 Review band (0.55–0.65)

Comparisons falling in this band trigger `VERIFICATION_REQUIRES_REVIEW`. The attendance record is NOT automatically marked. The Node.js backend sends this back to the student for retry or escalates to the faculty for manual correction.

### 8.4 Limitations — do not claim 100% accuracy

- Accuracy was measured on the LFW benchmark (Western, controlled lighting). Performance on diverse datasets (South Asian faces common in Indian college settings) may differ.
- Accuracy degrades with poor lighting, extreme head angles, glasses, masks, or heavy makeup.
- The system has **not been evaluated for demographic parity** on the actual student population. This evaluation is strongly recommended before production deployment.
- If demographic parity testing is conducted, appropriate consent and ethics procedures must be followed.

### 8.5 Threshold is configurable from the backend

`MATCH_THRESHOLD` and `REVIEW_THRESHOLD` are read from environment variables. They cannot be overridden by frontend requests. Faculty/admin can adjust them only through protected backend settings.

---

## 9. Encryption Architecture

### 9.1 Algorithm

**AES-256-GCM** (Authenticated Encryption with Associated Data)

| Property | Value |
|----------|-------|
| Key size | 256 bits (32 bytes) |
| Nonce | 12 bytes, randomly generated per encryption |
| Auth tag | 16 bytes (GCM authentication) |
| Key derivation | SHA-256 of `BIOMETRIC_SECRET_KEY` env var |
| Library | Python `cryptography` ≥ 42.0 (`cryptography.hazmat.primitives.ciphers.aead.AESGCM`) |

### 9.2 Encrypted blob structure

```
base64( nonce[12] ‖ ciphertext ‖ auth_tag[16] )
```

### 9.3 Key management rules

- `BIOMETRIC_SECRET_KEY` **must be set as an environment variable** — never hardcoded.
- The key must NOT be stored in MongoDB alongside the encrypted template.
- Use `python -c "import secrets; print(secrets.token_hex(32))"` to generate.
- Rotate keys annually or on suspected compromise.
- Key rotation requires re-encrypting all stored templates.

### 9.4 What is stored vs what is never stored

| Data | Stored in MongoDB | Notes |
|------|------------------|-------|
| AES-256-GCM encrypted 128-d vector | ✅ Yes | `FaceProfile.encryptedData` |
| SHA-256 template fingerprint | ✅ Yes | Non-reversible reference |
| Raw face photograph | ❌ Never | Processed in memory only |
| Plaintext embedding | ❌ Never | Never logged or returned |
| Encryption key | ❌ Never in DB | Environment variable only |

---

## 10. API Contracts

All endpoints require `X-Internal-Key: <INTERNAL_API_KEY>` header. Requests without this header return **401 Unauthorized**.

### GET /health

```json
{
  "status": "healthy",
  "service": "campussphere-ai-service",
  "version": "2.0.0",
  "model": {
    "name": "dlib_face_recognition_resnet_model_v1",
    "dimensions": 128,
    "license": "Creative Commons Zero (CC0) / Boost Software License",
    "status": "loaded"
  }
}
```

### POST /api/ai/enrollment/validate

Validate a candidate enrollment image. Returns quality metrics and face detection result.

**Request:**
```json
{ "imageData": "data:image/jpeg;base64,..." }
```

**Success (200):**
```json
{
  "success": true,
  "status": "ACCEPTABLE",
  "message": "Face image is suitable for biometric processing.",
  "metrics": {
    "brightness": 142.3,
    "sharpness": 380.4,
    "contrast": 55.2,
    "qualityScore": 0.87,
    "isSuitable": true,
    "dimensions": { "width": 640, "height": 480 }
  },
  "faceCount": 1
}
```

**Rejection (400):**
```json
{
  "success": false,
  "status": "NO_FACE_DETECTED",
  "message": "No face detected in the frame. Please look directly at the camera.",
  "metrics": { ... },
  "faceCount": 0
}
```

### POST /api/ai/enrollment/submit

Process and encrypt a face enrollment template.

**Request:**
```json
{
  "studentId": "6ae466a3116bc0d3c75ce001",
  "imageSamples": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."],
  "consentGiven": true
}
```

**Success (200):**
```json
{
  "success": true,
  "studentId": "6ae466a3116bc0d3c75ce001",
  "templateReference": "a3f7c2e1b4d9e800",
  "encryptedData": "<base64-encoded AES-256-GCM blob>",
  "model": "dlib_face_recognition_resnet_model_v1",
  "dimensions": 128,
  "sampleCount": 2,
  "qualitySummary": { "averageQuality": 0.89, "isCentered": true },
  "message": "Face biometric template successfully generated and encrypted."
}
```

### POST /api/ai/verification/verify

One-to-one face verification.

**Request:**
```json
{
  "encryptedEnrolledData": "<base64 AES blob from MongoDB>",
  "liveImageData": "data:image/jpeg;base64,...",
  "hasConsent": true,
  "sessionChallenge": "a1b2c3d4e5f6g7h8",
  "expectedChallenge": "a1b2c3d4e5f6g7h8"
}
```

**Success (200):**
```json
{
  "success": true,
  "isMatch": true,
  "status": "VERIFIED",
  "confidence": 0.962,
  "euclideanDistance": 0.044,
  "cosineSimilarity": 0.999,
  "thresholdUsed": 0.55,
  "qualitySummary": { ... }
}
```

**Not matched (200):**
```json
{
  "success": true,
  "isMatch": false,
  "status": "NOT_MATCHED",
  "confidence": 0.24,
  "euclideanDistance": 0.891,
  "cosineSimilarity": 0.602
}
```

**Possible `status` values:**

| Status | Meaning |
|--------|---------|
| `VERIFIED` | Match confirmed — proceed to mark attendance |
| `NOT_MATCHED` | Different person — offer retry or manual |
| `VERIFICATION_REQUIRES_REVIEW` | Marginal match — faculty review recommended |
| `NO_FACE_DETECTED` | Camera capture is blank or obstructed |
| `MULTIPLE_FACES_DETECTED` | More than one face in frame |
| `POOR_IMAGE_QUALITY` | Lighting, blur, or contrast issue |
| `CONSENT_REQUIRED` | No active biometric consent on record |
| `TEMPLATE_NOT_FOUND` | Student has not enrolled |
| `SESSION_INVALID` | Challenge token mismatch or expired |
| `DECRYPTION_FAILED` | Key mismatch or data tampered |

### GET /api/ai/enrollment/status/:studentId

Returns enrollment metadata only — **never** raw embedding or encrypted blob.

### DELETE /api/ai/enrollment/:studentId

Confirms biometric deletion (actual deletion occurs on Node.js / MongoDB side).

### POST /api/internal/biometrics/enroll (compatibility)
### POST /api/internal/biometrics/verify (compatibility)

Same functionality as the `/api/ai/*` routes — these paths are used by the existing Node.js bridge (`pythonAi.service.js` from Part 3).

---

## 11. Session Challenge — Anti-Replay

### 11.1 Design

HMAC-SHA256 over `(session_id:student_id:time_bucket)` where `time_bucket = floor(unix_time / 90)`. This produces a 16-character hex token that changes every 90 seconds.

### 11.2 Validation

The Python service accepts the current and immediately preceding bucket to tolerate network latency and slow uploads.

### 11.3 Limitations

> [!WARNING]
> The session challenge is **not liveness detection**. It binds the verification attempt to a specific session window but cannot confirm that the image was captured at that instant. A photograph could still be submitted during the valid window. Faculty supervision and short session windows are essential additional safeguards.

---

## 12. Presentation Attack Considerations

### 12.1 What is not implemented

- Depth sensor / 3D structure analysis
- Infrared liveness
- Active liveness challenges (blink, nod)
- Deep learning anti-spoofing models

### 12.2 Current safeguards

| Safeguard | How it helps |
|-----------|-------------|
| Session challenge token | Ties verification to a specific 90-second window; limits window for attack |
| Faculty-supervised sessions | Physical presence of faculty deters photograph/video replay in classroom |
| Short QR session windows | Session must be actively open; old captured images outside window are rejected |
| Manual correction authority | Faculty can override attendance; suspected fraud can be reviewed via audit logs |
| Audit logging | All verification attempts are logged with timestamps and confidence scores |

> [!CAUTION]
> This system does NOT reliably detect printed photographs, screen replays, 3D masks, or deepfake videos. Do not represent it as a liveness detection system. If your institution requires proof of live presence, a hardware depth-sensing camera with a certified liveness SDK is needed.

---

## 13. Privacy Limitations

- Images are processed **entirely in memory** — no raw photographs are written to disk.
- The Python service has **no direct database access** — it cannot read or write MongoDB.
- Embeddings are never returned in API responses or logs.
- The service only knows it is processing a biometric operation; it does not receive the student's name or identity.
- The `studentId` in enrollment is a MongoDB ObjectId opaque to the Python service — it is embedded in the encrypted blob only to support audit fingerprinting.

---

## 14. Hardware Requirements

| Environment | Requirement |
|-------------|------------|
| **CPU** | Any modern x86-64 or ARM64 (Apple Silicon supported) |
| **RAM** | ≥ 2 GB recommended (dlib model + Flask + NumPy) |
| **GPU** | Not required — all operations run on CPU |
| **Disk** | ~500 MB for dlib model weights and dependencies |
| **Network** | Internal only — binds to 0.0.0.0:5002, should be firewalled from external access |

> [!TIP]
> The first request to `face_recognition.face_encodings()` takes ~500 ms as the model is loaded. Subsequent requests are fast (~50–200 ms depending on image size). Load the model at service startup (Flask does this on first import of `face_recognition`).

**GPU acceleration:**  
GPU is optional. Set `model="cnn"` in `face_recognition.face_locations()` for CNN-based detection (requires CUDA). The default `model="hog"` runs entirely on CPU and is suitable for college-scale deployments.

---

## 15. Running the Service

```bash
cd ai-service

# Copy environment template and fill in secrets
cp .env.example .env
# Edit .env with strong random values for INTERNAL_API_KEY and BIOMETRIC_SECRET_KEY

# Activate venv
source .venv/bin/activate

# Start in development
FLASK_ENV=development python app.py

# Start in production with Gunicorn
gunicorn -w 2 -b 0.0.0.0:5002 --timeout 60 'app:create_app()'
```

---

## 16. Running Tests

```bash
cd ai-service
source .venv/bin/activate

# Run all tests
pytest tests/ -v

# Run only the Part 4 face recognition test suite
pytest tests/test_face_recognition_engine.py -v

# Run with coverage
pip install pytest-cov
pytest tests/ --cov=app --cov-report=term-missing
```

---

## 17. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: No module named 'app'` | Running pytest from wrong directory | `cd ai-service` before running pytest |
| `dlib not found` | dlib not installed or cmake missing | `brew install cmake` then re-run `pip install dlib` |
| `face_recognition` hangs on first call | Model weights loading | Normal — wait 1–2 minutes; subsequent calls are fast |
| `BIOMETRIC_SECRET_KEY` warning | Empty env var | Set it in `.env` or as an OS env var |
| `401 Unauthorized` on all routes | Missing or wrong `X-Internal-Key` header | Ensure Node.js sends `X-Internal-Key` matching `INTERNAL_API_KEY` |
| `400 POOR_IMAGE_QUALITY` on real camera | Poor lighting or motion blur | Improve ambient lighting; reduce camera exposure time |
| `NO_FACE_DETECTED` on real camera | Face too far from camera | Move face within 0.5–1 m; use minimum 640×480 resolution |
| Slow verification (> 5 s) | Large image resolution | Resize to 640×480 on frontend before sending |

---

## 18. Security Controls Summary

| Control | Implementation |
|---------|---------------|
| Service isolation | Python service binds only to localhost in production; Node.js is the only caller |
| API key auth | `X-Internal-Key` header required on every endpoint (`@require_internal_key`) |
| Biometric encryption | AES-256-GCM, random 12-byte nonce per encryption |
| Key management | Keys from environment variables, never in codebase |
| Consent gate | `ConsentRequiredError` raised if `hasConsent=False` at Python layer |
| Session challenge | HMAC-SHA256 token binding verification to 90-second window |
| No image persistence | All image decoding in-memory via NumPy/OpenCV buffer |
| No embedding exposure | Embeddings never returned in API responses or logged |
| Error sanitisation | Stack traces never returned to clients; only safe status codes |
| Tamper detection | AES-GCM auth tag rejects tampered ciphertext (`BiometricDecryptionError`) |
| Threshold control | `MATCH_THRESHOLD` from env only; frontend cannot override |
| Audit trail | Node.js logs all decisions to `AttendanceAuditLog` (Python is stateless) |

---

## 19. Known Limitations & Remaining Work

| Item | Status | Notes |
|------|--------|-------|
| Real-photo end-to-end test | ⚠️ Pending | Synthetic images do not reliably trigger dlib HOG; real face photos needed for full acceptance test |
| Demographic parity evaluation | ⚠️ Not done | Requires appropriately consented representative dataset |
| Active liveness detection | ❌ Not implemented | HMAC challenge only; no depth/IR sensor support |
| Multi-sample outlier rejection | ⚠️ Partial | Mean centroid used; no pairwise outlier filter yet |
| Key rotation procedure | ⚠️ Documented but not automated | Re-encryption of all templates required on key rotation |
| GPU acceleration | ⚠️ Optional | Switch to `model="cnn"` in `detect_faces()` for CUDA; not tested |
| Rate limiting on Python service | ⚠️ Not implemented | Rate limiting is applied on Node.js layer via `express-rate-limit` |
| Gunicorn worker count tuning | ⚠️ Pending | 2 workers recommended for CPU-bound face ops; tune per server CPU count |


# Smart Attendance Biometric Security, Cryptographic & Threat Model Review
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 6.0.0  
**Phase:** Part 9 of 24 — Biometric Enrollment, Consent Management & Student Face Registration Reliability  
**Date:** November 1, 2026  
**Auditor / Security Architect:** Senior Biometric Security Engineer & Application Cryptographer  

---

## 1. Cryptographic Architecture & Implementation

Previous project documentation contained conflicting mentions of Fernet and AES-256-GCM. 

The actual code implementation in `ai-service/app/security/encryption.py` is **AES-256-GCM** (Galois/Counter Mode Authenticated Encryption with Associated Data), implemented via `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.

### 1.1 Specification of Cryptographic Operations
- **Cipher:** AES-256 in GCM mode (256-bit key length).
- **Key Derivation:** 32-byte key derived from `BIOMETRIC_SECRET_KEY` via `hashlib.sha256(secret_string.encode("utf-8")).digest()`.
- **Initialization Nonce:** 12 cryptographically secure random bytes generated per encryption via `os.urandom(12)`. Nonces are never reused.
- **Authentication Tag:** 16-byte GMAC tag appended to ciphertext by AESGCM, verifying ciphertext integrity and authenticity.
- **Serialization:** Combined binary structure `nonce (12b) + ciphertext + tag (16b)` encoded as a single URL-safe Base64 string for database storage.

### 1.2 Tamper Detection & Error Handling

```
[Decryption Request]
         │
         ▼
[Base64 Decode] ─── Invalid Base64 ───► Raise BiometricDecryptionError
         │
         ▼
[Payload Length >= 28 bytes] ─── Truncated (<28b) ───► Raise BiometricDecryptionError
         │
         ▼
[AESGCM Decrypt(nonce, ct)] ─── InvalidTag / Wrong Key ───► Raise BiometricDecryptionError
         │
         ▼
[JSON Deserialization] ─── Corrupt Payload ───► Raise BiometricDecryptionError
         │
         ▼
[Valid Template Dict { studentId, vector, model, dimensions }]
```

When an adversary tampers with any byte of ciphertext or when an invalid secret key is supplied, `AESGCM` immediately detects the authentication tag mismatch and raises `InvalidTag`. The service captures this cleanly and returns a generic controlled failure (`DECRYPTION_FAILED`), preventing cryptographic timing or padding oracle leaks.

---

## 2. Attack Surface & Threat Model

| Threat / Attack Vector | Severity | Attack Surface | Mitigation Implemented |
|---|---|---|---|
| **Biometric Replay / Template Injection** | High | `POST /api/student/face/enroll` | Python microservice enforces single-face detection, blur threshold (variance of Laplacian $> 65.0$), and min face size ($100\times100\text{px}$). Numerical embeddings are computed internally by dlib ResNet and never accepted from client payloads. |
| **Identity Impersonation at Enrollment** | High | Student WebRTC Camera Stream | System extracts `studentId` strictly from authenticated JWT (`req.user._id`). A student cannot enroll a biometric template for another user account. |
| **Cross-Account Template Overwrite** | High | Re-registration endpoint | Enforces atomic uniqueness index `student_1`. Re-enrollment without explicit authorization or `re_enrollment_required` status is rejected with `409 Conflict`. |
| **Ciphertext Tampering / Bit-Flipping** | High | MongoDB `faceembeddings` collection | AES-256-GCM 16-byte authentication tag validates cryptographic integrity. Any modified byte fails decryption immediately. |
| **Credential & Database Leaks** | Critical | Database backup / read dump | Sensitive fields `encryptedData` and `templateReference` have `{ select: false }` in Mongoose schema. Standard queries do not expose biometric ciphertext. |
| **Direct Microservice Bypass** | Critical | Python Flask Service (Port 5002) | Microservice listens on loopback (`127.0.0.1`), enforces `@require_internal_key` verifying `X-Internal-Key` shared secret header. |
| **Token Hijacking & QR Sharing** | High | Attendance Verification | QR codes rotate dynamically on a 15-second window. QR tokens are cryptographically signed HMAC-SHA256 nonces bound to specific session IDs. |

---

## 3. Role-Based Access Control (RBAC) Isolation

1. **Student Role:**
   - Permitted: View own enrollment status, grant consent, enroll facial biometric, withdraw consent, join active sessions.
   - Prohibited: View or query other students' biometric data, access administrative purge endpoints, manipulate session states.
2. **Faculty Role:**
   - Permitted: Create and control attendance sessions, view attendance roll-call, execute manual corrections with mandatory reasons.
   - Prohibited: **Zero access to biometric templates or encryption keys.** Faculty cannot query, download, or inspect student face embeddings.
3. **Admin Role:**
   - Permitted: View enrollment statistics, audit logs, trigger individual or bulk cryptographic purges upon student exit or withdrawal.
   - Prohibited: Plaintext template access. Admin can purge or deactivate templates, but cannot decrypt raw embeddings or view photographs.

---

## 4. Fundamental Identity-Proofing Limitations

> [!IMPORTANT]
> **Essential Security Clarification: Account Binding vs. Legal Identity Proofing**
>
> The CampusSphere AI biometric enrollment process binds a facial biometric embedding to the **authenticated student account session** (`req.user._id`). 
>
> **It does NOT constitute legal, national, or government-grade identity verification.**
>
> If an adversary obtains a student's initial ERP login credentials (username and password) before the legitimate student completes initial registration, the adversary could enroll their own face against the victim's student account. The system has no independent external source of truth (such as a government identity database, national biometric registry, or live in-person proctor) to cross-verify that the physical human in front of the camera matches the name on the account.

### Institutional Recommendations to Mitigate Initial Enrollment Risk:
1. **Supervised Registration Sessions:** Initial biometric enrollment should be conducted in an authorized campus computer lab supervised by departmental faculty or IT proctors who visually inspect physical college ID cards before student registration.
2. **One-Time Registration Codes:** Issuing a single-use time-bound registration token sent to verified institutional SMS/email addresses or delivered in person.
3. **Administrative Lock:** Once registered, templates cannot be overwritten without faculty advisor or administrative counter-signature.

---

## 5. Institutional Decisions Required

1. **Anti-Spoofing & Liveness Enhancements:** Evaluation of active liveness challenges (e.g., blink detection, head-turn sequences) versus passive liveness for resource-constrained client hardware.
2. **Re-Enrollment Protocol:** Institutional guidelines defining acceptable grounds for biometric re-enrollment (e.g., significant facial surgery, severe injury, or reported credential compromise).
3. **Audit Trail Retention:** Retention period for `AttendanceAuditLog` entries (recommendation: duration of student enrollment plus 1 academic year).

---

## 6. Biometric Threshold Calibration & Performance Limitations

The Euclidean matching threshold ($0.55$) and review boundary ($0.65$) represent nominal engineering thresholds based on standard dlib ResNet-1 benchmark literature. 

They do **not** constitute an empirically calibrated production threshold derived from an authorized, consented campus cohort. 

Prior to campus-wide deployment, the institution must conduct an empirical ROC evaluation across varied demographics, camera hardware, and lecture-hall lighting conditions to measure real-world False Accept Rate (FAR) and False Reject Rate (FRR). The threshold must not be considered permanently production-calibrated until this empirical validation is completed.

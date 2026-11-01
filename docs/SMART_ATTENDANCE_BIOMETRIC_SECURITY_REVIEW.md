# Smart Attendance Biometric Security & Cryptographic Review
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 5.0.0  
**Phase:** Part 5 of 24 — Biometric Security & Cryptography  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Security Engineer & Cryptographer  

---

## 1. Cryptographic Primitive Clarification

Previous project documentation contained conflicting mentions of Fernet and AES-256-GCM. 

The actual code implementation in `ai-service/app/security/encryption.py` is **AES-256-GCM** (Galois/Counter Mode Authenticated Encryption with Associated Data), implemented via `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.

### Specification of Cryptographic Operations:
- **Cipher:** AES-256 in GCM mode ($256$-bit key length).
- **Key Derivation:** 32-byte key generated from `BIOMETRIC_SECRET_KEY` via `hashlib.sha256(secret_string.encode("utf-8")).digest()`.
- **Initialization Nonce:** 12 cryptographically secure random bytes generated per encryption via `os.urandom(12)`. Nonces are never reused.
- **Authentication Tag:** 16-byte GMAC tag appended to ciphertext by AESGCM, verifying integrity and authenticity.
- **Serialization:** Combined binary structure `nonce (12b) + ciphertext + tag (16b)` encoded as a single URL-safe Base64 string for database storage.

---

## 2. Cryptographic Tamper & Error Handling

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

When an adversary tampers with any byte of ciphertext or when an invalid secret key is supplied, `AESGCM` immediately detects the authentication tag mismatch and raises `InvalidTag`. The service captures this cleanly and returns a generic controlled failure (`DECRYPTION_FAILED`), preventing cryptographic timing or oracle leaks.

---

## 3. Data Protection & Privacy Guarantees

| Protection Domain | Implementation | Security Guarantee |
|---|---|---|
| **Raw Face Images** | Decoded entirely in volatile memory (`cv2.imdecode`); discarded immediately after embedding generation. | **Zero disk persistence.** No facial image files exist anywhere in the filesystem. |
| **Biometric Vectors in DB** | Encrypted as AES-256-GCM blobs in MongoDB `faceembeddings` collection. Mongoose schema specifies `{ select: false }` on `encryptedData` and `templateReference`. | In the event of standard query execution or database dump without projection, raw templates are excluded by default. |
| **API Boundary Isolation** | Python routes return only `{ success, isMatch, confidence, status, qualityMetrics }`. Vector arrays are stripped. | Clients and browsers never receive numerical embeddings or template references. |
| **Service Authentication** | All endpoints protected by `@require_internal_key`, verifying `X-Internal-Key: <SECRET>`. Bound to `127.0.0.1`. | External clients cannot bypass the Node.js API to call Python directly. |
| **Consent & Deletion** | Active consent required for enrollment and verification. Deletion endpoint purges template permanently. | Complete compliance with Digital Personal Data Protection (DPDP) and GDPR right-to-erasure. |

---

## 4. Consent Withdrawal & Non-Biometric Alternative

Students retain the legal and institutional right to withdraw biometric consent at any time. When consent is revoked:
1. `FaceEmbedding` status is marked `inactive` or deleted.
2. `ConsentRecord` appends an audit event with `action: "revoked"`.
3. Subsequent biometric verification requests are rejected with `CONSENT_REQUIRED` ($403$).
4. The student continues attending classes via verified manual attendance or faculty roll-call.


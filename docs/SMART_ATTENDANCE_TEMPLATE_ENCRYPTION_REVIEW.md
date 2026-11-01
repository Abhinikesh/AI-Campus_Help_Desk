# Smart Attendance Biometric Template Encryption & Cryptographic Review
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 1.0.0  
**Phase:** Part 9 of 24 — Biometric Enrollment, Consent Management & Student Face Registration Reliability  
**Date:** November 1, 2026  
**Auditor:** Senior Biometric Security Engineer & Cryptographer  

---

## 1. Cryptographic Primitive Specification

Biometric templates in CampusSphere AI represent sensitive mathematical identifiers derived from student facial geometry. In compliance with modern cryptographic best practices, templates are encrypted using **AES-256-GCM** (Galois/Counter Mode).

### 1.1 Cryptographic Parameters

| Parameter | Value / Implementation | Cryptographic Justification |
|---|---|---|
| **Cipher Algorithm** | AES (Advanced Encryption Standard) | FIPS 197 compliant symmetric block cipher. |
| **Operating Mode** | GCM (Galois/Counter Mode) | Authenticated Encryption with Associated Data (AEAD) providing both confidentiality and integrity. |
| **Key Size** | 256 bits (32 bytes) | Maximum security strength against brute-force cryptanalysis. |
| **Key Derivation** | SHA-256 (`hashlib.sha256(secret.encode()).digest()`) | Derives uniform 32-byte pseudo-random key from configured `BIOMETRIC_SECRET_KEY`. |
| **Initialization Nonce** | 12 bytes (`os.urandom(12)`) | Cryptographically secure pseudo-random number generator (CSPRNG). Never repeated. |
| **Authentication Tag** | 16 bytes (128 bits GMAC tag) | Validates ciphertext authenticity and prevents bit-flipping attacks. |
| **Serialization** | URL-safe Base64 (`nonce + ciphertext + tag`) | Safe for ASCII JSON transmission and MongoDB BSON string storage. |

---

## 2. Binary Structure & Wire Format

The encrypted biometric payload stored in MongoDB (`FaceEmbedding.encryptedData`) is formatted as a single composite Base64 string:

```
┌─────────────────┬───────────────────────────────────┬────────────────────────┐
│  Nonce (12 B)   │        Ciphertext (Variable)       │ Authentication Tag (16 B)│
└─────────────────┴───────────────────────────────────┴────────────────────────┘
 ◄── 12 bytes ───► ◄── JSON payload encrypted with AES ─► ◄────── 16 bytes ───────►
```

### 2.1 Plaintext JSON Structure (Pre-Encryption)
Before encryption, the Python service packs the embedding vector into a structured JSON dictionary:
```json
{
  "studentId": "60d0fe4f5311236168a109ca",
  "vector": [-0.0812, 0.1423, 0.0518, ..., 0.0931],
  "model": "dlib-resnet-v1",
  "dimensions": 128,
  "enrolledAt": "2026-11-01T12:00:00.000Z",
  "keyVersion": 1
}
```

### 2.2 Ciphertext Construction
1. Nonce $N \leftarrow \text{CSPRNG}(12)$.
2. Plaintext $P \leftarrow \text{UTF8\_Encode}(\text{JSON}(payload))$.
3. $C, T \leftarrow \text{AES-256-GCM-Encrypt}(K, N, P)$.
4. Combined payload: $B \leftarrow N \,\|\, C \,\|\, T$.
5. Output string: $S \leftarrow \text{Base64\_Encode}(B)$.

Minimum valid payload size: $12 + 1 + 16 = 29\text{ bytes}$ (encoded Base64 length $\ge 40$ characters). Payloads smaller than 28 raw bytes are rejected immediately before decryption attempts.

---

## 3. Key Versioning & Key Rotation Strategy

### 3.1 Current Key Version Architecture
The system currently operates on **Key Version 1** (`keyVersion: 1`).
- The key version is tracked in `FaceEmbedding.keyVersion` in MongoDB and embedded inside the decrypted template dictionary.
- Decryption operations inspect `keyVersion` to ensure cryptographic compatibility.

### 3.2 Dual-Key Rotation Protocol (Zero-Downtime Transition)
When the institution rotates the biometric master key:
1. **Configuration:** Admin provisions `BIOMETRIC_SECRET_KEY_V2` while retaining `BIOMETRIC_SECRET_KEY_V1` as a legacy decryption key.
2. **Read Path:** If `keyVersion === 1`, decrypt with Key 1; if `keyVersion === 2`, decrypt with Key 2.
3. **Write Path:** All new enrollments and re-enrollments encrypt immediately using Key 2 with `keyVersion: 2`.
4. **Lazy / Batch Re-encryption:** A background migration task decrypts existing Key 1 templates using Key 1, re-encrypts with Key 2 and a fresh nonce, and updates `FaceEmbedding.keyVersion = 2`.
5. **Deprecation:** Once all templates report `keyVersion: 2`, Key 1 is securely erased from environment variables.

---

## 4. Database-Level Protections

### 4.1 Mongoose Schema `select: false`
To prevent accidental leakage through REST endpoints, logging interceptors, or administrative dashboard queries, the fields holding biometric ciphertext are excluded by default in `server/models/FaceEmbedding.js`:

```javascript
encryptedData: {
  type: String,
  select: false
},
templateReference: {
  type: String,
  select: false
}
```

Any query requiring verification must explicitly project these fields:
```javascript
const template = await FaceEmbedding.findOne({ student: studentId }).select('+encryptedData');
```

---

## 5. Security Guarantees & Non-Reversibility

1. **Confidentiality:** It is computationally infeasible to recover the facial embedding vector without the 256-bit symmetric key ($2^{256}$ search space).
2. **Integrity & Authenticity:** Any modification to the ciphertext (bit-flipping, truncation, or splicing) causes the 16-byte GMAC tag verification to fail during GCM decryption, raising `InvalidTag`.
3. **Replay & Collision Resistance:** Because a unique 12-byte random nonce is generated for every single encryption call, encrypting the exact same face embedding twice yields entirely different ciphertexts.
4. **Irreversibility of Embeddings:** Even if an attacker possessed the decrypted 128-dimensional floating-point vector, it is mathematically impossible to reconstruct the student's original high-resolution photographic portrait from a 128-d latent manifold.


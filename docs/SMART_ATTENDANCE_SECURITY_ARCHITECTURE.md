# Smart Attendance Security & Biometric Privacy Architecture
## Project: CampusSphere AI — Smart Campus Management Platform

**Document Version:** 3.0.0  
**Phase:** Part 3 of 24 — Complete System Architecture & Technical Design  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Software Architect, Security Engineer & Privacy Auditor  

---

## 1. Threat Modeling & Trust Boundaries

The system is compartmentalized into four strict security rings to minimize the attack surface and eliminate unauthorized access to biometric data:

```
┌──────────────────────────────────────────────────────────────┐
│  RING 0: Untrusted Public / Campus Network (Browser Client)  │
│  - Threat: Client tampering, replay attacks, spoofed tokens  │
│  - Control: Zero trust; all decisions made server-side       │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS (TLS 1.3)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  RING 1: Demilitarized ERP Gateway (Node.js Express :5001)   │
│  - Threat: Broken auth, parameter tampering, brute force     │
│  - Control: JWT HS256, RBAC, Helmet, RateLimiter, Mongo San  │
└──────────────────────────────┬───────────────────────────────┘
                               │ Mutual Header Auth (X-Internal-Key)
                               │ Localhost Loopback / VPC Private
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  RING 2: Isolated Biometric Enclave (Python Flask :5002)     │
│  - Threat: Unauthorized template extraction, memory leaks    │
│  - Control: AES-256-GCM / Fernet, ephemeral RAM buffers      │
└──────────────────────────────┬───────────────────────────────┘
                               │ Mongoose TCP Authentication
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  RING 3: Encrypted Persistent Store (MongoDB :27018)         │
│  - Threat: Database dump, credential theft, unauthorized read│
│  - Control: Schema {select: false}, unique indexes, TTL logs │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Authorization (RBAC)

### 2.1 User Authentication
- **Mechanism:** JSON Web Token (JWT) signed with HMAC-SHA256 (`JWT_SECRET`, minimum 32 characters validated at boot in `server/config/env.js`).
- **Transport:** Delivered in secure HTTP-only cookies (`campus_token`) and mirrored in client localStorage for authorization header fallback (`Authorization: Bearer <token>`).
- **Token Claims:**
  ```json
  {
    "userId": "672401a0e10b42f4c9a84001",
    "role": "student",
    "name": "Arjun Sharma",
    "iat": 1730419200,
    "exp": 1731024000
  }
  ```
- **Password Security:** Salted and hashed using `bcryptjs` with a work factor of 10 salt rounds. Passwords are never stored in plaintext and never logged.

### 2.2 Server-Side Role Enforcement
- Every route requires `authMiddleware` to verify token validity, followed by `allowRoles('student')`, `allowRoles('faculty')`, or `allowRoles('admin')`.
- Endpoints operating on individual resources unconditionally scope database queries to the verified identity (e.g., student attendance history forces `{ student: studentDoc._id }`, preventing horizontal privilege escalation).

---

## 3. Internal Inter-Service Security (Node.js $\leftrightarrow$ Python)

1. **Network Isolation:** The Python AI microservice is bound strictly to `127.0.0.1:5002` (loopback interface) or a private Docker bridge. Public access to port 5002 is blocked via firewall/ingress rules.
2. **Pre-Shared Secret Header (`X-Internal-Key`):**
   - Node.js transmits: `X-Internal-Key: <INTERNAL_API_KEY>`.
   - Python validates the key via the `@require_internal_key` decorator in `app/security/auth.py`. Requests lacking the key or carrying an invalid key are rejected immediately with `401 Unauthorized`.
3. **Payload Sanitization & Size Limits:**
   - Express limits request payloads to 10 MB (`express.json({ limit: '10mb' })`).
   - Python validates Base64 strings, decodes image bytes using OpenCV/Pillow, and asserts that dimensions do not exceed $1920 \times 1080$.

---

## 4. Cryptographic Protection of Biometric Data

### 4.1 Ephemeral Memory Model (Zero Disk Retention)
- Inbound webcam frames are received as Base64 strings into volatile memory (RAM).
- Python decodes the frame into a numpy BGR array, performs facial detection, extracts the 128-dimensional floating point embedding vector, and **immediately discards the image buffer**.
- Raw face photographs are **never** written to the local filesystem, temporary directories, or external cloud storage buckets.

### 4.2 Vector Encryption at Rest
- The 128-d floating point embedding vector is converted to a binary byte buffer and encrypted using **AES-256-GCM (Fernet)**:
  $$\mathbf{c} = \text{Encrypt}_{\text{AES-256-GCM}}(K_{\text{biometric}}, \text{serialize}(\mathbf{v}))$$
  where $K_{\text{biometric}}$ is a 256-bit cryptographically secure key stored exclusively in `ai-service/.env`.
- The resulting ciphertext $\mathbf{c}$ is stored in the `encryptedData` field of `FaceEmbedding`.
- In the Mongoose schema, `encryptedData` is configured with `{ select: false }`. It is never returned in client REST queries or administrative roster lists.

---

## 5. Replay, Duplicate & Race-Condition Protections

1. **Atomic Compound Unique Constraint:**
   MongoDB enforces uniqueness on `{ subject: 1, student: 1, date: 1, period: 1 }`. Any duplicate submission is blocked atomically at the database engine level, returning error code `11000`.
2. **Rotating QR Challenge Tokens:**
   For sessions utilizing QR codes, tokens are generated using HMAC-SHA256 with a 30-second sliding time window. Replaying a token older than 30 seconds results in immediate rejection.
3. **Session State Bounding:**
   Attendance verification requests are valid only while the session state in MongoDB is strictly `open` or `active`. Requests submitted to `finalized`, `closed`, or `expired` sessions are rejected.

---

## 6. Audit Logging & Compliance Standards

- **Immutable Audit Trail:** `AttendanceAuditLog` captures all privileged events (session creation, status overrides, manual corrections, biometric enrollments, consent revocations) with operator ID, target student, previous state, new state, justification note, and IP address.
- **GDPR / DPDP Compliance:**
  - **Right to Informed Consent:** Active consent must be recorded before biometric enrollment (`ConsentRecord`).
  - **Right to Erasure (Revocation):** Students can revoke consent at any time via `/student/attendance/face-registration`, immediately deleting the biometric profile and template.
  - **Non-Biometric Parity:** Faculty manual override and rotating QR attendance guarantee that students exercising their right to withhold biometric consent suffer no academic disadvantage.


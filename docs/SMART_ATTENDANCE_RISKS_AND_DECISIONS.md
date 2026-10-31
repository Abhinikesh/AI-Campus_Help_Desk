# Smart Attendance Architectural Risks, Constraints & Decisions

**System Name:** CampusSphere AI Smart Attendance Module  
**Document Version:** 1.0.0  
**Date:** November 1, 2026  
**Auditor:** Senior Software Architect & Technical Auditor  

---

## 1. Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **Webcam Frame Quality Variation (Poor lighting / low-res webcams)** | False rejections during student verification. | Medium | The Python AI service runs photometric quality checks (Laplacian variance $>60$, brightness mean between $40$ and $230$, contrast $>0.20$). If lighting is deficient, clear, actionable feedback ("Lighting too dim. Please face a light source.") is returned before performing recognition. |
| **Network Latency with Uncompressed Frames** | High bandwidth usage on campus Wi-Fi networks when students upload raw frames simultaneously. | Medium | Enforce client-side frame scaling to a maximum resolution of $640 \times 480$ JPEG at 85% compression quality in `CameraPreview.jsx`. This reduces frame size from ~2MB to ~45KB with negligible loss in dlib feature landmark extraction. |
| **Python Service Process Unavailability** | Biometric verification fails if the Python Flask daemon crashes or restarts. | Low | Node.js `pythonAi.service.js` employs `AbortSignal.timeout(8000)` and try/catch blocks. If Python is unreachable, the system falls back to manual attendance override and logs an administrative health alert, preventing student lockout. |
| **Database Connection Collision in Tests** | In-memory MongoDB testing suite connects to `campus-erp` while local server defaults to `test`. | Low | Align MongoDB URI configuration across all test fixtures and environment profiles to ensure database name consistency. |
| **Duplicate Attendance Submission Race Condition** | Student double-clicks or multiple tabs submit verification simultaneously. | Low | Database-level protection via compound unique index `{ subject: 1, student: 1, date: 1, period: 1 }` guarantees atomic deduplication at the MongoDB engine level. |

---

## 2. Existing Architectural Constraints

1. **Monorepo Co-existence:**
   - The ERP already possesses an active React 19 frontend and Node.js 20+ Express backend. The Smart Attendance module must live within this repository structure without creating competing web servers, parallel routing schemes, or orphaned pages.
2. **Strict Non-Covert Biometrics:**
   - Institutional and regulatory ethics mandate **student-initiated, voluntary 1:1 face verification**. No continuous classroom video stream ingestion, RTSP camera processing, or ambient surveillance is permitted.
3. **CPU-Bound Inference Constraint:**
   - The production hosting environment may not have dedicated Nvidia GPUs. The computer-vision pipeline must therefore be lean, operating on lightweight dlib ResNet (128-d) and OpenCV CPU routines, executing in under $150\text{ms}$ per frame on standard CPU cores.
4. **Mandatory Non-Biometric Fallback:**
   - By institutional policy, students who withhold biometric consent or experience physical/hardware barriers must have a seamless, stigma-free alternative (faculty manual override or rotating QR attendance).

---

## 3. Technology & Dependency Compatibility

### 3.1 Python Compatibility
- **Audited Python Version:** Python `3.12.13` inside `.venv`.
- **dlib & face_recognition:** Successfully compiled and operational with `numpy 1.26.4` and `setuptools<70`.
- **Operating System:** macOS (Darwin arm64 / Apple Silicon) and Linux compatibility verified.
- **Rule:** Global system Python must **never** be modified. The dedicated virtual environment (`ai-service/.venv`) isolates all computer vision dependencies.

### 3.2 React 19 & React Router v7 Compatibility
- Frontend dependencies are modern: React `19.2.4`, React Router DOM `7.14.0`, Vite `8.0.4`.
- All dashboard pages use `React.lazy` code splitting wrapped in `<Suspense>` and `<ErrorBoundary>`.

---

## 4. Security & Privacy Considerations

1. **Biometric Data Lifecycle:**
   - **Capture:** In-browser canvas frame captured strictly upon student trigger.
   - **Transit:** HTTPS POST with encrypted payload.
   - **Processing:** Converted to in-memory BGR numpy array in Python. 128-d embedding extracted.
   - **Ephemeral Discard:** Raw frame is immediately garbage-collected from RAM; never written to disk or storage buckets.
   - **At Rest:** Template vector is encrypted via AES-256-GCM / Fernet. Decryption key resides exclusively in `ai-service/.env`.
2. **Right to Erasure (Revocation):**
   - Students can revoke consent at any time via `/student/attendance/face-registration`.
   - Revocation purges the `FaceEmbedding` record from MongoDB and marks `ConsentRecord` as `revoked`.
3. **Auditability:**
   - Every attendance status modification (whether automatic 1:1 face match or manual faculty override) creates an append-only entry in `AttendanceAuditLog` detailing the operator ID, target student, previous status, new status, and timestamp.

---

## 5. Architectural Decisions Record (ADR)

### Decision 1: Hybrid Node.js Gateway + Python Biometric Microservice
- **Context:** The ERP core is built in Node.js/Express, while computer vision is most reliably implemented in Python.
- **Decision:** Keep Node.js as the single source of truth for auth, sessions, rosters, and database persistence. Run Python as a focused internal microservice on port 5002 for computer vision and mathematical analytics.
- **Reason:** Avoids rewriting existing ERP routes while providing native Python capabilities (OpenCV, dlib).

### Decision 2: 1-to-1 Verification Over 1-to-Many Identification
- **Context:** Deciding between classroom mass face identification (1:N) vs. student-authenticated 1:1 verification.
- **Decision:** Implement **one-to-one (1:1) verification only**.
- **Reason:** 1:1 verification prevents false identity matches, respects student privacy, complies with data protection regulations, and scales at $O(1)$ complexity rather than $O(N)$ database searching.

### Decision 3: Encrypted Template Storage Instead of Raw Images
- **Context:** Should student profile photos be stored for face comparison?
- **Decision:** **Never store raw facial images**. Store only encrypted 128-dimensional mathematical feature vectors.
- **Reason:** Eliminates the risk of biometric image leakage in the event of a database compromise.

### Decision 4: Unified Design System & Collapsible Sidebar
- **Context:** Previous dashboards had conflicting black and white themes with top navigation clutter.
- **Decision:** Standardize on a clean enterprise light palette (`#FFFFFF` cards, `#F8FAFC` backgrounds, `#2563EB` blue accents) with a 64px minimized icon sidebar that smoothly expands to 240px.
- **Reason:** Provides a cohesive, native institutional user experience across Student, Faculty, and Admin portals.


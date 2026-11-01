# Smart Attendance — Camera & Frontend Integration Audit
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Frontend WebRTC Camera, Biometric Preprocessing & Faculty Experience  
**Version:** 1.0.0 (Part 7/24 Optimization)  
**Author:** Senior React Engineer & Browser WebRTC Specialist  

---

## 1. Executive Summary

This audit evaluates the browser-side camera lifecycle, face capture interactions, media stream governance, and live attendance orchestration within **CampusSphere AI**.

Prior to this phase:
- The camera component captured raw, unconstrained video frames (up to 1920×1080 at 0.88 JPEG quality), resulting in 2 MB – 4 MB payloads that strained mobile networks.
- No client-side aspect ratio preservation or dimension normalization existed, risking facial distortion on mobile portrait displays.
- Rotating QR challenge tokens on the faculty screen lacked an automated countdown and auto-rotation loop, causing projected tokens to expire while students were in the room.
- Student submission lacked synchronous click mutexes, allowing duplicate requests during network delays.

Part 7 has eliminated these deficiencies through standard WebRTC lifecycle management, aspect-ratio preserving canvas downscaling (max 640×480, quality 0.80), real-time illumination estimation, automated QR challenge rotation, and synchronized state-machine controls on both student and faculty dashboards.

---

## 2. Component Architecture & Flow

```
+-------------------------------------------------------------------------+
|                              STUDENT WORKFLOW                           |
|                                                                         |
|  [Select Active Session]                                                |
|            │                                                            |
|            ▼                                                            |
|  [Mount CameraPreview] ──► navigator.mediaDevices.getUserMedia          |
|            │               - facingMode: 'user'                         |
|            │               - ideal: 640x480                             |
|            │               - tracks cleanup on unmount/visibilitychange |
|            ▼                                                            |
|  [Real-Time Guidance Overlay]                                           |
|     - Face Oval Target                                                  |
|     - ITU-R BT.601 Illumination Monitor (offscreen sample canvas)       |
|            │                                                            |
|            ▼                                                            |
|  [Student Clicks 'Scan & Verify']                                       |
|     1. isSubmittingRef Mutex (blocks duplicate clicks)                  |
|     2. calculateNormalizedDimensions(srcW, srcH, 640, 480)               |
|     3. drawImage to HTML Canvas + horizontal mirror transform           |
|     4. canvas.toDataURL('image/jpeg', 0.80) -> size ~40-80 KB           |
|     5. validateImagePayload() -> verify format & size bounds            |
|            │                                                            |
|            ▼                                                            |
|  [POST /api/student/attendance/join/:sessionId]                         |
|     - liveImageData: "data:image/jpeg;base64,..."                       |
|     - qrChallengeToken: "timestamp.nonce.signature"                     |
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                              FACULTY WORKFLOW                           |
|                                                                         |
|  [LiveAttendance Dashboard]                                             |
|     - Responsive Polling: every 2.5s while active/paused                |
|     - Dynamic QR Challenge: 45s countdown & automatic refresh           |
|     - State Actions: Pause, Resume, Stop, Finalize                      |
|     - Strict Absentee Rule: Absentees marked ONLY upon Finalization     |
+-------------------------------------------------------------------------+
```

---

## 3. Investigated Defects & Resolutions

### 1. QR Challenge Replay & Single-Use Semantics
- **Finding:** In classroom lectures, 40–80 students in the hall scan the *same* projected challenge token displayed on the screen. Making the challenge token globally single-use would cause the second student to fail.
- **Resolution:** The token is bound cryptographically to the `sessionId` and has a strict 45-second sliding window. Single-use per student is guaranteed by MongoDB's unique compound index `{ student: 1, session: 1 }`.

### 2. Automatic Challenge Refresh
- **Finding:** The faculty screen previously fetched the challenge once on mount and never refreshed it, resulting in students attempting to scan expired codes after 45 seconds.
- **Resolution:** Added `useEffect` countdown timer that automatically invokes `fetchQrChallenge()` every 45 seconds, paired with a visual countdown bar and "Regenerate" button.

### 3. Submission Concurrency & Duplicate Clicks
- **Finding:** Multiple quick clicks on mobile touchscreens caused parallel verification requests, triggering backend 409 conflicts.
- **Resolution:** Introduced `isSubmittingRef` synchronous boolean guard in `MarkAttendance.jsx`, disabling the button and showing an animated progress bar during processing.


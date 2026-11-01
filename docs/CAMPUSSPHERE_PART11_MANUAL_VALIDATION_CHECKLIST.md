# CampusSphere AI — Part 11 Manual Validation Checklist

This checklist contains validation items requiring human physical interaction, real hardware sensors, camera optical capture, or mobile browser execution that cannot truthfully be 100% automated within a headless CI/CD sandbox.

---

## 1. Physical Camera & Real-Time UX Validation

- [ ] **Hardware Webcam Stream Acquisition:**
  - Open Chrome/Safari/Firefox to `http://localhost:5173/attendance/mark`.
  - Confirm browser displays the camera permission prompt ("Use your camera").
  - Confirm camera video stream starts smoothly at native resolution without flickering or freezing.
- [ ] **Real-Time Lighting & Exposure Indicator:**
  - Point camera at a dim area (low light) -> Verify warning badge: *"Lighting is too dim. Please move to a brighter area."*
  - Point camera at direct light/glare -> Verify warning badge: *"Lighting is too harsh. Please reduce backlighting."*
  - Normal room lighting -> Verify indicator: *"Good lighting"*.
- [ ] **Face Centering & Oval Overlay:**
  - Verify alignment guide oval renders centered on the video stream.
  - Test portrait mobile orientation vs landscape desktop orientation -> Verify aspect ratio is preserved without stretching.
- [ ] **Live Anti-Spoofing & Motion Prompt:**
  - Verify UI guides the student to keep their head facing forward within acceptable roll/pitch bounds.

---

## 2. Dynamic QR Scanner & Cross-Device Scan Validation

- [ ] **Faculty Session QR Projection:**
  - Login as Faculty (`FAC001` / `Faculty@123`).
  - Navigate to `http://localhost:5173/faculty/attendance/live`.
  - Start an attendance session for an assigned course.
  - Observe QR code rotating every 15 seconds on the faculty screen.
- [ ] **Student Mobile / Separate Device Scan:**
  - On a second phone/browser window, login as Student (`20240001` / `Student@123`).
  - Open QR scanner or join active session prompt.
  - Scan projected QR code from faculty screen.
  - Verify session token is accepted if scanned within 15 seconds.
  - Photograph or screenshot the QR and wait 20 seconds -> Verify delayed scan is rejected as *"Expired challenge token"*.

---

## 3. Real Biometric Verification & 1:1 Face Match

- [ ] **Student Biometric Registration:**
  - Navigate to `http://localhost:5173/attendance/face-registration`.
  - Review Biometric Consent Policy modal and click *"I Accept"*.
  - Capture 3 real facial sample frames when prompted.
  - Verify successful enrollment banner and status update to *"Enrolled"*.
- [ ] **Live Verification in Active Session:**
  - With an active session running, submit captured frame for biometric check-in.
  - Verify Python AI service computes Euclidean distance < 0.55 and responds with match confirmation.
  - Verify green success banner: *"Attendance Marked: Present"*.
  - Verify immediate reflection in Faculty live console.

---

## 4. Administrative Interventions & Audit Trails

- [ ] **Manual Override with Justification:**
  - As Faculty or Admin, locate student record marked Absent.
  - Open Correction modal, select New Status: *Present*.
  - Type mandatory reason (e.g. *"Hardware camera glitch verified in person"*).
  - Submit override.
  - Confirm record updates immediately on student dashboard without refresh.
  - Verify audit log entry in Audit History table displaying faculty name, timestamp, and justification.
- [ ] **Report CSV Export & Formula Safety in Excel:**
  - Export Student or Department Attendance Report to CSV.
  - Open downloaded file in Microsoft Excel or Apple Numbers.
  - Confirm names starting with special characters (e.g. `=Sum`, `@admin`) render as plain text without triggering formulas.

---

## 5. Network Disruption & Offline Resilience

- [ ] **Simulated Network Interruption (Flight Mode):**
  - Temporarily disconnect network or enable Offline mode in Chrome DevTools.
  - Navigate between tabs -> Confirm ErrorBoundary displays friendly retry card rather than unhandled blank screen.
  - Reconnect network and click *"Update & Reload"* -> Confirm application recovers seamlessly.


# Smart Attendance — Camera User Experience & State Machine
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Face Capture User Interaction & Real-time Guidance  
**Version:** 1.0.0 (Part 7/24 Optimization)  
**Author:** Principal UX & Frontend Interaction Engineer  

---

## 1. Ten Interaction States

The camera interface implements a formal 10-state progression, providing clear visual feedback at every stage of biometric verification:

| State Key | UI Status Text | Capture Button Status | Visual Elements |
|---|---|---|---|
| `idle` | Camera Inactive | Disabled | Dark placeholder, CameraOff icon |
| `requesting_permission` | Requesting camera permissions… | Disabled | Spinner, browser prompt indicator |
| `ready` | Camera active — Center your face in the oval | Enabled | Clear video feed, dashed white oval |
| `guidance` | Positioning face within optimal oval area | Enabled | Oval with live illumination pill |
| `capturing` | Capturing high-resolution camera frame… | Disabled | 20% progress bar, shutter transition |
| `compressing` | Optimizing biometric frame (640×480)… | Disabled | 45% progress bar |
| `submitting` | Submitting biometric verification… | Disabled | 75% progress bar, blue scan line |
| `verifying` | Matching facial signature on secure gateway… | Disabled | 90% progress bar, scanning animation |
| `success` | Attendance Successfully Verified! | Hidden | Solid green oval (100%), confirmation card |
| `rejected` / `failed` | Biometric match uncertain / Error | Retry Enabled | Red oval outline, alert banner, retry button |

---

## 2. Real-Time Illumination Guidance

To reduce server-side biometric rejection rates caused by poorly lit environments, an offscreen micro-canvas (32×24 pixels) calculates scene luminance every 1.4 seconds using ITU-R BT.601 standard weights:

$$Y = 0.299R + 0.587G + 0.114B$$

### Guidance Thresholds
- **$Y < 45$ (Dim):** Oval turns amber (`#F59E0B`). Guidance pill shows Moon icon: *"Lighting is too dim — please face a light source"*.
- **$45 \le Y \le 215$ (Optimal):** Oval remains neutral white. Guidance pill shows SunMedium icon: *"Lighting condition: Optimal"*.
- **$Y > 215$ (Glare):** Oval turns amber. Guidance pill shows Sun icon: *"High glare detected — avoid bright backlighting"*.

> **Important Architecture Principle:** Client-side illumination checks serve purely as assistive UX guidance. They do **not** make security decisions or claim face presence. Authoritative face detection, landmark geometry, and Euclidean distance verification are strictly performed by the Python AI microservice.

---

## 3. Accessibility & Media Lifecycle Safeguards

1. **Front-Camera Mirroring:** Self-facing video feeds are mirrored horizontally (`scaleX(-1)`) so student movements feel natural, while captured frame pixels are appropriately oriented for computer vision.
2. **Clean Stream Disposal:** Media stream tracks are immediately terminated on component unmount, navigation, tab switching (`visibilitychange`), or session conclusion.
3. **Screen Readers:** ARIA labels and live status regions inform assistive technologies of verification state transitions.


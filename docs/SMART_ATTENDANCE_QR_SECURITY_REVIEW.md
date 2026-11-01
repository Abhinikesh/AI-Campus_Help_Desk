# Smart Attendance — Rotating QR Challenge Security Review
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Time-Bounded HMAC-SHA256 Dynamic QR Token Verification  
**Version:** 1.0.0 (Part 6/24 Hardening)  
**Author:** Application Security & Cryptography Specialist  

---

## 1. Threat Model & Vulnerabilities of Static QR Codes

Traditional QR code attendance systems suffer from severe vulnerabilities in educational institutions:
1. **Proxy Attendance via Screenshot Forwarding:** A student inside the lecture hall captures a picture of the projected QR code and forwards it via WhatsApp or Telegram to absent students.
2. **Replay Attacks:** Captured QR codes are replayed hours or days later against the server.
3. **Cross-Session Injection:** QR codes generated for Lecture A are submitted to register presence for Lecture B.

To address these attack vectors, CampusSphere AI implements dynamic rotating QR challenges via `server/services/qrChallenge.service.js`.

---

## 2. Token Architecture & Cryptographic Format

Each challenge token is structured as a three-part period-delimited string:

$$\text{Token} = \langle\text{TimestampHex}\rangle.\langle\text{NonceHex}\rangle.\langle\text{SignatureHex}\rangle$$

Where:
- `TimestampHex`: Unix timestamp in milliseconds (`Date.now().toString(16)`).
- `NonceHex`: 16 cryptographically random bytes generated via Node.js `crypto.randomBytes(16).toString('hex')`.
- `SignatureHex`: HMAC-SHA256 calculated over `sessionId + ':' + timestamp + ':' + nonce` using `JWT_SECRET` (or a dedicated `QR_HMAC_SECRET`).

```javascript
const payload = `${sessionId}:${timestamp}:${nonce}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');
const token = `${timestamp.toString(16)}.${nonce}.${signature}`;
```

---

## 3. Verification Protocol & Safeguards

When a student submits attendance (`POST /api/attendance/student/:sessionId/record`), the backend validates the token using `qrChallenge.validateChallenge(token, sessionId, maxAgeSeconds)`:

1. **Format Validation:** Ensures the token splits into exactly three valid hexadecimal parts.
2. **Session Binding:** Recomputes the HMAC-SHA256 using the target `sessionId` from the URL route parameter. If a token was generated for Session X and submitted for Session Y, the HMAC computation fails immediately.
3. **Constant-Time Signature Comparison:** The candidate signature is compared against the expected HMAC using `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
4. **Sliding Time Window (TTL):** The timestamp is checked against the server clock:
   - Tokens older than **45 seconds** (`maxAgeSeconds = 45`) are rejected with `Expired QR challenge token`.
   - Tokens with timestamps in the future (skew > 5 seconds) are rejected with `Invalid QR challenge timestamp`.
5. **Replay Cache Protection:** Recently validated nonces are tracked in memory with automatic expiration to prevent duplicate submissions of the exact same token within the 45-second window.

---

## 4. Multi-Layer Defense in Depth

The dynamic QR code is **not used in isolation**. It serves as Layer 1 of a multi-layer verification pipeline:

1. **Layer 1 (Physical Presence):** Dynamic 45-second QR code projected on classroom display.
2. **Layer 2 (User Identity):** Cryptographically verified student JWT session.
3. **Layer 3 (Academic Eligibility):** Student must be enrolled in the subject, branch, semester, and section.
4. **Layer 4 (Biometric Identity):** Live camera capture matched against enrolled 128-d face embedding via Python AI (Euclidean distance $\le 0.55$).

This guarantees that an absent student cannot mark attendance even if a proxy relays the QR code, because the absent student's live face cannot pass biometric verification.


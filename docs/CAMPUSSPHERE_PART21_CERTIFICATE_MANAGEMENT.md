# CampusSphere AI — Part 21: Certificate Management & Cryptographic Verification

## 1. Verifiable Honors Architecture

CampusSphere AI provides participation, winner, completion, and volunteer certificates with public authenticity verification:

$$\text{Attendance Verified (Present)} \xrightarrow{\text{Issue Cert}} \text{Unique Certificate Number} + \text{Crypto Verification Token} \xrightarrow{\text{Public Verification Endpoint}}$$

---

## 2. Certificate Security & Eligibility Rules

1. **Mandatory Attendance Verification:**
   - Participation certificates require verified physical presence (`status: 'present'` in `EventAttendance.js`).
   - Attempting to issue a participation certificate to an absent or unregistered student is rejected with `HTTP 400 Bad Request`.
2. **Duplicate Prevention:**
   - Compound unique index `{ event: 1, student: 1, certificateType: 1 }` prevents multiple active certificates of the same type being awarded to a student for the same event.
3. **Cryptographic Verification Tokens:**
   - Each certificate receives a unique human-readable ID (e.g. `CERT-2026-A1B2C3D4`) and a 16-byte random hex verification token (`crypto.randomBytes(16).toString('hex')`).
4. **Zero-PII Public Verification:**
   - Anyone (employers, academic evaluators, public users) can verify a certificate at `GET /api/certificates/verify/:identifier`.
   - The response confirms valid issuance, event title, participant name, date, honor type, and issuing dean without exposing private student contact details or academic marks.

# CampusSphere AI — Part 23/24 Employee Document Security
## Document Vault Architecture, Confidential Access Control & Path Traversal Defenses

---

## 1. Overview & Threat Model

The Employee Document Vault handles high-sensitivity personnel documentation:
- Government Identity Proofs (Aadhaar cards, Passports, Driver's Licenses)
- Academic Qualifications (Degree certificates, marksheets, transcripts)
- Employment Contracts, Offer Letters, Appointment Letters
- Background Verification Reports & Police Clearances
- Confidential Performance Appraisals & Salary Information

### Key Security Threats
1. **Insecure Direct Object Reference (IDOR)**: Malicious employee viewing another staff member's confidential background check or certificates.
2. **Directory & Path Traversal (CWE-22)**: Manipulated filename attempting to escape the storage root (`../../etc/passwd` or `../../server/.env`).
3. **Malicious File Upload (CWE-434)**: Uploading executable scripts (`.sh`, `.php`, `.js`, `.exe`) posing as documents.
4. **Confidentiality Leakage**: General departmental staff viewing confidential executive salary or disciplinary documents.

---

## 2. Multer Configuration & Whitelist Filtering

All document uploads are processed through a strictly restricted Multer pipeline:

```javascript
const HR_UPLOADS = path.join(__dirname, '../uploads/hr');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, HR_UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Neutralize any path traversal sequences and special characters
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `doc-${Date.now()}-${cleanBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid document file type. Allowed: PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX'));
  }
};
```

---

## 3. Strict Download Access Control & Traversal Defense

When downloading or streaming an employee document via `GET /api/hr/documents/:id/download`:

```javascript
exports.downloadDocument = async (req, res) => {
  const doc = await EmployeeDocument.findById(req.params.id).populate('employee');
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  const userId = getUserId(req);
  const isOwner = doc.employee.user.toString() === userId.toString();
  const isHrOrAdmin = ['admin', 'hr_admin', 'hr_officer'].includes(req.user?.role);

  // 1. Authorization: Only owner or HR Admin/Officer can access
  if (!isOwner && !isHrOrAdmin) {
    return res.status(403).json({ success: false, message: 'Unauthorized to access this document' });
  }

  // 2. Confidentiality: Non-HR owners cannot access confidential appraisals/salary documents
  if (doc.isConfidential && !isHrOrAdmin) {
    return res.status(403).json({ success: false, message: 'Access denied: confidential document' });
  }

  // 3. Path Traversal Defense: Ensure safe path resolution strictly within HR_UPLOADS
  const safePath = path.resolve(HR_UPLOADS, path.basename(doc.fileName));
  if (!fs.existsSync(safePath)) {
    return res.status(404).json({ success: false, message: 'Physical document file missing on server' });
  }

  res.download(safePath, doc.title || doc.fileName);
};
```

---

## 4. Document Verification Lifecycle

To ensure employment compliance:
1. When an employee uploads a qualification or identity document, it defaults to `isVerified: false`.
2. An authorized HR Administrator reviews the physical credential or digital copy.
3. Upon satisfaction, HR executes `PATCH /api/hr/documents/:id/verify`.
4. The system records `isVerified: true`, stamps `verifiedBy: req.user.userId`, and records `verifiedAt: new Date()`.

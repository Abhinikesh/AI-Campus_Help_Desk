# CampusSphere AI — Part 13: File Storage & Download Security Review

## 1. Storage Architecture

All assignment attachments and student submission files are stored using `multer` configured in `server/services/assignmentStorage.service.js`.

### 1.1. Physical Directory Structure
```
server/uploads/assignments/
├── attachments/      <-- Faculty-uploaded reference materials
└── submissions/      <-- Student-uploaded coursework solutions
```
- Directories are stored locally on disk outside public static routes (`/uploads` static middleware does NOT expose `/assignments` directly).
- Files are saved with randomized, unguessable filenames:
  ```javascript
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  ```
- Original client file names are preserved solely in document metadata (`fileDoc.name`).

---

## 2. Security Controls & Validation

### 2.1. File Size Limits
- Maximum file size: **25 MB per file**.
- Handled at stream-time by `multer({ limits: { fileSize: 25 * 1024 * 1024 } })`.
- Maximum 5 files per upload request (`array('files', 5)`).

### 2.2. Whitelisted Extensions & MIME Validation
Executable files (`.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.py`, `.php`, `.jsp`, etc.) are strictly prohibited.
Permitted extensions:
- Documents: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.txt`
- Archives: `.zip`
- Images: `.jpg`, `.jpeg`, `.png`

### 2.3. Path Traversal Defense (`verifySafePath`)
To protect against directory traversal attacks (`../../../../etc/passwd` or encoded `%2e%2e%2f`), every file retrieval verifies that the canonical absolute path begins with the base storage root:
```javascript
function verifySafePath(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(BASE_UPLOAD_DIR)) {
    throw new ApiError(403, 'Path traversal detected: Access denied to outside storage directory');
  }
  return resolved;
}
```

### 2.4. Download Access Control Matrix
Direct URL access without authentication is impossible. Downloads are streamed through Express controllers with role and identity verification:

1. **Assignment Attachments (`downloadAssignmentAttachment`):**
   - Faculty creator can download.
   - Admin can download.
   - Enrolled students (matching branch and semester) can download.
   - Students outside the branch/semester are rejected with `403 Forbidden`.

2. **Student Submissions (`downloadSubmissionFile`):**
   - The submitting student owner (`String(submission.studentUser) === String(req.user.userId)`) can download.
   - The assigned course faculty (`String(assignment.faculty) === String(req.user.userId)`) can download.
   - Admin can download.
   - Any other student or unauthorized faculty member is rejected with `403 Forbidden`.


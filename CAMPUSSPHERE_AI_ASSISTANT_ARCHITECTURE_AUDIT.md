# CampusSphere AI Assistant — Architecture Audit & RAG Engineering Blueprint
**Document ID:** `CAMPUSSPHERE_AI_ASSISTANT_ARCHITECTURE_AUDIT.md`  
**Date:** November 11, 2026  
**Auditor & Chief AI Architect:** Antigravity AI Engineering & Architecture Team  
**Scope:** Unified College-Specific AI Assistant (Replacing Legacy AI Tutor / Help Desk)  
**Execution Mandate:** Strictly Read-Only Audit & Architectural Design, Zero Breaking Changes  

---

## 1. Executive Summary

CampusSphere AI currently includes an "AI Help Desk" / chat interface (`client/src/pages/AIHelpDesk/index.jsx` and `client/src/components/ChatWidget/ChatWidget.jsx`), driven by a minimal backend controller (`server/controllers/ai.controller.js`). 

A rigorous, full-stack architectural audit of the existing AI implementation revealed that:
1. **Zero Database Grounding:** The existing chat controller executes **no MongoDB queries, no document lookups, and no ERP checks**. It operates purely on static system prompts and hardcoded demo strings (`DEMO_REPLIES`).
2. **Missing Authentication:** `server/routes/ai.routes.js` leaves `POST /api/ai/chat` **completely unauthenticated** (the auth middleware is commented out). Anonymous requests default to `{ role: 'student', name: 'User' }`.
3. **Decoupled Python AI Service:** The Python Flask AI service (`ai-service` on port 5002) is solely utilized for Smart Attendance facial biometrics and basic analytics math; it possesses no LLM capabilities, document chunking, or RAG endpoints.
4. **Hallucination & Fabrication Risk:** When live LLM calls (`llama-3.1-8b-instant`) are enabled via Groq, the model generates generic advice without knowing any college-specific course codes, timetables, room assignments, fee balances, or examination regulations.

This document presents the complete architectural blueprint for replacing the legacy tutor with one unified, permission-aware **CampusSphere AI Assistant**. The new assistant operates on a **Hybrid RAG + Structured Mongoose Retrieval** engine, enforces strict Role-Based Access Control (RBAC), guarantees evidence-grounded responses with source citations, and automatically integrates with the reusable dataset ingestion pipeline (`server/data/imports/`).

---

## 2. Existing AI Infrastructure Audit

### 2.1 Component Inventory & Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CURRENT AI SYSTEM STACK                            │
├─────────────────────┬───────────────────────────────┬───────────────────────┤
│ Component           │ File Path                     │ Current Status        │
├─────────────────────┼───────────────────────────────┼───────────────────────┤
│ Full Chat Interface │ client/src/pages/AIHelpDesk/  │ Reusable UI; 2 panels;│
│                     │ index.jsx, AIHelpDesk.css     │ claims "Gemini AI"    │
├─────────────────────┼───────────────────────────────┼───────────────────────┤
│ Floating Mini Widget│ client/src/components/        │ Working popup;        │
│                     │ ChatWidget/ChatWidget.jsx     │ only on 2 pages       │
├─────────────────────┼───────────────────────────────┼───────────────────────┤
│ Client API Service  │ client/src/services/          │ Simple Axios wrapper  │
│                     │ ai.service.js                 │ for /api/ai/chat      │
├─────────────────────┼───────────────────────────────┼───────────────────────┤
│ Express Chat Route  │ server/routes/ai.routes.js    │ Unauthenticated!      │
│                     │                               │ Auth middleware paused│
├─────────────────────┼───────────────────────────────┼───────────────────────┤
│ Chat Controller     │ server/controllers/           │ Keyword router + Groq │
│                     │ ai.controller.js              │ or static demo replies│
├─────────────────────┼───────────────────────────────┼───────────────────────┤
│ Python AI Service   │ ai-service/app/               │ Biometrics/Attendance │
│                     │ routes/*.py                   │ only; no LLM / RAG    │
└─────────────────────┴───────────────────────────────┴───────────────────────┘
```

### 2.2 Deep-Dive Defect Analysis

#### Defect AI-01: Unauthenticated Chat API Endpoint
- **Location:** `server/routes/ai.routes.js` (Lines 5–7)
  ```javascript
  // Optionally require auth middleware
  // const { protect } = require('../middleware/authMiddleware');

  router.post('/chat', aiController.chat);
  ```
- **Vulnerability:** Anyone on the local network or internet can execute arbitrary prompts against `POST /api/ai/chat`. The controller defaults unauthenticated users to:
  ```javascript
  const user = req.user || { role: 'student', name: 'User' };
  ```
- **Remediation:** Mount `authMiddleware` from `server/middleware/auth.middleware.js` to populate verified `req.user.userId`, `req.user.role`, and `req.user.studentId`.

#### Defect AI-02: Zero Real ERP Data Grounding
- **Location:** `server/controllers/ai.controller.js` (Lines 62–95)
- **Defect Impact:** When a student asks "What is my next class?" or "Show my CGPA", the system cannot answer truthfully. If `GROQ_API_KEY` is empty, it returns:
  `"[Demo Mode] Timetables, exams, and results are on your dashboard."`
  If `GROQ_API_KEY` is set, `llama-3.1-8b-instant` fabricates generic university responses.
- **Root Cause:** Total absence of database query dispatchers or document retrieval pipelines.

#### Defect AI-03: Decoupled Python Service Capabilities
- **Location:** `ai-service/app/routes/`
- **Current Role:** 5 route modules (`biometric_routes.py`, `enrollment_routes.py`, `verification_routes.py`, `analytics_routes.py`, `health_routes.py`).
- **Defect Impact:** Python service has `numpy`, `opencv`, `dlib`, `face_recognition`, but possesses no text embeddings (`sentence-transformers`), vector stores (`chromadb` / `faiss`), or document parsers.

---

## 3. Reusable Assets & Foundation

Despite the lack of grounding, significant high-value infrastructure can be retained:

1. **Frontend Chat Layout (`AIHelpDesk/index.jsx`):**
   - Clean, light-mode, two-panel layout (`.ai-history-panel` and `.ai-chat-panel`).
   - Session management state (`sessions`, `activeId`, `newChat`, `clearChat`).
   - Auto-scrolling to bottom (`bottomRef`), dot typing indicator (`TypingDots`), and suggestion chips.
   - Markdown formatting for responses (`bold`, `bullet points`, `line breaks`).
2. **Persistent Floating Launcher (`ChatWidget.jsx`):**
   - Floating Action Button (FAB) with animation and dot indicator.
   - Smooth slide-up mini chat popup with direct link to full `/ai-help` view.
3. **Mongoose Domain Schema Depth:**
   - 60+ domain models ready for structured retrieval: `Student`, `Faculty`, `Timetable`, `Mark`, `Exam`, `FeeInvoice`, `Subject`, `Complaint`, `HostelAllocation`, `TransportRoute`.
4. **Secure Express-Python Bridge (`PythonAiService`):**
   - Authenticated internal HTTP bridge (`X-Internal-Key`) for delegating computationally intensive operations between Express and Python.

---

## 4. Permission-Aware RAG & Hybrid Retrieval Architecture

To achieve 100% truthful, verifiable, and authorized answers, CampusSphere AI Assistant must employ a **Two-Tier Hybrid Retrieval System**:

```
                       USER QUERY (from Student, Faculty, or Admin)
                                      │
                                      ▼
                        [Backend Authentication Guard]
                  (Extracts verified req.user: userId, role)
                                      │
                                      ▼
                      [Semantic Query Router & Classifier]
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
    [Path 1: Structured ERP Engine]            [Path 2: Unstructured Document RAG]
  (Deterministic Mongoose Queries)             (Hybrid Vector & Full-Text Search)
  • Timetable (Student/Faculty slot)           • College Regulations & Handbooks
  • Marks, Grades, SGPA/CGPA                   • Academic Calendar AY 2026-2027
  • Fee Invoices & Paid Receipts               • Course Syllabus & Exam Rules
  • Enrolled Subjects & Room Numbers           • Hostel & Transport Policies
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                    [RBAC Scope & Privacy Enforcement Filter]
               • Student: Can ONLY see own records
               • Faculty: Can ONLY see assigned classes & students
               • Admin: Scoped institutional summaries
               • Strips biometric embeddings, passwords, tokens
                                      │
                                      ▼
                     [Context Assembly & Grounding Prompt]
                                      │
                                      ▼
                 [Inference Engine (Groq / Gemini / Local)]
                 • temperature: 0.1 (Strict non-hallucinatory)
                 • System Prompt: "Answer ONLY using provided records"
                                      │
                                      ▼
                  [Evidence Citation & Source Tag Generator]
                                      │
                                      ▼
                   FINAL VERIFIED RESPONSE WITH SOURCE BADGES
```

---

## 5. Structured ERP Query Dispatcher (Path 1)

Structured questions about entities represented in the database must **never rely on probabilistic vector search**. They must execute deterministic, indexed Mongoose queries:

### 5.1 Query Dispatch Matrix

| Intent Category | Supported User Questions | Target Collections / Models | Backend Authorization Query |
| :--- | :--- | :--- | :--- |
| **Timetable / Schedule** | "When is my next class?", "Which room is DAA?", "My timetable for today" | `Timetable`, `Subject` | **Student:** `{ branch: student.branch, semester: student.semester, day: currentDay }`<br>**Faculty:** `{ faculty: facultyUserId, day: currentDay }` |
| **Academic Performance** | "What is my CGPA?", "Show my mid-term marks for CS501", "Did I pass FLAT?" | `Mark`, `Exam`, `Subject` | **Student:** `{ student: student._id, status: 'published' }`<br>**Faculty:** Restricted to students in faculty's assigned sections. |
| **Enrolled Subjects** | "Who teaches Computer Graphics?", "How many credits is SDP?", "List my courses" | `Subject`, `Student` | Filtered by student's branch, semester, and curriculum catalog. |
| **Fee Status** | "What is my pending fee?", "Show my receipt for Semester 5", "Fee due date" | `FeeInvoice`, `PaymentTransaction` | **Student:** `{ student: student._id }`<br>**Faculty:** Access Denied (HTTP 403).<br>**Admin:** Aggregated sums. |
| **Complaints & Grievances** | "Status of my hostel complaint", "List pending IT issues" | `Complaint` | **Student:** `{ raisedBy: userId }`<br>**Admin:** `{ status: 'pending' }` |
| **Faculty Teaching Info** | "How many students in my 5 CSE-A class?", "My assigned subjects" | `Subject`, `Student`, `Faculty` | **Faculty:** `{ faculty: facultyUserId }` |
| **Campus Facilities** | "Where is Lab AS17?", "Hostel mess menu for today", "Is library open?" | `EventVenue`, `MessMenu`, `LibraryPolicy` | Public / Role-agnostic campus records. |

---

## 6. Unstructured Document RAG Engine (Path 2)

Unstructured information (ordinances, syllabi, guidelines, notifications) is indexed into a vector search collection (`DocumentChunk`):

### 6.1 Document Index Schema (`server/models/DocumentChunk.js`)

```javascript
const documentChunkSchema = new mongoose.Schema({
  documentTitle: { type: String, required: true },
  documentType:  { type: String, enum: ['calendar', 'syllabus', 'policy', 'handbook', 'notice'], required: true },
  sourceFile:    { type: String, required: true },
  chunkIndex:    { type: Number, required: true },
  content:       { type: String, required: true },
  embedding:     { type: [Number], required: true }, // 384-dim (MiniLM) or 768-dim
  metadata: {
    academicYear: { type: String, default: '2026-2027' },
    department:   { type: String, default: 'ALL' },
    semester:     { type: Number },
    authorizedRoles: [{ type: String, enum: ['student', 'faculty', 'admin'], default: ['student', 'faculty', 'admin'] }],
    isPublic:     { type: Boolean, default: true },
  },
  createdAt:     { type: Date, default: Date.now },
});

documentChunkSchema.index({ 'metadata.authorizedRoles': 1, 'metadata.department': 1 });
```

### 6.2 Chunking and Embedding Specifications
- **Chunk Size:** 500 tokens (~2,000 characters).
- **Chunk Overlap:** 50 tokens (~200 characters) to preserve boundary semantics.
- **Embedding Model:** `all-MiniLM-L6-v2` (fast, free, local via Python service) or Google `text-embedding-004`.
- **Retrieval Mechanism:** Top-K ($K=4$) cosine similarity reranked by keyword matching (BM25).

---

## 7. Role-Based Access Control (RBAC) & Privacy Safeguards

The assistant must be an extension of the existing authorization architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ROLE-BASED DATA VISIBILITY RULES                     │
├─────────────────┬──────────────────────────────────────────────────────┤
│ Authenticated   │ Permitted Data Ingestion to Context                  │
│ Role            │                                                      │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Student         │ • Own timetable, enrolled subjects, published marks  │
│                 │ • Own fee invoices, payments, own complaints         │
│                 │ • Public campus maps, academic calendar, library     │
│                 │ ✗ FORBIDDEN: Other students' marks, grades, phones   │
│                 │ ✗ FORBIDDEN: Faculty payroll, internal complaints    │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Faculty         │ • Assigned timetable slots, subjects taught          │
│                 │ • Student rosters within faculty teaching scope      │
│                 │ • Attendance sessions conducted, department notices  │
│                 │ ✗ FORBIDDEN: Student fee balances, unassigned grades │
│                 │ ✗ FORBIDDEN: Unrelated faculty employee records      │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Administrator   │ • Aggregate enrollment, institutional fee metrics    │
│                 │ • System complaints, bus fleet status, hostel counts │
│                 │ ✗ FORBIDDEN: Raw biometric face embeddings           │
│                 │ ✗ FORBIDDEN: Plaintext passwords or auth tokens      │
└─────────────────┴──────────────────────────────────────────────────────┘
```

### Prompt-Level Guardrail Enforcement
Every LLM call is wrapped with an immutable system instruction:
```text
You are the official CampusSphere AI Assistant for our institution.
Answer the user's inquiry strictly using the provided [VERIFIED COLLEGE RECORDS] and [DOCUMENT EXCERPTS].

STRICT RULES:
1. Do not invent, extrapolate, or speculate.
2. If the user asks about records outside their verified context, reply:
   "I do not have authorization to access this data."
3. If the answer cannot be found in the provided context, reply exactly:
   "This information was not found in the verified college database or official documents. Please contact your department coordinator or the Academic Cell."
4. Always list your sources at the bottom in the format:
   Sources: [Record Type / Document Name]
```

---

## 8. Source Attribution & User-Facing Grounding Design

When the assistant provides an answer, the response payload returns both the synthesized text and structured references:

### 8.1 API Response Contract
```json
{
  "success": true,
  "data": {
    "reply": "Your next class is **Design Analysis of Algorithms (DAA)** (CS501) taught by **Prof. Neha Singh** at **08:10 AM** in **Room AS17**.",
    "agent": "academic",
    "isGrounded": true,
    "sources": [
      {
        "type": "database_record",
        "entity": "Timetable",
        "reference": "5th Sem CSE-A, Period 1 (Mon 08:10 AM)",
        "verifiedAt": "2026-11-11T10:30:00Z"
      }
    ]
  }
}
```

### 8.2 Frontend UI Source Badges
In `AIHelpDesk/index.jsx` and `ChatWidget.jsx`, render a distinct citation pill below each assistant message:
```jsx
{msg.sources && msg.sources.length > 0 && (
  <div className="ai-sources-bar">
    <span className="ai-verified-tag">✓ Verified College Record</span>
    {msg.sources.map((s, idx) => (
      <span key={idx} className="ai-source-chip" title={`Verified: ${s.verifiedAt}`}>
        {s.reference}
      </span>
    ))}
  </div>
)}
```

---

## 9. Non-Functional Evaluation (Freshness, Latency, Privacy, Cost)

| Dimension | Evaluation & Requirement | Architectural Solution |
| :--- | :--- | :--- |
| **Data Freshness** | Transactional updates (marks published, classes rescheduled) must be available immediately without re-embedding. | **Zero-Latency Path:** Structured Mongoose queries execute in real time on the live database. No vector caching for transactional data. |
| **Indexing Strategy** | Fast lookup of student records, course codes, and periods. | Compound indexes `{ branch: 1, semester: 1, day: 1 }` in Mongoose; HNSW index on vector collection in MongoDB/Python. |
| **Document Extraction** | High-fidelity ingestion of PDFs, timetables, and college handbooks. | Python extraction engine using `pdfplumber` and `numbers-parser` for tables; OCR fallback for scanned circulations. |
| **Search Accuracy** | Accuracy for exact course codes (`CS501`, `AS17`) + natural language queries ("Where can I eat?"). | **Hybrid Search:** Combines MongoDB text search with vector cosine similarity. |
| **Response Latency** | User expects conversational turn under 1.5 seconds. | Groq `llama-3.1-8b-instant` (time to first token < 300ms, completion < 800ms) or Gemini Flash API. Total turn < 1,100ms. |
| **API Costs** | Maintain sustainable institutional operational expenditure. | Low inference costs using Groq or Gemini Free/Tier 1 ($0.0001 per turn; ~$1.50/month for typical college usage). |
| **Privacy & Security** | Protection of student identity, FERPA compliance, India DPDP Act 2023. | **Zero PII Leakage:** Names/roll numbers only injected into private tenant context; no biometric vectors ever sent to LLM APIs. |

---

## 10. Reusable Dataset Ingestion Integration

When new college datasets are added via `server/data/imports/` (e.g. `classWise-TT-21_OCT_2026.pdf` or `erp_Datasets_1.numbers`), the dataset ingestion pipeline automatically equips the AI Assistant:

```
┌────────────────────────────────────────────────────────────────────────┐
│              DATASET INGESTION TO AI ASSISTANT BRIDGE                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Ingestion Worker processes files in server/data/imports/            │
│ 2. Structured Ingestion: Updates Timetable, Subject, and Student       │
│    Mongoose collections -> Instantly accessible to Structured Path 1.  │
│ 3. Text & Policy Chunking: Splits unstructured notes, syllabus, and    │
│    regulations into 500-token chunks.                                  │
│ 4. Vector Embedding: Generates embeddings via Python AI service.       │
│ 5. Metadata Tagging: Labels chunks with academic session, department,  │
│    and role permissions.                                               │
│ 6. Assistant Activation: AI Assistant can immediately answer queries   │
│    referencing the newly ingested timetable and students!              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Phased Implementation Roadmap

### Phase 1: Security & Route Hardening (Day 1)
- Mount `authMiddleware` on `server/routes/ai.routes.js`.
- Enforce user identity and role extraction (`req.user.userId`, `req.user.role`).
- Implement basic rate limiting (30 requests/minute per IP/user).

### Phase 2: Structured ERP Query Engine (Days 2–3)
- Author `server/services/aiErpContext.service.js`.
- Implement deterministic query resolvers for Timetable, Marks, Enrolled Courses, Fees, and Complaints.
- Inject verified ERP records into the LLM system context.

### Phase 3: Document RAG & Embedding Service (Days 4–5)
- Create `DocumentChunk` Mongoose model.
- Add document embedding endpoint in `ai-service` (`/api/ai/documents/embed`).
- Ingest academic calendar and college handbook into vector storage.

### Phase 4: Frontend Grounding & Citation Badges (Day 6)
- Update `AIHelpDesk/index.jsx` to render verified source badges and citations.
- Mount `ChatWidget.jsx` in `StudentDashboard`, `FacultyDashboard`, and `AdminDashboard`.
- Polish light-mode styling in `AIHelpDesk.css` and `ChatWidget.css`.

### Phase 5: Verification & Quality Assurance (Day 7)
- Test unauthorized access attempts (Student attempting to query faculty payroll -> Blocked).
- Test missing evidence queries (Verify fallback phrase is returned with zero hallucinations).
- Benchmark end-to-end latency (< 1,200ms).

---

## 12. Verification & Safety Test Protocols

| Test ID | Scenario / Prompt | Expected Behavior |
| :--- | :--- | :--- |
| **TEST-AI-01** | Unauthenticated `POST /api/ai/chat` | Returns HTTP 401 Unauthorized. |
| **TEST-AI-02** | Student: "What is my next class?" | Assistant queries `Timetable` for student's branch/semester; returns exact time, room (`AS17`), and course code (`CS501`) with source tag `[Timetable: 5 CSE-A]`. |
| **TEST-AI-03** | Student: "What did Arjun Sharma score in exams?" | Assistant replies: "I do not have authorization to access other students' academic records." |
| **TEST-AI-04** | Student: "What is the fee for Ph.D. in Aerospace?" | Assistant replies: "This information was not found in the verified college database or official documents. Please contact the Academic Cell." (Zero hallucination). |
| **TEST-AI-05** | Faculty: "Who is in my 3rd period class?" | Assistant verifies faculty teaches that slot; returns verified student roster count and section name. |
| **TEST-AI-06** | Ingestion Test | Upload `classWise-TT-21_OCT_2026.pdf` -> Ask "Where is 7th Sem CSE-B Lab?" -> Assistant answers using the newly ingested timetable. |

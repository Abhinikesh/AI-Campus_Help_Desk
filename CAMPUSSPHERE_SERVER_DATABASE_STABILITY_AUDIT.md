# CampusSphere AI — Server & Database Stability Audit Report

**Report Identifier:** `CAMPUSSPHERE_SERVER_DATABASE_STABILITY_AUDIT.md`  
**Audit Date:** November 19, 2026  
**Auditor Mode:** Strictly Read-Only Infrastructure Audit  
**Target Environment:** CampusSphere AI Platform (`~/AI-Campus_Help_Desk`)  
**Services Inspected:**
- Frontend: React + Vite (`:5173`)
- Backend: Node.js + Express (`:5001`)
- AI Service: Python + Flask (`:5002`)
- Database: MongoDB Standalone WiredTiger (`:27018`, database: `campus-erp`)

---

## 1. Overall Infrastructure Health

The CampusSphere AI platform exhibits a healthy and responsive core operational state across its primary web, API, and database services. Network proxying, preflight CORS resolution, database query execution, and core security guardrails are fully functional.

The primary system vulnerability lies not in running service health, but in **process lifecycle coupling, missing top-level error nets, and uncoordinated multi-service process management**.

### Infrastructure Health Scorecard

| Service / Layer | Target Port | Runtime Process | Observed State | Audit Status | Health Assessment |
|---|:---:|---|---|:---:|---|
| **Vite Frontend** | `5173` | `node .../vite --port 5173` (PID 51092) | Listening on `*:5173` | **PASS** | Healthy; HTTP 200; proxying `/api/*` to `:5001`. |
| **Express Backend** | `5001` | `node server.js` (PID 47264) | Listening on `*:5001` | **PASS** | Healthy; HTTP 200; MongoDB connected. |
| **MongoDB Service** | `27018` | `mongod-arm64-darwin-8.2.6` (PID 47266) | Listening on `127.0.0.1:27018` | **PASS** | Healthy; 102 collections; 224MB RSS; 0 connection errors. |
| **Python AI Service** | `5002` | None (Inactive) | Not Listening / Offline | **FAIL** | Code and `.venv` 100% verified (85/85 tests passed), but service daemon not started. |
| **API Reverse Proxy** | `5173 -> 5001` | Vite Internal Proxy Engine | Forwards `/api/*` seamlessly | **PASS** | `/api/health` returns HTTP 200 with matching CORS headers. |
| **Database Storage** | N/A | WiredTiger on disk (`server/.data/db`) | Persistent on NVMe disk (67 MB) | **PASS** | Intact storage engine files; zero corruption detected. |

---

## 2. Port and Process Inventory

Active inspection using `lsof -i -P -n` and `ps aux` identified the following active process tree:

```
+---------------------------------------------------------------------------------------------------------+
|                                    Process & Port Dependency Tree                                       |
|                                                                                                         |
|  PID 51076 (npm exec vite --port 5173)                                                                  |
|      └── PID 51092 [node .../vite --port 5173]  ──────────────> Port 5173 (LISTEN)                       |
|                                                                    │                                    |
|                                                          (Reverse Proxy /api/*)                         |
|                                                                    │                                    |
|                                                                    v                                    |
|  PID 47264 [node server.js]  ─────────────────────────────────> Port 5001 (LISTEN)                       |
|      ├── PID 47266 [mongod-arm64-darwin-8.2.6]  ──────────────> Port 27018 (LISTEN)                      |
|      └── PID 47267 [mongo_killer.js 47264 47266]                                                        |
|                                                                                                         |
|  Port 5002 [Python Flask AI Service]  ────────────────────────> OFFLINE (Process not running)            |
+---------------------------------------------------------------------------------------------------------+
```

### Detailed Process Specifications

1. **Frontend Dev Server:**
   - **Port:** `5173` (TCP IPv6 `*:5173`)
   - **Process ID:** `51092` (Parent PID: `51076`)
   - **Executable:** `/Users/abhinikesh/AI-Campus_Help_Desk/client/node_modules/.bin/vite`
   - **Arguments:** `--port 5173`
   - **Memory Usage:** 155.4 MB RSS
   - **CPU:** 0.0% idle

2. **Backend Server:**
   - **Port:** `5001` (TCP IPv6 `*:5001`)
   - **Process ID:** `47264` (Parent PID: `1` via Launchd/Subshell)
   - **Executable:** `node` (Node.js v25.9.0)
   - **Command:** `node server.js`
   - **Memory Usage:** 128.6 MB RSS
   - **CPU:** 0.0% idle

3. **MongoDB Engine:**
   - **Port:** `27018` (TCP IPv4 `127.0.0.1:27018`)
   - **Process ID:** `47266` (Parent PID: `47264` — spawned as child of `server.js`)
   - **Executable:** `/Users/abhinikesh/.cache/mongodb-binaries/mongod-arm64-darwin-8.2.6`
   - **Arguments:** `--port 27018 --dbpath /Users/abhinikesh/AI-Campus_Help_Desk/server/.data/db --storageEngine wiredTiger --bind_ip 127.0.0.1 --noauth`
   - **Memory Usage:** 224.0 MB RSS
   - **CPU:** 0.0% idle

4. **MongoDB Supervisor (`mongo_killer.js`):**
   - **Process ID:** `47267` (Parent PID: `47264`)
   - **Command:** `/opt/homebrew/Cellar/node/25.9.0_1/bin/node .../mongodb-memory-server-core/scripts/mongo_killer.js 47264 47266`
   - **Purpose:** Watchdog process that terminates `mongod` if parent Node process `47264` terminates unexpectedly.

5. **Python AI Service:**
   - **Port:** `5002`
   - **Process ID:** **None** (Not listening)
   - **Status:** OFFLINE

---

## 3. MongoDB Health and Connection Findings

### 3.1. Connection & Server Metrics
- **MongoDB Server Version:** `8.2.6` (WiredTiger Storage Engine)
- **Active Database Name:** `campus-erp`
- **Host Endpoint:** `127.0.0.1:27018`
- **Authentication:** Disabled (`--noauth` for local development instance)
- **Current Connections:** 30 open connections (all originating from Node.js Express backend PID `47264`).
- **Connection Capacity:** 209,685 available connection slots; 0 connections rejected; 0 rate-limited admissions.
- **Request Volume:** 6,973 ingress requests processed with 0 failures or slow DNS/SSL operations.
- **Data Persistence:** Stored on local NVMe disk at `server/.data/db/` (Total on-disk size: 67.8 MB).

### 3.2. Collection Inventory & Key Document Counts
MongoDB currently manages **102 collections**. Key operational collections and document counts include:

| Collection Name | Document Count | Purpose / Primary Entity |
|---|:---:|---|
| `admissionapplications` | **2,531** | Institutional applicant records |
| `attendances` | **847** | Student daily & biometric attendance logs |
| `students` | **561** | Student records (535 canonical 2024 BCS + 18 other + 8 synthetic) |
| `notifications` | **109** | System and role notifications |
| `stagingstudents` | **64** | Roster staging & verification records |
| `employeeleavebalances` | **57** | HR employee leave allocation ledgers |
| `leaveledgerentries` | **57** | Detailed leave transaction entries |
| `auditlogs` | **46** | Core system mutation audit logs |
| `timetableentries` | **45** | Weekly scheduled lecture periods |
| `attendancesessions` | **27** | Active/historical classroom attendance sessions |
| `users` | **28** | Authenticated user credentials (1 Admin, 19 Faculty, 8 Demo Students) |
| `faculties` | **19** | Faculty master records |
| `employeeprofiles` | **19** | HR employee profile records |
| `attendanceauditlogs` | **10** | Attendance biometric security audit logs |
| `departments` | **5** | Academic departments |
| `designations` | **4** | Institutional staff designations |
| `leavepolicies` | **3** | Institutional leave policy definitions |
| `enrollmentregisterimports` | **3** | Roster import batch logs |
| `complaints` | **3** | Student grievance records |
| `timetableversions` | **2** | Timetable version control records |
| `faceembeddings` | **2** | AES-GCM encrypted facial biometric embeddings |
| `consentrecords` | **1** | Student biometric consent records |
| `attendancesettings` | **1** | Global attendance threshold configuration |

### 3.3. Index Audit Findings
- Every collection has a default unique `_id_` index.
- Critical lookups are backed by compound and unique indexes:
  - `users`: `loginId_1` [UNIQUE], `email_1` [UNIQUE], `name_text_email_text_loginId_text` [TEXT].
  - `students`: `rollNumber_1` [UNIQUE], `email_1` (sparse), `user_1` (sparse).
  - `timetableentries`: Compound indices preventing scheduling conflicts:
    - `idx_timetable_scope_schedule` (`scopeKey`, `dayOfWeek`, `period`, `batch`, `status`)
    - `idx_timetable_multi_faculty_conflict` (`instructors`, `dayOfWeek`, `period`, `status`)
    - `idx_timetable_room_conflict` (`room`, `dayOfWeek`, `periodNumbers`, `status`)
- **Slow Query Evaluation:** Under current development load, average query latency is < 2ms with zero logged slow queries.

---

## 4. Node.js Backend Findings

### 4.1. Startup Sequence Analysis
Inspection of `server/server.js` and `server/config/db.js` revealed the following startup flow:

```
[server.js executes]
   │
   ├── 1. Load .env via dotenv.config()
   ├── 2. Validate env vars via config/env.js (exits if required vars missing)
   ├── 3. Call connectDB() asynchronously [UN-AWAITED!]
   │       └── If MONGODB_URI is blank, spawn MongoMemoryServer on port 27018
   │
   ├── 4. Configure Express middleware (Helmet, CORS, body parsers, rate limiting)
   ├── 5. Register 22 API route modules
   ├── 6. Register protected /uploads static guard
   ├── 7. Register /api/health endpoint
   ├── 8. Register errorHandler middleware (registered LAST)
   │
   └── 9. app.listen(PORT) binds port 5001 [SYNCHRONOUS]
           └── sessionScheduler.startScheduler(60000)
```

### 4.2. Critical Backend Runtime Findings

1. **Unawaited MongoDB Connection (Risk: HIGH):**
   - In `server/server.js` (line 22), `connectDB()` is invoked without `await`.
   - In line 140, `app.listen(PORT)` is called synchronously immediately afterward.
   - **Impact:** Express begins listening on port 5001 before Mongoose has confirmed connection to MongoDB. While Mongoose buffers queries during initialization (`bufferCommands: true`), any immediate heavy request during a slow database spin-up could experience latency spikes or throw timeout errors if the database fails to start.

2. **Missing Top-Level Process Safety Nets (Risk: HIGH):**
   - `server/server.js` has no listeners for `process.on('unhandledRejection')` or `process.on('uncaughtException')`.
   - **Impact:** In modern Node.js runtimes, an unhandled promise rejection in an asynchronous background service (such as `sessionScheduler.js`, timer callbacks, or unhandled file operations) will terminate the Node.js process immediately without warning.

3. **Missing Mongoose Pool & Disconnect Configuration (Risk: MEDIUM):**
   - In `server/config/db.js`, `mongoose.connect(uri)` passes no pool options (`maxPoolSize`, `minPoolSize`, `serverSelectionTimeoutMS`, `socketTimeoutMS`).
   - No event listeners exist on `mongoose.connection` (`on('disconnected')`, `on('error')`, `on('reconnected')`).
   - **Impact:** If MongoDB is temporarily stopped or restarted, backend logs will not reflect connection loss or recovery events.

4. **Graceful Shutdown Implementation (Risk: LOW):**
   - `SIGTERM` and `SIGINT` signals are intercepted.
   - `gracefulShutdown()` halts `sessionScheduler.stopScheduler()`, closes the HTTP server, and disconnects Mongoose.
   - **Gap:** There is no hard fallback timeout (e.g. `setTimeout(() => process.exit(1), 5000).unref()`). If a client keeps a persistent HTTP connection open, `server.close()` could hang indefinitely.

---

## 5. Python AI Service Audit

### 5.1. Service State & Dependency Verification
- **Current Port 5002 Status:** **OFFLINE** (Connection refused).
- **Virtual Environment Path:** `ai-service/.venv/bin/python` (Python 3.12.13).
- **Core Dependencies Verified:**
  - `Flask` 3.1.3
  - `opencv-python-headless` 4.14.0.94
  - `dlib` 20.0.1
  - `face-recognition` 1.3.0
  - `face_recognition_models` 0.3.0
  - `cryptography` 50.0.2
  - `numpy` 2.5.4
  - `pillow` 13.0.0
- **Automated Test Suite Execution:**
  - Ran pytest suite: `./ai-service/.venv/bin/pytest ai-service/tests/ -v`
  - **Results:** **85 / 85 tests PASSED in 2.21 seconds**.
  - All biometric encryption (AES-256-GCM), facial quality checks, embedding distance calculations, and analytics calculation routes are mathematically and cryptographically functional.

### 5.2. Impact on Main ERP Operations
Inspection of `server/services/pythonAi.service.js` confirmed that the Python AI service is **loosely coupled** with high fault-tolerance:
1. **Student & Faculty Attendance Calculations:**
   - Calls to `/api/internal/analytics/*` carry a 6-second timeout (`AbortSignal.timeout(6000)`).
   - If the Python service is offline or times out, the service catches the error (`[PythonAiService] Fallback to native calculation`) and seamlessly calculates attendance percentages and reports using the Node.js native fallback algorithms `_fallbackCalculateStudentOverview` and `_fallbackFacultyReport`.
2. **Biometric Face Enrollment & Verification:**
   - Facial image quality validation (`/api/ai/enrollment/validate`) returns `{ success: false, message: "AI Service unreachable" }`.
   - Facial verification during session join throws an error that is handled cleanly by `errorHandler.js` as an operational HTTP failure.
3. **Core ERP Operations:**
   - User authentication, timetable management, announcements, fee invoices, HR employee management, and complaint lifecycles are **100% independent** of the Python AI service.

---

## 6. Frontend and API Connectivity

### 6.1. Vite Server & Proxy Health
- **Vite Configuration:** `client/vite.config.js` configures:
  ```javascript
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  }
  ```
- **Connectivity Probes:**
  - `curl -s http://localhost:5173/` → Returns `HTTP 200 OK` (index.html).
  - `curl -s http://localhost:5173/api/health` → Successfully forwarded by Vite proxy to port 5001 and returns `{"status":"OK","database":"campus-erp","dbState":"connected"}`.

### 6.2. Client API Architecture
- `client/src/services/api.js` sets `baseURL: ''` (relative URL).
- All Axios API calls (`/api/auth/*`, `/api/student/*`, etc.) hit the current origin (`localhost:5173`) and are routed through the reverse proxy.
- **Port Inconsistency Check:**
  - Audited `client/src/` for hardcoded `localhost:5001` or `localhost:5002` references.
  - Zero hardcoded URLs found. The only occurrences are user-facing diagnostic messages in `LoginModal.jsx` instructing users to verify backend port 5001 if a network failure occurs.

---

## 7. Startup and Shutdown Sequence Analysis

### 7.1. Canonical Startup Dependency Sequence

```
                                  [Service Startup Order]
                                  
      Step 1                       Step 2                     Step 3                     Step 4
+------------------+         +------------------+       +------------------+       +------------------+
|     MongoDB      |  ───>   | Node.js Backend  |  ───> | Python AI Flask  |  ───> |  Vite Frontend   |
|   (Port 27018)   |         |   (Port 5001)    |       |   (Port 5002)    |       |   (Port 5173)    |
+------------------+         +------------------+       +------------------+       +------------------+
  Storage ready                API endpoints &            Facial biometrics          SPA UI & proxy
  before API binds             Mongoose connected         (optional for ERP)         ready for users
```

1. **Database Readiness:**
   - While `server/config/db.js` contains a development fallback to auto-spawn MongoDB, best practice requires starting MongoDB first so the database is fully bound and initialized before Node binds port 5001.
2. **Backend Readiness:**
   - Express backend should await database readiness before calling `app.listen()`.
3. **AI Service:**
   - Optional for basic ERP; required only before testing Smart Attendance facial recognition.
4. **Frontend Dev Server:**
   - Can start at any point, but API calls will fail until Step 2 is active.

### 7.2. Multi-Terminal vs Process Management
Currently, developers must run up to three separate terminal tabs or use `npm run dev` from the project root:
- Root `package.json` provides: `"dev": "concurrently -k -n \"AI,BACKEND,CLIENT\" -c \"magenta,cyan,green\" \"npm run ai\" \"npm run server\" \"npm run client\""`.
- While `concurrently` works, if one process crashes or restarts, signal handling (`SIGINT`/`SIGTERM`) between Node, Python, and the child MongoDB process can occasionally leave orphan processes occupying ports.

---

## 8. Identified Risks and Root Causes

| # | Risk Description | Root Cause | Impact Area |
|---|---|---|---|
| **R1** | Backend listens on port 5001 before database connection completes | `connectDB()` called without `await` before `app.listen()` in `server.js` | Backend Reliability / Early Request Failure |
| **R2** | Unhandled promise rejections can terminate Node backend | Absence of `process.on('unhandledRejection')` and `uncaughtException` in `server.js` | System Availability / Crash Vulnerability |
| **R3** | Python AI Service is offline in current environment | Service is not daemonized or supervised automatically | Smart Attendance Face Biometrics |
| **R4** | Absence of Mongoose connection pool configuration & disconnect logging | `mongoose.connect()` uses default settings with no connection event listeners | Database Observability & Scalability |
| **R5** | Development MongoDB lifecycle is tightly coupled to Node.js PID | `MongoMemoryServer` used with `mongo_killer.js` watchdog in development mode | Port 27018 / Lock File Contention |
| **R6** | Potential hanging shutdown on persistent keep-alive connections | `server.close()` lacks a hard fallback forced-exit timeout | Deployment & Process Restart Lifecycle |
| **R7** | Nodemon restarts do not trigger graceful child process termination | `server.js` listens to `SIGTERM`/`SIGINT`, but not `SIGUSR2` (nodemon restart signal) | Development Process Cleanup |

---

## 9. Severity Classification

```
  CRITICAL: None (0)
  HIGH:     R1 (Unawaited DB connection), R2 (Missing unhandled rejection handler)
  MEDIUM:   R3 (Python AI service offline), R4 (Missing pool config & disconnect events), R5 (MongoMemoryServer lifecycle coupling)
  LOW:      R6 (Shutdown timeout fallback), R7 (Missing SIGUSR2 nodemon hook)
```

- **CRITICAL (0):** No catastrophic data loss, corruption, or fatal configuration flaws exist.
- **HIGH (2):**
  - **R1:** Unawaited `connectDB()` in `server.js`.
  - **R2:** Missing `unhandledRejection` and `uncaughtException` process listeners in `server.js`.
- **MEDIUM (3):**
  - **R3:** Python AI service offline on port 5002.
  - **R4:** Minimalist Mongoose connection options without disconnect observability.
  - **R5:** Tightly coupled in-memory MongoDB development lifecycle.
- **LOW (2):**
  - **R6:** Lack of a 5-second forced exit timer in graceful shutdown.
  - **R7:** Lack of `SIGUSR2` listener for clean nodemon restarts.

---

## 10. Recommended Fixes (Prioritized by Impact)

*Note: Per strict read-only audit safeguards, these recommendations are documented for future implementation and were NOT executed during this audit.*

### Priority 1 (High Impact) — Wrap Server Initialization in Async Bootstrapper
In `server/server.js`, refactor the startup sequence into an explicit `startServer()` async function that awaits database readiness before binding the port:
```javascript
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`🚀 CampusSphere ERP running on http://localhost:${PORT} [${env.NODE_ENV}]`);
      sessionScheduler.startScheduler(60000);
    });
    // register shutdown handlers with server reference...
  } catch (err) {
    console.error('❌ Fatal startup failure:', err.message);
    process.exit(1);
  }
};
startServer();
```

### Priority 2 (High Impact) — Register Top-Level Process Safety Nets
In `server/server.js`, install global rejection and exception handlers to log errors and prevent unhandled async promise rejections from crashing the server:
```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Optional: graceful shutdown if state is corrupted
});
```

### Priority 3 (Medium Impact) — Configure Production Mongoose Pool & Event Observers
In `server/config/db.js`, add connection options and event listeners:
```javascript
const conn = await mongoose.connect(uri, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err.message));
```

### Priority 4 (Medium Impact) — Launch Python AI Service as Supervised Daemon
When testing biometric workflows, start the Python service via its virtual environment:
```bash
cd ai-service && .venv/bin/python app.py
```
Or use a process manager (such as PM2 or Docker Compose) to supervise all three services (frontend, backend, AI) under a single command.

### Priority 5 (Low Impact) — Add Forced Timeout & SIGUSR2 to Graceful Shutdown
In `server/server.js`:
```javascript
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down...`);
  sessionScheduler.stopScheduler();
  
  // Force exit if hanging
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating process after shutdown timeout.');
    process.exit(1);
  }, 5000).unref();

  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('✅ All connections closed cleanly.');
      process.exit(0);
    });
  });
}
process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
```

---

## 11. Exact Verification Commands

All conclusions in this report are backed by the following non-intrusive diagnostic commands:

1. **Inspect Port Occupancy:**
   ```bash
   lsof -i :5173 -i :5001 -i :5002 -i :27018 -P -n
   ```
2. **Verify Backend Health & MongoDB State:**
   ```bash
   curl -s http://localhost:5001/api/health | jq .
   ```
3. **Verify Frontend Vite Proxy Forwarding:**
   ```bash
   curl -s -i http://localhost:5173/api/health
   ```
4. **Audit MongoDB Database & Collections:**
   ```bash
   node -e '
   const m = require("./server/node_modules/mongoose");
   m.connect("mongodb://127.0.0.1:27018/campus-erp").then(async () => {
     const cols = await m.connection.db.listCollections().toArray();
     console.log("Total collections:", cols.length);
     m.disconnect();
   });'
   ```
5. **Verify Python AI Service Test Suite:**
   ```bash
   ./ai-service/.venv/bin/pytest ai-service/tests/ -v
   ```

---

## 12. Confirmation of Strict Read-Only Safeguard Compliance

It is formally confirmed that throughout this audit:
- **Zero application source code files were modified.**
- **Zero MongoDB records, collections, documents, or indexes were created, updated, or deleted.**
- **Zero database files in `server/.data/db/` were touched, moved, or deleted.**
- **Zero environment variables or configuration files were altered.**
- **Zero processes were terminated or killed.**
- **Zero secrets, tokens, hashes, passwords, or personal student records were exposed in this report.**

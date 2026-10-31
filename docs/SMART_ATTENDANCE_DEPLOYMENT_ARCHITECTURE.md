# Smart Attendance Deployment Architecture & Operational Guide
## Project: CampusSphere AI — Smart Campus Management Platform

**Document Version:** 3.0.0  
**Phase:** Part 3 of 24 — Complete System Architecture & Technical Design  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Software Architect, DevOps & Systems Engineer  

---

## 1. Deployment Topology & Port Allocations

The platform operates across three coordinated local services and a persistent database daemon:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHYSICAL / HOST SERVER                          │
│                                                                        │
│   [Port 5173]  Vite Frontend Server (React 19 SPA)                     │
│                - Proxies /api/* requests to localhost:5001             │
│                                                                        │
│   [Port 5001]  Node.js Express Server (ERP Gateway & Business Logic)   │
│                - Connects to MongoDB on 127.0.0.1:27018                │
│                - Communicates with Python AI on 127.0.0.1:5002         │
│                                                                        │
│   [Port 5002]  Python 3.12 Flask Microservice (Biometrics & Vision)   │
│                - Bound to 127.0.0.1 (Loopback only; no public access)  │
│                - Authenticated via X-Internal-Key                      │
│                                                                        │
│   [Port 27018] MongoDB Daemon (WiredTiger Storage Engine)              │
│                - Persistent data path: server/.data/db                 │
│                - Database namespace: campus-erp                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Configuration Matrix

### 2.1 Backend Environment Variables (`server/.env`)
| Variable | Description | Default / Example Value | Confidentiality |
|---|---|---|---|
| `PORT` | Node.js Express HTTP listen port | `5001` | Public |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` | Public |
| `CLIENT_URL` | Allowed origin for CORS headers | `http://localhost:5173` | Public |
| `MONGODB_URI` | Connection URI for MongoDB database | `mongodb://127.0.0.1:27018/campus-erp` | Restricted |
| `JWT_SECRET` | Secret key for signing HS256 JWT tokens (min 32 chars) | `campussphere-super-secure-jwt-secret-key-2026` | **Confidential** |
| `JWT_EXPIRES_IN` | Lifespan of issued authentication tokens | `7d` | Public |
| `AI_SERVICE_URL` | Base URL of internal Python AI microservice | `http://127.0.0.1:5002` | Restricted |
| `INTERNAL_API_KEY`| Pre-shared secret header for inter-service communication | `campussphere-internal-secret-2026` | **Confidential** |
| `GROQ_API_KEY` | Optional API key for AI Help Desk LLM responses | `gsk_...` | **Confidential** |

### 2.2 Python AI Service Variables (`ai-service/.env`)
| Variable | Description | Default / Example Value | Confidentiality |
|---|---|---|---|
| `PORT` | Flask microservice listen port | `5002` | Public |
| `FLASK_ENV` | Flask environment mode | `development` | Public |
| `INTERNAL_API_KEY`| Must match backend `INTERNAL_API_KEY` exactly | `campussphere-internal-secret-2026` | **Confidential** |
| `BIOMETRIC_SECRET_KEY` | 256-bit Fernet encryption key for 128-d face templates | `c2VjdXJlX2Zlcm5ldF9rZXlfZm9yX2Jpb21ldHJpY3NfMjAyNg==` | **Confidential** |
| `MATCH_THRESHOLD` | Maximum Euclidean distance for verified match | `0.55` | Public |
| `REVIEW_THRESHOLD`| Maximum Euclidean distance for review status | `0.65` | Public |

---

## 3. Service Health Checks & Diagnostic Endpoints

### 3.1 Node.js Gateway Health Check
- **Endpoint:** `GET /api/health`
- **Behavior:** Queries Mongoose connection state and reports database status.
- **Sample Response:**
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "database": "campus-erp",
    "dbState": "connected",
    "env": "development",
    "timestamp": "2026-11-01T01:00:00.000Z"
  },
  "message": "CampusSphere API is healthy 🚀"
}
```

### 3.2 Python AI Service Health Check
- **Endpoint:** `GET /api/ai/health` (also aliased at `/health`)
- **Behavior:** Validates that dlib ResNet model is loaded and operative.
- **Sample Response:**
```json
{
  "status": "healthy",
  "service": "CampusSphere AI Biometric Service",
  "version": "1.0.0",
  "model": {
    "name": "dlib_face_recognition_resnet_model_v1",
    "dimensions": 128,
    "license": "Boost Software License (Free for commercial use)",
    "status": "loaded"
  }
}
```

---

## 4. Scaling & Performance Tuning

1. **CPU Optimization:**
   - Face landmark detection (dlib HOG) and embedding inference (dlib ResNet) are executed on standard CPU cores using compiled C++ binaries.
   - Typical per-request latency is **$85\text{ms}$–$115\text{ms}$** on modern CPUs (Apple M-series or Intel Xeon), capable of processing ~10 requests per second per core.
2. **Horizontal Scaling of AI Service:**
   - The Python AI service is completely **stateless**. It holds no persistent sessions and no local database.
   - For high-density campus rollouts (e.g. 5,000 students marking attendance within a 10-minute window across 100 lecture halls), Python workers can be scaled horizontally behind a round-robin reverse proxy (Nginx or HAProxy) without shared state.
3. **Database Indexing:**
   - The primary bottleneck in high-throughput attendance marking is race-condition deduplication.
   - The composite index `{ subject: 1, student: 1, date: 1, period: 1 }` enables $O(1)$ B-tree lookups, preventing collection scans and keeping write latency under $5\text{ms}$.

---

## 5. Backup, Disaster Recovery & Data Retention

1. **Database Snapshot Backups:**
   - Automated nightly `mongodump` snapshots of the `campus-erp` database targeting offsite encrypted object storage.
   - The `server/.data/db` WiredTiger storage engine maintains continuous write-ahead journaling (`journal/WiredTigerLog.*`), ensuring zero data loss across unexpected power outages or system restarts.
2. **Audit Trail Immutability:**
   - `AttendanceAuditLog` collection maintains an automated 365-day Time-To-Live (TTL) index:
     ```javascript
     createdAt: { type: Date, default: Date.now, expires: 31536000 }
     ```
   - Historical audit records older than 1 academic year are automatically purged, fulfilling data minimization requirements while maintaining annual audit compliance.


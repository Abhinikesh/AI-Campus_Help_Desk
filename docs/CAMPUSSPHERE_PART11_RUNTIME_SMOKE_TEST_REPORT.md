# CampusSphere AI — Part 11 Runtime Smoke Test Report

**Execution Timestamp:** 2026-11-01T14:44:19+05:30  
**Environment:** macOS (Darwin arm64), Node.js v25.9.0, Python 3.12.13, Vite 8.0.5, MongoDB 8.0.3

---

## 1. Runtime Services & Process Status

All four local runtime services were verified active and responsive:

| Service | Target Port | Process / Task ID | Health Status | Verification Method |
|---|---|---|---|---|
| **MongoDB Database Engine** | `27018` | PID 30687 (WiredTiger) | **Active / Connected** | Verified via Node.js Mongoose connection |
| **Node.js ERP Backend** | `5001` | Task `task-3818` | **HTTP 200 OK** | `GET http://localhost:5001/api/health` |
| **Python AI Microservice** | `5002` | Task `task-1906` | **HTTP 200 Healthy** | `GET http://localhost:5002/health` |
| **Vite Frontend Dev Server** | `5173` | Task `task-1910` | **HTTP 200 OK** | `GET http://localhost:5173/` |

---

## 2. Health Endpoint Results

### Node.js ERP Backend
- **Endpoint:** `GET http://localhost:5001/api/health`
- **HTTP Status:** `200 OK`
- **Response Payload:**
  ```json
  {
    "success": true,
    "data": {
      "status": "OK",
      "database": "test",
      "dbState": "connected",
      "env": "development",
      "timestamp": "2026-11-01T09:14:19.035Z"
    },
    "message": "CampusSphere API is healthy 🚀"
  }
  ```

### Python AI Biometric Microservice
- **Endpoint:** `GET http://localhost:5002/health`
- **HTTP Status:** `200 OK`
- **Response Payload:**
  ```json
  {
    "model": {
      "dimensions": 128,
      "license": "Creative Commons Zero (CC0) / Boost Software License",
      "name": "dlib_face_recognition_resnet_model_v1",
      "status": "loaded"
    },
    "service": "campussphere-ai-service",
    "status": "healthy",
    "version": "2.0.0"
  }
  ```

### Vite Frontend Server
- **Endpoint:** `GET http://localhost:5173/`
- **HTTP Status:** `200 OK`
- **Content Type:** `text/html; charset=utf-8`

---

## 3. End-to-End Authentication Smoke Tests

Authentication was tested across all three primary ERP roles against live MongoDB credentials:

| Test Case | Method & Endpoint | Payload | HTTP Status | Auth Token Received | Role Verified |
|---|---|---|---|---|---|
| **Admin Login** | `POST /api/auth/login` | `{"loginId": "ADMIN001", "password": "Admin@123", "role": "admin"}` | **200 OK** | Yes (`JWT_SECRET`) | `admin` (`Campus Admin`) |
| **Faculty Login** | `POST /api/auth/login` | `{"loginId": "FAC001", "password": "Faculty@123", "role": "faculty"}` | **200 OK** | Yes (`JWT_SECRET`) | `faculty` (`Dr. Priya Mehta`) |
| **Student Login** | `POST /api/auth/login` | `{"loginId": "20240001", "password": "Student@123", "role": "student"}` | **200 OK** | Yes (`JWT_SECRET`) | `student` (`Arjun Sharma`) |

---

## 4. Protected API Smoke Tests

Using the generated JWT bearer tokens, representative protected APIs for each portal were invoked:

### Student Attendance Overview API
- **Endpoint:** `GET http://localhost:5001/api/attendance/student/overview`
- **Headers:** `Authorization: Bearer <Student_Token>`
- **HTTP Status:** `200 OK`
- **Summary Payload Extracted:**
  ```json
  {
    "totalClasses": 2,
    "overall": 0,
    "status": "Critical",
    "meetsRequirement": false
  }
  ```
- **Result:** Successfully validated student profile scoping and authoritative calculation response.

### Faculty Attendance Overview API
- **Endpoint:** `GET http://localhost:5001/api/attendance/faculty/overview`
- **Headers:** `Authorization: Bearer <Faculty_Token>`
- **HTTP Status:** `200 OK`
- **Result:** Returned faculty teaching assignment roster, total conducted sessions, and active session states.

### Admin Attendance Overview API
- **Endpoint:** `GET http://localhost:5001/api/attendance/admin/overview`
- **Headers:** `Authorization: Bearer <Admin_Token>`
- **HTTP Status:** `200 OK`
- **Metrics Extracted:**
  - `totalStudents`: 10
  - `overallAttendancePercentage`: 0
- **Result:** Correctly aggregated institutional metrics across departments.

---

## 5. Smoke Test Conclusion

All 9 smoke test vectors passed with exit code 0 and HTTP status 200. Zero network timeouts, socket disconnects, unhandled exceptions, or database disconnects occurred.


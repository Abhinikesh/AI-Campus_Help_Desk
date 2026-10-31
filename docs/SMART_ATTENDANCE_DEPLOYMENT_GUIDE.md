# CampusSphere AI — Smart Attendance Production Deployment Guide

**Document Version:** 1.0.0  
**Date:** October 31, 2026  
**Target Environments:** Staging / Production  
**Stack:** React 18 (Vite) + Node.js 20+ Express + MongoDB 6.0+ + Python 3.12 (Flask / dlib / OpenCV)  

---

## 1. Prerequisites

### 1.1 Hardware Requirements
- **CPU:** 4 vCPUs minimum (8 vCPUs recommended for concurrent dlib face embedding generation).
- **RAM:** 8 GB RAM minimum (16 GB recommended for high concurrent class verification).
- **Storage:** 50 GB SSD for database, logs, and application assets.
- **Network:** HTTPS mandatory; WebSocket/HTTP long-polling enabled.

### 1.2 System Software & Libraries
- **Node.js:** v20.x or v22.x LTS
- **Python:** v3.11.x or v3.12.x
- **Build Tools:** CMake, C/C++ compiler (clang or gcc), pkg-config (required for dlib compilation)
- **MongoDB:** v6.0+ or v7.0+ (MongoDB Atlas or standalone replica set with WiredTiger engine)
- **Process Manager:** PM2 or systemd
- **Reverse Proxy:** Nginx with SSL/TLS (Certbot / Let's Encrypt)

---

## 2. Environment Variables Specification

### 2.1 Backend (`server/.env`)
Create `/path/to/server/.env` based on the template below:

```bash
# ── Server Runtime ─────────────────────────────────────────────
PORT=5001
NODE_ENV=production

# ── MongoDB Connection ─────────────────────────────────────────
# In production, you MUST provide a real MongoDB Atlas or replica set URI
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/campussphere?retryWrites=true&w=majority

# ── JWT Authentication ─────────────────────────────────────────
# Minimum 32-character high-entropy secret
JWT_SECRET=production_strong_secret_min_32_characters_random_hex_string
JWT_EXPIRES_IN=7d

# ── Client Application ─────────────────────────────────────────
# Exact production frontend origin for CORS and cookies
CLIENT_URL=https://erp.campusphere.edu

# ── Inter-Service Bridge & Python AI ───────────────────────────
AI_SERVICE_URL=http://127.0.0.1:5002
INTERNAL_API_KEY=strong_random_shared_secret_between_node_and_python

# ── AI Help Desk Integration (Optional) ────────────────────────
GROQ_API_KEY=gsk_your_groq_production_key_here
```

### 2.2 Python AI Service (`ai-service/.env`)
Create `/path/to/ai-service/.env`:

```bash
# ── Flask Service ──────────────────────────────────────────────
PORT=5002
FLASK_ENV=production
SERVICE_NAME=campussphere-ai-service
VERSION=2.0.0

# ── Inter-Service Authentication ───────────────────────────────
# MUST match INTERNAL_API_KEY in server/.env
INTERNAL_API_KEY=strong_random_shared_secret_between_node_and_python

# ── Biometric Cryptography ─────────────────────────────────────
# 32-byte AES-256 encryption key material for templates at rest
BIOMETRIC_SECRET_KEY=production_32_byte_aes_gcm_secret_key_material!

# ── Flask Session Secret ───────────────────────────────────────
SECRET_KEY=production_flask_session_secret_key_here

# ── Recognition & Calibration Thresholds ───────────────────────
# Euclidean distance on 128-d unit sphere (dlib ResNet)
MATCH_THRESHOLD=0.55
REVIEW_THRESHOLD=0.65
```

---

## 3. Installation & Setup

### 3.1 Node.js Backend Setup
```bash
cd /path/to/server
npm ci --omit=dev
```

### 3.2 Python AI Service Setup
```bash
cd /path/to/ai-service

# Create isolated Python virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Upgrade packaging tools
pip install --upgrade pip setuptools wheel

# Install production dependencies
pip install -r requirements.txt

# Verify model and dependencies
python -c "import dlib, cv2, face_recognition, flask, cryptography; print('Dependencies OK')"
```

### 3.3 Frontend Production Build
```bash
cd /path/to/client
npm ci
npm run build
# Production assets will be emitted to client/dist
```

---

## 4. Service Startup & Process Management

We recommend using **PM2** to manage both the Node.js server and Python Flask service.

### 4.1 PM2 Ecosystem Configuration (`ecosystem.config.js`)
Create `ecosystem.config.js` in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'campussphere-backend',
      script: 'server.js',
      cwd: './server',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      max_memory_restart: '1G'
    },
    {
      name: 'campussphere-ai-service',
      script: '.venv/bin/gunicorn',
      args: '-w 4 -b 127.0.0.1:5002 app:create_app()',
      cwd: './ai-service',
      instances: 1,
      env: {
        FLASK_ENV: 'production'
      },
      error_file: './logs/ai-service-error.log',
      out_file: './logs/ai-service-out.log',
      max_memory_restart: '2G'
    }
  ]
};
```

### 4.2 Start Services
```bash
# Create log directory
mkdir -p logs

# Start all services
pm2 start ecosystem.config.js

# Save process list for system reboot
pm2 save
pm2 startup
```

---

## 5. Nginx & HTTPS Configuration

Configure Nginx as the TLS terminating reverse proxy:

```nginx
# /etc/nginx/sites-available/campussphere
server {
    listen 80;
    server_name erp.campussphere.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.campussphere.edu;

    ssl_certificate /etc/letsencrypt/live/erp.campussphere.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.campussphere.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Maximum payload size for biometric frame uploads
    client_max_body_size 10M;

    # Frontend Single Page Application
    root /path/to/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Node.js API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Deny direct public access to internal Python AI service port 5002
    location /api/internal/ {
        deny all;
        return 403;
    }
}
```

---

## 6. Health Checks & Monitoring

### 6.1 Node.js Health Endpoint
```bash
curl -i https://erp.campussphere.edu/api/health
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "database": "campussphere",
    "dbState": "connected",
    "env": "production"
  },
  "message": "CampusSphere API is healthy 🚀"
}
```

### 6.2 Python AI Health Endpoint (Internal Only)
```bash
curl -i -H "X-Internal-Key: <INTERNAL_API_KEY>" http://127.0.0.1:5002/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "service": "campussphere-ai-service",
  "version": "2.0.0",
  "model": "dlib_face_recognition_resnet_model_v1"
}
```

---

## 7. Database Backup & Disaster Recovery

### 7.1 Daily Automated Backup
Add to `crontab -e`:
```bash
0 2 * * * mongodump --uri="mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/campussphere" --archive="/backups/mongo/campussphere-$(date +\%Y\%m\%d).gzip" --gzip
```

### 7.2 Restoration Procedure
```bash
mongorestore --uri="mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/campussphere" --archive="/backups/mongo/campussphere-20261031.gzip" --gzip --drop
```

---

## 8. Rollback Procedure

If a deployment fails:
1. **Frontend Rollback:** Revert `client/dist` to previous release directory:
   ```bash
   ln -sfn /path/to/releases/client-previous /path/to/client/dist
   ```
2. **Backend Rollback:**
   ```bash
   cd /path/to/server
   git checkout <previous_stable_commit>
   npm ci --omit=dev
   pm2 restart campussphere-backend
   ```
3. **Python AI Service Rollback:**
   ```bash
   cd /path/to/ai-service
   git checkout <previous_stable_commit>
   pm2 restart campussphere-ai-service
   ```
4. **Validation:** Re-run health checks on `/api/health` and verify client dashboard.


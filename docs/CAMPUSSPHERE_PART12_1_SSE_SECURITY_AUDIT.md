# CampusSphere AI — Part 12.1 SSE Security Audit & Hardening

## 1. Executive Summary & Problem Identification

During the initial Part 12 implementation, Server-Sent Events (SSE) supported authentication via `?token=<jwt>` query parameters as a workaround for browser `EventSource` header limitations. 

### Vulnerabilities Identified in Initial Design:
1. **Credential Exposure in URLs**: Query string tokens are logged in web server access logs, reverse proxy logs, browser navigation history, and transmitted in HTTP `Referer` headers to third-party assets.
2. **Missing Origin Validation**: Unchecked cross-site connections could allow malicious websites to initiate SSE streams on behalf of authenticated users (Cross-Site SSE Hijacking).
3. **No Heartbeat Keep-Alive**: NAT gateways and stateful firewalls aggressively drop idle HTTP streams, causing premature connection drops and reconnection storms.
4. **Token Expiry Ignored During Long-Lived Streams**: Once connected, an SSE stream could remain open indefinitely even after the user's JWT had expired.

---

## 2. Hardened Architecture (Dual Approach A + B)

To address all browser and security constraints, CampusSphere AI now implements a secure dual-authentication architecture:

```
[Browser / Client]
       |
       |-- (Approach B: Fetch-based Streaming) -> Authorization: Bearer <token>
       |-- (Approach A: Cookie-based EventSource) -> HttpOnly campus_token cookie
       |
       v
[GET /api/notifications/stream]
       |
       +--> Check 1: Does req.query.token exist? -> REJECT HTTP 400 (Security Violation)
       +--> Check 2: Does Origin exist? -> Validate against allowed origins (anti-CSRF)
       +--> Check 3: Extract Bearer token from header OR HttpOnly cookie
       +--> Check 4: jwt.verify(token, JWT_SECRET) with exp check -> If invalid, REJECT HTTP 401
       +--> Check 5: Register stream with active heartbeat (: ping\n\n) every 25s
       +--> Check 6: Schedule token expiry disconnect timer (msUntilExpiry)
       +--> Check 7: Clean up timers & stream sets on req.on('close')
```

---

## 3. Implementation Details

### 3.1 Controller Security Invariant (`server/controllers/notification.controller.js`)

```javascript
// Query parameter prohibition
if (req.query?.token) {
  return res.status(400).json({
    success: false,
    error: 'Passing authentication tokens in URL query parameters is prohibited for security. Use Authorization header or HttpOnly cookie.',
  });
}

// Origin verification (anti-CSRF)
const origin = req.headers.origin;
if (origin) {
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5001',
    'http://127.0.0.1:5001',
  ];
  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ success: false, error: 'Origin not allowed for notification stream' });
  }
}
```

### 3.2 Connection Lifecycle & Memory Management (`server/services/notification.service.js`)

- **Heartbeat (Ping)**: Sends `: ping\n\n` comments every 25,000 ms to preserve NAT traversal.
- **Active Expiration Timer**: Computes remaining JWT validity (`msUntilExpiry = exp * 1000 - Date.now()`). If expired during a live connection, emits `event: auth_expired` and closes the stream with `res.end()`.
- **Teardown Cleanup**: Listens to `req.on('close')` and `res.on('error')`, clears intervals, removes references from the `activeStreams` Map, and deletes user keys when no active tabs remain.

### 3.3 Client Fetch-based Streaming (`client/src/context/NotificationContext.jsx`)

Replaced URL-based `new EventSource(url?token=...)` with an authenticated `fetch` streaming reader:
- Uses `fetch('/api/notifications/stream', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })`.
- Chunks are decoded using `TextDecoder` and parsed line-by-line (`event:`, `data:`).
- Supports cancellation via `AbortController` and auto-reconnects with exponential backoff on disconnect.

---

## 4. Verification Evidence

- `tests/notification_stabilization_part12_1.test.js`:
  - `B1`: Prohibits long-lived JWTs in query params -> Returns HTTP 400 (**PASS**).
  - `B2`: Rejects unauthenticated requests -> Returns HTTP 401 (**PASS**).
  - `B3`: Accepts valid Bearer token header and writes handshake + ping (**PASS**).
  - `B4`: Accepts HttpOnly cookie authentication and verifies origin (**PASS**).
  - `B5`: Blocks untrusted origin header -> Returns HTTP 403 (**PASS**).
- Live API smoke test:
  - `GET /api/notifications/stream?token=...` returned HTTP 400.
  - `GET /api/notifications/stream` without auth returned HTTP 401.


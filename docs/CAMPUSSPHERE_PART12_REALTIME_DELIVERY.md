# CampusSphere AI — Part 12 Real-Time Delivery Architecture

## 1. Design Philosophy: Native Server-Sent Events vs Heavy WebSockets

For CampusSphere AI's notification engine, we selected **HTTP Server-Sent Events (SSE)** rather than heavier bidirectional WebSocket protocols (like `socket.io`):

1. **Unidirectional Push**: Institutional notifications are server-to-client push events. The client sends mutations (`markAsRead`, `preferences`) via standard RESTful HTTP requests, eliminating the need for bidirectional framing.
2. **Zero External Dependencies**: Implemented using standard Node.js Express streams (`res.writeHead`, `res.write`) and native browser `EventSource`, preventing large npm dependencies, memory overhead, and version conflicts.
3. **HTTP/2 and Proxy Native**: Operates over standard HTTP ports (80/443/5001), passing transparently through corporate firewalls, reverse proxies (Nginx), and load balancers without requiring WebSocket upgrade handshakes.
4. **Built-in Auto-Reconnect**: Browser `EventSource` automatically re-establishes dropped connections with native backoff.

---

## 2. Server-Side Connection Stream Registry

The `NotificationService` maintains an in-memory client connection registry:

```javascript
// Map<userIdString, Set<http.ServerResponse>>
this.activeStreams = new Map();
```

### Connection Lifecycle:
1. **Handshake (`GET /api/notifications/stream`)**:
   - Validates JWT from header or `?token=` parameter.
   - Sets headers:
     ```http
     Content-Type: text/event-stream
     Cache-Control: no-cache, no-transform
     Connection: keep-alive
     X-Accel-Buffering: no
     ```
   - Adds the response stream to `this.activeStreams.get(userId)`.
   - Sends initial handshake payload: `event: connected`.
2. **Heartbeat / Keep-Alive**:
   - An interval sends a periodic `: ping\n\n` comment or keep-alive event every 25 seconds to prevent intermediate router or proxy socket timeouts.
3. **Connection Termination**:
   - Listens to `req.on('close')`.
   - Upon client disconnect or navigation away, removes the specific response object from the user's connection set.
   - Cleans up empty keys from the map to guarantee zero memory leakage.

---

## 3. Real-Time Dispatch Pipeline

When an ERP event generates notifications (e.g. `notificationService.createNotification` or `createBulkNotifications`):

```
ERP Event (e.g. Session Finalized)
           |
           v
MongoDB Write (Notification.insertMany)
           |
           v
Find Active SSE Streams for User
           |
   +-------+-------+
   |               |
[Connected]   [Disconnected]
   |               |
res.write(...)   Stored in MongoDB
   |               |
Browser Badge    Fetched on next login
Updates Live     or 30s polling cycle
```

### Event Payload Format
SSE messages use standard event framing:

```http
event: notification
data: {"_id":"673f8a...","title":"Attendance Alert","message":"Marked absent...","category":"attendance","unreadCount":4}

```

---

## 4. Frontend Resilience & Dual-Mode Fallback

The client (`NotificationContext.jsx`) implements a resilient dual-mode delivery pattern:

1. **Primary Mode (SSE)**: Connects to `/api/notifications/stream?token=<jwt>`. Listens to `notification`, `unreadCount`, and `connected` events to mutate local state immediately without network delay.
2. **Fallback Mode (Polling)**: A 30-second background polling cycle (`fetchUnreadCount`) operates silently in the background:
   - Synchronizes unread badges across browser tabs.
   - Recovers state seamlessly if SSE is blocked by an aggressive client proxy or transient network interruption.
   - Resets and refetches notifications when the window regains focus (`window.addEventListener('focus')`).


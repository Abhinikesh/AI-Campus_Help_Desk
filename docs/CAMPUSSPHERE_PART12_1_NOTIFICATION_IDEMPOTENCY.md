# CampusSphere AI — Part 12.1 Notification Idempotency Architecture

## 1. Problem Statement

In distributed ERP environments, notification dispatchers face concurrency hazards:
1. **Network Retries**: A client or webhook retries a transaction that already committed in MongoDB.
2. **Bulk Multi-Recipient Conflicts**: A broadcast announcement sends the same event to 500 students. A single-field unique index on `eventId` would crash on the second recipient.
3. **Null Collisions on Compound Indexes**: A standard compound unique index on `{ recipient: 1, eventId: 1 }` treats `null` as a duplicate key, preventing users from receiving more than one event-less notification.

---

## 2. Technical Solution: MongoDB Partial Unique Index

The solution combines a **MongoDB Partial Unique Index** with concurrency-safe controller error handling:

```javascript
notificationSchema.index(
  { recipient: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } }
);
```

### Why Partial Filter Expressions?
- Documents with `eventId: null` or undefined are **completely excluded** from the index. A user can receive unlimited general notifications without index collisions.
- Documents with a string `eventId` are indexed with the compound key `(recipient, eventId)`.

### Properties Guaranteed:
| Scenario | Behavior |
| :--- | :--- |
| **Same event, same recipient (Retry)** | Rejected by unique index (`E11000`). Trapped gracefully and returns `{ isDuplicate: true }`. |
| **Same event, different recipients (Broadcast)** | `recipient` differs across documents; all recipients are inserted successfully. |
| **5 concurrent workers sending same event to user** | Exactly 1 succeeds at the storage layer; 4 workers catch `11000` and return `{ isDuplicate: true }`. |
| **Bulk dispatch retry** | `insertMany(..., { ordered: false })` inserts remaining new rows and skips existing duplicates without throwing. |

---

## 3. Concurrency Protection in `notification.service.js`

### Single Notification Creation (`createNotification`):
```javascript
let notification;
try {
  notification = await Notification.create({ ... });
} catch (err) {
  if (err.code === 11000 && cleanEventId) {
    // Concurrency safeguard: Another worker created it simultaneously
    const existing = await Notification.findOne({ recipient, eventId: cleanEventId });
    return { isDuplicate: true, notification: existing };
  }
  throw err; // Re-throw unexpected DB errors (never swallow)
}
```

### Bulk Dispatch (`createBulkNotifications`):
```javascript
try {
  insertedDocs = await Notification.insertMany(docs, { ordered: false });
} catch (bulkErr) {
  if (bulkErr.code === 11000 || (bulkErr.writeErrors && bulkErr.writeErrors.some((e) => e.code === 11000))) {
    insertedDocs = bulkErr.insertedDocs || [];
  } else {
    throw bulkErr; // Re-throw unexpected errors
  }
}
```

---

## 4. Verification Evidence

- `C1`: Same event, same recipient repeated request returns `isDuplicate: true` (**PASS**).
- `C2`: Same event, different recipients both receive notification (**PASS**).
- `C3`: 5 simultaneous concurrent insertion workers -> exactly 1 row inserted, 4 duplicates caught (**PASS**).
- `C4`: Bulk dispatch retry -> 0 duplicate rows inserted on retry (**PASS**).


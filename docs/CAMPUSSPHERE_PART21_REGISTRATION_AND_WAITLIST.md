# CampusSphere AI — Part 21: Event Registration & Waitlist Concurrency

## 1. Concurrency-Safe Seat Claims

During high-demand campus events, multiple students may attempt to claim the final available seat concurrently. To eliminate race conditions without database locks, CampusSphere AI uses MongoDB atomic conditional operations:

```javascript
const seatAllocated = await CampusEvent.findOneAndUpdate(
  {
    _id: eventId,
    $expr: { $lt: ['$allocatedParticipantsCount', '$maxParticipants'] },
  },
  {
    $inc: { allocatedParticipantsCount: 1 },
  },
  { new: true }
);
```

- If `seatAllocated` is returned: The seat was successfully claimed and confirmed.
- If `null`: Event capacity is full.

---

## 2. Deterministic Waitlisting

If event capacity is full and `isWaitlistEnabled === true`:
1. The system atomically increments `waitlistCount` if below `waitlistCapacity`.
2. The registration is tagged `status: 'waitlisted'` with `waitlistNumber: event.waitlistCount`.
3. If both event capacity and waitlist capacity are full, registration requests are rejected with `HTTP 409 Conflict`.

---

## 3. Automatic Waitlist Promotion Upon Cancellation

When a confirmed participant cancels their registration (`PATCH /api/events/:id/registrations/:registrationId/cancel`):
1. The participant's record is marked `status: 'cancelled'`.
2. The event's `allocatedParticipantsCount` is decremented.
3. `eventService.promoteNextWaitlistedParticipant(eventId)` queries the lowest `waitlistNumber` in the waitlist queue:
   - Sets registration status to `confirmed`.
   - Clears `waitlistNumber`.
   - Records `promotedFromWaitlistAt: new Date()`.
   - Increments `allocatedParticipantsCount` and decrements `waitlistCount`.
   - Dispatches an instant high-priority notification to the promoted student.


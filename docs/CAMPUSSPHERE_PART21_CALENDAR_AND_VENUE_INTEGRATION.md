# CampusSphere AI — Part 21: Academic Calendar & Venue Integration

## 1. Academic Calendar Integration

- Reuses `AcademicCalendarEvent.js` from Part 15.
- Extended `linkedEntityType` enum to support `'CampusEvent'`.
- When an event is approved or published, `eventService.syncEventWithCalendar(event, userId)` creates or updates a calendar milestone with:
  - `eventType: 'college_event'`
  - `title: event.title`
  - `startDate: event.startDate`
  - `endDate: event.endDate`
  - `venue: event.venueName || event.location`
  - `audience: event.targetAudience === 'department' ? 'department' : 'all'`
  - `linkedEntityType: 'CampusEvent'`
  - `linkedEntityId: event._id`
- If an event is cancelled, the corresponding calendar milestone status transitions to `cancelled`.

---

## 2. Venue Management & Conflict Prevention

- Physical campus facilities (auditoriums, seminar halls, computer labs, open air theatres) are registered in `EventVenue.js`.
- Bookings are scheduled in `EventVenueBooking.js` with:
  - `bookingDate`, `startTime`, `endTime`, `startDateTime`, `endDateTime`.
- Overlap detection checks for conflicting bookings:
  $$\text{startDateTime} < \text{newEnd} \quad \land \quad \text{endDateTime} > \text{newStart}$$
- Overlapping bookings for the same active venue are blocked with `HTTP 409 Conflict`.

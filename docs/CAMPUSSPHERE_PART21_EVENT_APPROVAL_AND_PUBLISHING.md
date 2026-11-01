# CampusSphere AI — Part 21: Event Approval & Publishing Workflow

## 1. Event Proposal & Approval Lifecycle

The event approval workflow prevents unauthorized or overlapping events from being published to the student body without faculty and institutional governance:

$$\text{Draft} \xrightarrow{\text{Submit}} \text{Pending Approval} \xrightarrow{\text{Faculty/Admin Review}} \text{Approved} \xrightarrow{\text{Publish}} \text{Published / Reg Open}$$

---

## 2. Configurable Approval Stages

1. **Faculty Review Stage (`faculty_coordinator`):**
   - Verification of event curriculum, invited resource persons, and academic relevance.
   - Initial review conducted by the assigned faculty coordinator.
2. **Institutional Administrative Approval (`dean_admin`):**
   - Budget, venue safety, campus security, and institutional calendar alignment.
   - Admin or Dean of Student Affairs signs off on the event proposal.
3. **Audit Trail:**
   - Every approval or rejection is recorded in `EventApproval.js`.
   - Rejections strictly require a rationale of at least 5 characters. When rejected, the event returns to `draft` status with rejection notes preserved for organizer correction.

---

## 3. Publication & Calendar Synchronization

- When an authorized admin or faculty coordinator publishes an event (`POST /api/events/:id/publish`), `eventService.syncEventWithCalendar(event, userId)` executes.
- An `AcademicCalendarEvent` is automatically created or updated with `linkedEntityType: 'CampusEvent'` and `linkedEntityId: event._id`.
- If an event is subsequently cancelled, `POST /api/events/:id/cancel` sets the status to `cancelled`, releases all booked venues, updates the calendar event to `cancelled`, and sends high-priority notifications to registered students.

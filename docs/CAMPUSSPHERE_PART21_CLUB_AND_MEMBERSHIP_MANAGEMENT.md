# CampusSphere AI — Part 21: Student Club & Membership Management

## 1. Overview

The Student Club Subsystem enables extracurricular technical societies, robotics chapters, cultural groups, and community clubs to organize activities and manage their membership.

---

## 2. Club Onboarding & Governance

- **Creation:** Authorized admins, faculty advisors, or assigned club coordinators create clubs with unique identification codes (e.g. `ROBO-01`, `ACM-01`).
- **Leadership Hierarchy:**
  - Faculty Advisor (`ref: Faculty`)
  - Student President (`ref: Student`)
  - Student Coordinator (`ref: Student`)
  - Active Members (`activeMembersCount` / `membershipCapacity`)

---

## 3. Membership Application Workflow

1. **Student Application:**
   - Enrolled students browse the active club directory (`GET /api/clubs?isActive=true`).
   - Submit an application (`POST /api/clubs/:id/membership`) with a statement of purpose.
   - If the club's active member count has reached `membershipCapacity`, the application is placed on `waitlisted`.
   - Re-applying when an active or pending membership already exists is rejected with `HTTP 409 Conflict`.
2. **Coordinator/Advisor Review:**
   - Authorized club coordinators or advisors evaluate applications (`PATCH /api/clubs/:clubId/membership/:membershipId`).
   - Approving an application sets `status: 'approved'` and atomically increments `StudentClub.activeMembersCount`.
   - Rejecting an application requires a mandatory justification.
3. **Withdrawal / Leaving:**
   - Students can withdraw pending or approved memberships.
   - Withdrawing an approved membership atomically decrements `activeMembersCount`.

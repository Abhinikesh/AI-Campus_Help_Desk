# Smart Attendance Academic Unit & Multi-Period Model

**System Name:** CampusSphere AI Smart Attendance Module  
**Scope:** Specification of Academic Units, Laboratory Blocks, and Session Weights  
**Reference Document:** Part 8/24 — Academic Calculations  

---

## 1. The Academic Unit Problem

In collegiate academic scheduling, not all class meetings are equal:
- Standard Theory Lecture: 1 period (typically 50–60 minutes).
- Laboratory Practicum: 2 or 3 consecutive periods (typically 100–180 minutes).
- Combined Workshop / Seminar: 2 to 4 consecutive periods.

Under naive attendance systems, every database session record counts as $1$ "class". This produces severe distortions:
1. Missing a 3-period lab was counted as missing 1 class, artificially inflating attendance percentages.
2. Attending a 2-period lab conferred only 1 attendance mark, short-changing students who attended 120 minutes of instruction.
3. Semester course totals became disconnected from university credit regulations.

---

## 2. The Academic Unit Solution

CampusSphere AI defines an **Academic Unit** as one discrete timetable period.

```
                    Academic Session
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
Single-Period Lecture              Multi-Period Laboratory
   (periodCount: 1)                   (periodCount: 2+)
   • 1 Held Unit                      • N Held Units
   • 1 Attended Unit (if Present)     • N Attended Units (if Present)
   • 1 Missed Unit (if Absent)        • N Missed Units (if Absent)
```

### Schema Attributes Supporting Units

Both `AttendanceSession` and `Attendance` store:
- `period`: Integer starting period (e.g. `3`).
- `periods`: Array of covered period numbers (e.g. `[3, 4]`).
- `periodCount`: Total integer count of periods represented (`periods.length`).

```javascript
// Synchronizing Hook in Attendance.js
if (this.periods && Array.isArray(this.periods) && this.periods.length > 0) {
  this.periodCount = this.periods.length;
  this.period = this.periods[0];
} else if (this.periodCount && this.periodCount > 1) {
  const base = this.period || 1;
  this.periods = Array.from({ length: this.periodCount }, (_, i) => base + i);
} else if (this.period) {
  this.periods = [this.period];
  this.periodCount = 1;
}
```

---

## 3. Concrete Example Scenarios

### Scenario A: Pure Theory Course (4 Lectures/week)
- Week 1–5: 20 lectures conducted.
- Student attended 18, missed 2.
- $\text{Held Units} = 20 \times 1 = 20$.
- $\text{Attended Units} = 18 \times 1 = 18$.
- $\text{Percentage} = \frac{18}{20} \times 100 = 90.0\%$ (`Good`).

### Scenario B: Laboratory Course (One 2-period Lab/week)
- Week 1–5: 5 lab sessions conducted.
- Student attended 4 sessions, missed 1 session.
- $\text{Held Units} = 5 \times 2 = 10$.
- $\text{Attended Units} = 4 \times 2 = 8$.
- $\text{Missed Units} = 1 \times 2 = 2$.
- $\text{Percentage} = \frac{8}{10} \times 100 = 80.0\%$ (`Good`).

### Scenario C: Combined Integrated Course (3 Lectures + One 2-Period Lab)
- Total sessions held in term: 10 Lectures + 5 Labs.
- $\text{Held Units} = (10 \times 1) + (5 \times 2) = 20\text{ Units}$.
- Student attendance:
  - Attended all 10 lectures ($10\text{ units}$).
  - Attended 3 labs ($3 \times 2 = 6\text{ units}$), missed 2 labs ($2 \times 2 = 4\text{ units}$).
- $\text{Total Attended Units} = 10 + 6 = 16\text{ Units}$.
- $\text{Percentage} = \frac{16}{20} \times 100 = 80.0\%$.

Under the old naive counting:
- Total sessions = $10 + 5 = 15$.
- Attended sessions = $10 + 3 = 13$.
- Naive Percentage = $\frac{13}{15} \times 100 = 86.7\%$.
- The old formula obscured the severe loss of 4 full lab periods. The unit model enforces exact institutional credit parity.


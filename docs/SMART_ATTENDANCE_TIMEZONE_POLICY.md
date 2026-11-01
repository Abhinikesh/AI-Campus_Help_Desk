# Smart Attendance Timezone & Academic Date Policy

**System Name:** CampusSphere AI Smart Attendance Module  
**Standard Timezone:** Indian Standard Time (`Asia/Kolkata`, UTC+5:30)  
**Standard Date Format:** `YYYY-MM-DD` (ISO 8601 Calendar Date)  
**Part:** Part 8/24  

---

## 1. Context and Problem Statement

Colleges operating in India operate on Indian Standard Time (`Asia/Kolkata`, UTC+5:30). Servers, container runtimes, or databases frequently default to Universal Coordinated Time (UTC).

This creates severe cross-midnight boundary discrepancies:
- A class scheduled on October 16 at 09:00 AM IST (03:30 AM UTC) is on the same calendar day.
- However, an evening laboratory scheduled at 06:30 PM IST on October 15 is 01:00 PM UTC on October 15.
- Conversely, a late-evening batch scheduled or modified at 11:30 PM IST on October 15 is 06:00 PM UTC on October 15, while early morning operations (e.g. 02:00 AM IST on October 16) evaluate to 08:30 PM UTC on October 15!
- If queries use `new Date().toISOString().split('T')[0]`, any query executed between 12:00 AM IST and 05:30 AM IST queries the **previous day's** schedule!

---

## 2. Canonical Timezone Policy

1. **One Authoritative Calendar Timezone:**
   All academic calendar dates (`session.date`, `attendance.date`, `timetable.date`) must be formatted and compared against Indian Standard Time (`Asia/Kolkata`).

2. **Standard Service Method:**
   All services and controllers must use `attendanceCalculationService.getIndianAcademicDate()` instead of raw UTC date splits.

   ```javascript
   getIndianAcademicDate(date = new Date()) {
     const formatter = new Intl.DateTimeFormat('en-CA', {
       timeZone: 'Asia/Kolkata',
       year: 'numeric',
       month: '2-digit',
       day: '2-digit',
     });
     return formatter.format(date); // Strictly returns 'YYYY-MM-DD' in Asia/Kolkata
   }
   ```

3. **Storage Format:**
   - In MongoDB, all date keys for attendance sessions and daily records are stored as `YYYY-MM-DD` string literals matched by `/^\d{4}-\d{2}-\d{2}$/`.
   - Creation timestamps (`createdAt`, `updatedAt`, `timestamp`) remain ISO 8601 UTC for global audit precision.
   - Day-of-week timetable scheduling maps `1` = Monday through `6` = Saturday according to IST local calendar day.


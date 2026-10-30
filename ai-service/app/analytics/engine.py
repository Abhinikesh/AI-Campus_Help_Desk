"""Attendance Calculation & Analytics Processing Engine."""
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

class AttendanceEngine:
    MIN_ATTENDANCE_THRESHOLD = 75.0
    WARNING_ATTENDANCE_THRESHOLD = 65.0

    @classmethod
    def calculate_student_overview(
        cls,
        student_id: str,
        sessions: List[Dict[str, Any]],
        records: List[Dict[str, Any]],
        subjects_catalog: Optional[List[Dict[str, Any]]] = None,
        count_excused_as_present: bool = False
    ) -> Dict[str, Any]:
        """
        Calculate student attendance metrics strictly adhering to ERP rules:
        - Exclude cancelled sessions.
        - Exclude unfinalized sessions (only 'completed' or 'finalized').
        - Exclude future sessions.
        - Overall percentage = (Classes Attended / Total Eligible Classes) * 100.
        - If 0 eligible classes, return hasData=False and no artificial 0% penalty.
        """
        now = datetime.now(timezone.utc)

        # Build map of eligible finalized sessions
        eligible_sessions: Dict[str, Dict[str, Any]] = {}
        for s in sessions:
            status = s.get("status") or s.get("sessionStatus")
            # Only count completed or finalized sessions
            if status not in ["completed", "finalized"]:
                continue

            # Check date/time if available to prevent future session counting
            session_date_str = s.get("date") or s.get("sessionDate")
            if session_date_str:
                try:
                    # Parse ISO or YYYY-MM-DD
                    if isinstance(session_date_str, str):
                        s_date = datetime.fromisoformat(session_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        if s_date > now:
                            continue
                except Exception:
                    pass

            sid = str(s.get("_id") or s.get("sessionId") or s.get("id"))
            eligible_sessions[sid] = s

        # Map records by session ID for this student
        # Prevent duplicate counting for the same session
        student_session_records: Dict[str, Dict[str, Any]] = {}
        for r in records:
            r_student_id = str(r.get("student") or r.get("studentId") or "")
            if r_student_id and r_student_id != str(student_id):
                continue

            r_session_id = str(r.get("session") or r.get("sessionId") or "")
            if r_session_id in eligible_sessions and r_session_id not in student_session_records:
                student_session_records[r_session_id] = r

        # Aggregate total and subject-wise metrics
        subject_stats: Dict[str, Dict[str, Any]] = {}

        # Initialize subject catalog if provided
        if subjects_catalog:
            for sub in subjects_catalog:
                sub_id = str(sub.get("_id") or sub.get("id") or sub.get("code") or "")
                subject_stats[sub_id] = {
                    "subjectId": sub_id,
                    "subjectName": sub.get("name", "Unknown Subject"),
                    "subjectCode": sub.get("code", sub_id),
                    "attended": 0,
                    "missed": 0,
                    "total": 0,
                    "percentage": 0.0,
                    "status": "No Data"
                }

        total_eligible = len(eligible_sessions)
        total_attended = 0
        total_missed = 0

        for sid, sess in eligible_sessions.items():
            sub_id = str(sess.get("subject") or sess.get("subjectId") or "General")
            sub_name = sess.get("subjectName") or sess.get("subject", {}).get("name") if isinstance(sess.get("subject"), dict) else sub_id
            sub_code = sess.get("subjectCode") or sess.get("subject", {}).get("code") if isinstance(sess.get("subject"), dict) else sub_id

            if sub_id not in subject_stats:
                subject_stats[sub_id] = {
                    "subjectId": sub_id,
                    "subjectName": str(sub_name),
                    "subjectCode": str(sub_code),
                    "attended": 0,
                    "missed": 0,
                    "total": 0,
                    "percentage": 0.0,
                    "status": "No Data"
                }

            subject_stats[sub_id]["total"] += 1

            record = student_session_records.get(sid)
            is_present = False

            if record:
                rec_status = str(record.get("status") or record.get("attendanceStatus") or "").lower()
                if rec_status in ["present", "late"]:
                    is_present = True
                elif rec_status == "excused" and count_excused_as_present:
                    is_present = True

            if is_present:
                total_attended += 1
                subject_stats[sub_id]["attended"] += 1
            else:
                total_missed += 1
                subject_stats[sub_id]["missed"] += 1

        # Calculate subject percentages
        subject_wise_list = []
        for sub_id, stats in subject_stats.items():
            if stats["total"] > 0:
                pct = round((stats["attended"] / stats["total"]) * 100.0, 1)
                stats["percentage"] = pct
                if pct >= cls.MIN_ATTENDANCE_THRESHOLD:
                    stats["status"] = "On Track"
                elif pct >= cls.WARNING_ATTENDANCE_THRESHOLD:
                    stats["status"] = "Warning"
                else:
                    stats["status"] = "Critical"
            else:
                stats["percentage"] = 0.0
                stats["status"] = "No Data"
            subject_wise_list.append(stats)

        # Overall percentage
        if total_eligible > 0:
            overall_pct = round((total_attended / total_eligible) * 100.0, 1)
            has_data = True
            if overall_pct >= cls.MIN_ATTENDANCE_THRESHOLD:
                overall_status = "On Track"
            elif overall_pct >= cls.WARNING_ATTENDANCE_THRESHOLD:
                overall_status = "Warning"
            else:
                overall_status = "Critical"
        else:
            overall_pct = 0.0
            has_data = False
            overall_status = "No Data"

        return {
            "hasData": has_data,
            "overallPercentage": overall_pct if has_data else None,
            "totalClasses": total_eligible,
            "classesAttended": total_attended,
            "classesMissed": total_missed,
            "minimumThreshold": cls.MIN_ATTENDANCE_THRESHOLD,
            "status": overall_status,
            "subjectWise": subject_wise_list
        }

    @classmethod
    def calculate_faculty_report(
        cls,
        sessions: List[Dict[str, Any]],
        records: List[Dict[str, Any]],
        students: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate faculty class and session level attendance reports."""
        valid_sessions = [s for s in sessions if (s.get("status") or s.get("sessionStatus")) in ["completed", "finalized"]]
        total_sessions = len(valid_sessions)
        session_ids = {str(s.get("_id") or s.get("sessionId")): s for s in valid_sessions}

        # Records belonging to valid sessions
        filtered_records = [r for r in records if str(r.get("session") or r.get("sessionId")) in session_ids]

        student_map = {str(st.get("_id") or st.get("id")): st for st in students}
        student_attendance: Dict[str, Dict[str, Any]] = {}

        for st_id, st_obj in student_map.items():
            name = st_obj.get("name")
            if not name and isinstance(st_obj.get("user"), dict):
                name = st_obj["user"].get("name")
            student_attendance[st_id] = {
                "studentId": st_id,
                "name": name or "Unknown",
                "rollNumber": st_obj.get("rollNumber", "N/A"),
                "attended": 0,
                "total": total_sessions,
                "percentage": 0.0
            }

        for r in filtered_records:
            st_id = str(r.get("student") or r.get("studentId"))
            rec_status = str(r.get("status") or r.get("attendanceStatus") or "").lower()
            if st_id in student_attendance and rec_status in ["present", "late"]:
                student_attendance[st_id]["attended"] += 1

        for st_id, data in student_attendance.items():
            if data["total"] > 0:
                data["percentage"] = round((data["attended"] / data["total"]) * 100.0, 1)

        avg_attendance = 0.0
        if student_attendance:
            total_pcts = sum(s["percentage"] for s in student_attendance.values())
            avg_attendance = round(total_pcts / len(student_attendance), 1)

        return {
            "totalSessions": total_sessions,
            "totalStudents": len(students),
            "averageAttendance": avg_attendance,
            "studentBreakdown": list(student_attendance.values())
        }

"""
normalizer.py
Normalizes raw timetable session dictionaries into standard staging entries.
Enriches subjects and instructors using page legends and performs exact matching against known ERP records.
"""
from typing import Dict, List, Any, Optional

# Verified exact faculty mappings from MongoDB (campus-erp: 18 exact matches)
VERIFIED_FACULTY_MAP: Dict[str, Dict[str, str]] = {
    "AG": {"loginId": "FAC009", "name": "Arushi Gupta"},
    "ANM": {"loginId": "FAC011", "name": "Anisha Mahto"},
    "AP": {"loginId": "FAC006", "name": "Aman Prasad"},
    "MS": {"loginId": "FAC002", "name": "Meeta Singh"},
    "VIP": {"loginId": "FAC018", "name": "Vipin (CDC)"},
    "NID": {"loginId": "FAC010", "name": "Nidhi"},
    "RM": {"loginId": "FAC012", "name": "Rosy Madaan"},
    "SH": {"loginId": "FAC004", "name": "Swati Hans"},
    "ROB": {"loginId": "FAC015", "name": "Rohit Bathla"},
    "GS": {"loginId": "FAC005", "name": "Ginni Sehgal"},
    "SHV": {"loginId": "FAC019", "name": "Shivangee (CDC)"},
    "TD": {"loginId": "FAC013", "name": "Tanu Dua"},
    "AC": {"loginId": "FAC007", "name": "Avishek Choudhuri"},
    "PB": {"loginId": "FAC016", "name": "Prity Bhardwaj"},
    "RB": {"loginId": "FAC014", "name": "Rachna Behl"},
    "PN": {"loginId": "FAC003", "name": "Poonam Nandal"},
    "MEGH": {"loginId": "FAC008", "name": "Megha Makan"},
    "TARA": {"loginId": "FAC017", "name": "Tara (German)"},
}

# Ambiguous faculty cases identified in audit (name similarity with FAC001 Dr. Priya Mehta)
AMBIGUOUS_FACULTY_ABBRS = {"PRA", "PREMA", "PRIYA"}

# Verified exact subject mappings from MongoDB (campus-erp: 14 exact matches in Sem 5)
VERIFIED_SUBJECT_MAP: Dict[str, Dict[str, Any]] = {
    "DAA": {"code": "CS501", "name": "Design Analysis of Algorithms", "semester": 5},
    "FLAT": {"code": "CS502", "name": "Formal Languages and Automata Theory", "semester": 5},
    "AICA": {"code": "CS503", "name": "Artificial Intelligence Concepts & Apps", "semester": 5},
    "CG": {"code": "CS504", "name": "Computer Graphics", "semester": 5},
    "SDP": {"code": "CS505", "name": "Software Development Processes", "semester": 5},
    "DTI-III": {"code": "CS506", "name": "Design Thinking and Innovation - III", "semester": 5},
    "ES": {"code": "CS507", "name": "Entrepreneurship and Startups", "semester": 5},
    "DAA Lab": {"code": "CS508L", "name": "Design Analysis of Algorithms Lab", "semester": 5},
    "AICA LAB": {"code": "CS509L", "name": "Artificial Intelligence Concepts Lab", "semester": 5},
    "CG Lab": {"code": "CS510L", "name": "Computer Graphics Lab", "semester": 5},
    "SDP Lab": {"code": "CS511L", "name": "Software Development Processes Lab", "semester": 5},
    "5QA-APT": {"code": "CS512", "name": "QA Aptitude", "semester": 5},
    "5QA-Tech": {"code": "CS513", "name": "QA Technical", "semester": 5},
    "5QA-VERB": {"code": "CS514", "name": "QA Verbal", "semester": 5},
}

# Ambiguous subject cases (e.g. DSA taught in Sem 3 vs CS201 cataloged for Sem 4)
AMBIGUOUS_SUBJECT_ABBRS = {"DSA", "DSA Lab"}


class Normalizer:
    @staticmethod
    def normalize_session(
        raw_session: Dict[str, Any],
        cohort: Dict[str, Any],
        teachers_legend: Dict[str, str],
        subjects_legend: Dict[str, str],
    ) -> Dict[str, Any]:
        """
        Transforms a raw session into a fully enriched, standardized staging entry.
        """
        subj_acronym = raw_session["subjectAcronym"]
        subj_name = subjects_legend.get(subj_acronym) or subjects_legend.get(subj_acronym.strip())
        if not subj_name:
            # Check case-insensitive
            for k, v in subjects_legend.items():
                if k.lower() == subj_acronym.lower():
                    subj_name = v
                    break
        if not subj_name:
            subj_name = subj_acronym  # fallback

        # Determine subject matching status
        subj_match = None
        subj_code = None
        # Check against verified subjects in DB
        matched_db_sub = None
        for k, info in VERIFIED_SUBJECT_MAP.items():
            if k.lower() == subj_acronym.lower() or info["name"].lower() == subj_name.lower():
                matched_db_sub = info
                break

        if matched_db_sub:
            subj_match = "VERIFIED"
            subj_code = matched_db_sub["code"]
        elif subj_acronym in AMBIGUOUS_SUBJECT_ABBRS:
            subj_match = "AMBIGUOUS"
            subj_code = None
        else:
            subj_match = "UNMATCHED"
            subj_code = None

        # Determine session type
        session_type = Normalizer._determine_session_type(subj_acronym, subj_name)

        # Normalize instructors
        instructors = []
        for abbr in raw_session["instructors"]:
            inst_name = teachers_legend.get(abbr, abbr)
            inst_match = "UNMATCHED"
            erp_login_id = None

            if abbr in VERIFIED_FACULTY_MAP:
                inst_match = "VERIFIED"
                erp_login_id = VERIFIED_FACULTY_MAP[abbr]["loginId"]
            elif abbr in AMBIGUOUS_FACULTY_ABBRS:
                inst_match = "AMBIGUOUS"

            instructors.append({
                "abbreviation": abbr,
                "name": inst_name,
                "matchingStatus": inst_match,
                "erpLoginId": erp_login_id,
            })

        # Canonical batch
        batch = raw_session["batch"]
        source_group_label = raw_session["sourceGroupLabel"]

        return {
            "sourceDocument": "classWise-TT-21_OCT_2026.pdf",
            "sourcePage": raw_session["sourcePage"],
            "cohort": {
                "rawCohortLabel": cohort["rawCohortLabel"],
                "department": cohort["department"],
                "branch": cohort["branch"],
                "program": cohort["program"],
                "semester": cohort["semester"],
                "section": cohort["section"],
                "specialization": cohort["specialization"],
                "academicYear": cohort["academicYear"],
                "semesterType": cohort["semesterType"],
                "effectiveStartDate": cohort["effectiveStartDate"],
                "effectiveEndDate": cohort["effectiveEndDate"],
            },
            "dayOfWeek": raw_session["dayOfWeek"],
            "dayName": raw_session["dayName"],
            "period": raw_session["period"],
            "periodCount": raw_session["periodCount"],
            "startTime": raw_session["startTime"],
            "endTime": raw_session["endTime"],
            "room": raw_session["room"],
            "sessionType": session_type,
            "batch": batch,
            "sourceGroupLabel": source_group_label,
            "subject": {
                "acronym": subj_acronym,
                "name": subj_name,
                "code": subj_code,
                "matchingStatus": subj_match,
            },
            "instructors": instructors,
            "sourceCellText": raw_session["rawCellText"],
            "validationStatus": "PENDING_VALIDATION",
        }

    @staticmethod
    def _determine_session_type(acronym: str, name: str) -> str:
        text = f"{acronym} {name}".lower()
        if "lab" in text or "laboratory" in text:
            return "Lab"
        if any(term in text for term in ["aptitude", "soft skills", "verbal", "-apt", "-soft", "-verb"]):
            return "Tutorial"
        if acronym in ["SY", "PP-II", "Collq", "Dis-I"] or any(term in text for term in ["sports", "yoga", "project", "colloquium", "dissertation"]):
            return "Other"
        return "Lecture"


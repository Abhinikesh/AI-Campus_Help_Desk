"""
cohort_parser.py
Extracts and normalizes page-level cohort classification from timetable PDF page headers.
"""
import re
from typing import Dict, List, Any, Optional


class CohortParser:
    @staticmethod
    def parse_header(words: List[Dict[str, Any]], page_num: int) -> Dict[str, Any]:
        """
        Parses page header to identify cohort metadata.
        Returns a dictionary with rawCohortLabel, department, branch, semester, section,
        program, specialization, academicYear, semesterType, effectiveStartDate, status.
        """
        # Institutional header
        # Check w.e.f. date
        wef_date = "2026-10-21"
        for i, w in enumerate(words):
            if w["text"] == "w.e.f.:" and i + 1 < len(words):
                wef_date_candidate = words[i + 1]["text"]
                # Convert 21-10-2026 to 2026-10-21 if needed
                m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", wef_date_candidate)
                if m:
                    wef_date = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
                break

        # Check Academic Year & Semester Type
        academic_year = "2026-2027"
        semester_type = "Odd"

        # Find Title words (large font height in top header region)
        title_words = [w for w in words if 45 <= w["top"] <= 95 and 200 <= w["left"] <= 650 and w["height"] > 15]
        if not title_words:
            title_words = [w for w in words if w["top"] <= 100 and w["height"] > 15 and w["text"] not in ["1", "Mo", "Tu", "We", "Th", "Fr"]]

        title_words.sort(key=lambda x: x["left"])
        raw_title = " ".join([w["text"] for w in title_words]).strip()

        # Classify cohort attributes
        classification = CohortParser.classify_cohort_label(raw_title, page_num)

        return {
            "sourcePage": page_num,
            "rawCohortLabel": raw_title,
            "department": classification["department"],
            "branch": classification["branch"],
            "program": classification["program"],
            "semester": classification["semester"],
            "section": classification["section"],
            "specialization": classification["specialization"],
            "academicYear": academic_year,
            "semesterType": semester_type,
            "effectiveStartDate": wef_date,
            "effectiveEndDate": None,
            "classificationStatus": classification["status"],
        }

    @staticmethod
    def classify_cohort_label(label: str, page_num: int) -> Dict[str, Any]:
        norm = label.strip()

        # Case 1: M.Tech (e.g. "1 M.TECH", "3 M.TECH")
        m = re.match(r"^(\d)\s*M\.TECH$", norm, re.IGNORECASE)
        if m:
            return {
                "department": "CSE",
                "branch": "CSE",
                "program": "M.Tech",
                "semester": int(m.group(1)),
                "section": "A",
                "specialization": "M.Tech CSE",
                "status": "RESOLVED",
            }

        # Case 2: 1st Semester common sections: "1-A" to "1-M"
        m = re.match(r"^1-([A-Z])$", norm)
        if m:
            return {
                "department": "CSE",
                "branch": "CSE",
                "program": "B.Tech",
                "semester": 1,
                "section": m.group(1),
                "specialization": "Core",
                "status": "RESOLVED",
            }

        # Case 3: 3-Elective
        if norm.lower() in ["3-elective", "3 elective"]:
            return {
                "department": "CSE",
                "branch": "CSE",
                "program": "B.Tech",
                "semester": 3,
                "section": None,
                "specialization": "Open Elective",
                "status": "RESOLVED",
            }

        # Case 4: ECE cross-department pages: "3ECE", "5 ECE"
        m = re.match(r"^(\d)\s*ECE$", norm, re.IGNORECASE)
        if m:
            return {
                "department": "ECE",
                "branch": "ECE",
                "program": "B.Tech",
                "semester": int(m.group(1)),
                "section": "A",
                "specialization": "ECE-Service",
                "status": "SPECIAL_CROSS_DEPT",
            }

        # Case 5: Standard format: "<sem> <branch/spec>-<section>" (e.g. "3 CSE-A", "5 CSE-B", "7CSE-C", "7-AIML-A")
        m = re.match(r"^(\d)[\s\-]*([A-Za-z]+)-([A-Z])$", norm)
        if m:
            sem = int(m.group(1))
            spec = m.group(2).upper()
            sec = m.group(3).upper()
            return {
                "department": "CSE",
                "branch": "CSE",
                "program": "B.Tech",
                "semester": sem,
                "section": sec,
                "specialization": "Core" if spec == "CSE" else spec,
                "status": "RESOLVED",
            }

        # Case 6: Single section specializations: "<sem> <spec>" (e.g. "3 DFCS", "3 DS", "3 GT", "5 DFCS", "5 DS", "5 CC", "5 GT", "7 DFCS", "7 CC", "7 GT", "7 DS")
        m = re.match(r"^(\d)[\s\-]+([A-Za-z]+)$", norm)
        if m:
            sem = int(m.group(1))
            spec = m.group(2).upper()
            return {
                "department": "CSE",
                "branch": "CSE",
                "program": "B.Tech",
                "semester": sem,
                "section": "A",  # Default section A for single-cohort specializations
                "specialization": spec,
                "status": "RESOLVED",
            }

        # Unresolved fallback
        return {
            "department": "CSE",
            "branch": "CSE",
            "program": "B.Tech",
            "semester": None,
            "section": None,
            "specialization": norm,
            "status": "UNRESOLVED",
        }


if __name__ == "__main__":
    import sys
    import os
    sys.path.insert(0, os.path.dirname(__file__))
    from pdf_extractor import PDFExtractor

    extractor = PDFExtractor()
    parser = CohortParser()
    print("Testing CohortParser on all 50 pages:")
    for p in range(1, 51):
        words = extractor.get_page_words(p)
        header = parser.parse_header(words, p)
        print(
            f"Page {p:2d}: [{header['rawCohortLabel']:10s}] -> Sem {header['semester']} "
            f"Sec {header['section']} ({header['specialization']}) [{header['classificationStatus']}]"
        )

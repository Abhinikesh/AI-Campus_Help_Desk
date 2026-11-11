"""
legend_parser.py
Parses the footer area of each timetable page to extract the Teachers legend (abbreviation -> full name)
and Subjects legend (code/acronym -> full subject title).
"""
from collections import defaultdict
from typing import Dict, List, Any, Tuple


class LegendParser:
    @staticmethod
    def parse_page_legends(words: List[Dict[str, Any]]) -> Tuple[Dict[str, str], Dict[str, str]]:
        """
        Parses footer words (top >= 465) on a single page into:
        teachers: { abbr: fullName }
        subjects: { codeOrAcronym: fullTitle }
        """
        footer = [
            w for w in words
            if w["top"] >= 465
            and "aSc" not in w["text"]
            and "Timetables" not in w["text"]
            and w["text"] not in ["Teachers:", "Subjects:"]
        ]

        t_words = [w for w in footer if w["left"] < 280]
        s_words = [w for w in footer if w["left"] >= 280]

        teachers = LegendParser._parse_teachers(t_words)
        subjects = LegendParser._parse_subjects(s_words)

        return teachers, subjects

    @staticmethod
    def _parse_teachers(words: List[Dict[str, Any]]) -> Dict[str, str]:
        teachers: Dict[str, str] = {}
        # Sub-col 1: left < 140; Sub-col 2: 140 <= left < 280
        for col_idx, is_col1, code_max in [(1, True, 52), (2, False, 185)]:
            col_words = [w for w in words if (w["left"] < 140 if is_col1 else w["left"] >= 140)]
            by_y = defaultdict(list)
            for w in col_words:
                y = round(w["top"] / 3.0) * 3
                by_y[y].append(w)

            last_abbr = None
            for y in sorted(by_y.keys()):
                line = sorted(by_y[y], key=lambda x: x["left"])
                abbr_w = [w["text"] for w in line if w["left"] < code_max]
                name_w = [w["text"] for w in line if w["left"] >= code_max]
                abbr = " ".join(abbr_w).strip()
                name = " ".join(name_w).strip()

                if abbr:
                    last_abbr = abbr
                    teachers[abbr] = name
                elif last_abbr and name:
                    teachers[last_abbr] = (teachers[last_abbr] + " " + name).strip()

        return teachers

    @staticmethod
    def _parse_subjects(words: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Parses footer words (left >= 280) into subjects dictionary.
        Correctly handles horizontal overflow from sub-column 3 across into sub-column 4.
        """
        by_y = defaultdict(list)
        for w in words:
            y = round(w["top"] / 3.0) * 3
            by_y[y].append(w)

        subjects: Dict[str, str] = {}
        last_col3_code = None
        last_col4_code = None

        for y in sorted(by_y.keys()):
            line = sorted(by_y[y], key=lambda x: x["left"])
            col3_words = [w for w in line if w["left"] < 540]
            col4_words = [w for w in line if w["left"] >= 540]

            # Check if col4 has an anchor code starting at left 540..560
            has_col4_anchor = any(540 <= w["left"] < 560 for w in col4_words)
            if not has_col4_anchor and col4_words:
                # All col4 words on this line are overflow from col3 title
                col3_words.extend(col4_words)
                col4_words = []
            elif has_col4_anchor:
                # Check for specific title words that overflowed from col3 past 565
                col4_clean = []
                for w in col4_words:
                    if 565 <= w["left"] < 615 and w["text"] in ["INFORMATION"]:
                        col3_words.append(w)
                    else:
                        col4_clean.append(w)
                col4_words = col4_clean

            # Parse Sub-column 3 (left < 540)
            if col3_words:
                code_w = [w["text"] for w in col3_words if w["left"] < 355]
                title_w = [w["text"] for w in col3_words if w["left"] >= 355]
                code = " ".join(code_w).strip()
                title = " ".join(title_w).strip()
                if code:
                    last_col3_code = code
                    subjects[code] = title
                elif last_col3_code and title:
                    subjects[last_col3_code] = (subjects[last_col3_code] + " " + title).strip()

            # Parse Sub-column 4 (left >= 540)
            if col4_words:
                code_w = [w["text"] for w in col4_words if w["left"] < 615]
                title_w = [w["text"] for w in col4_words if w["left"] >= 615]
                code = " ".join(code_w).strip()
                title = " ".join(title_w).strip()
                if code:
                    last_col4_code = code
                    subjects[code] = title
                elif last_col4_code and title:
                    subjects[last_col4_code] = (subjects[last_col4_code] + " " + title).strip()

        return subjects


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from pdf_extractor import PDFExtractor

    extractor = PDFExtractor()
    t, s = LegendParser.parse_page_legends(extractor.get_page_words(1))
    print(f"Page 1 parsed: {len(t)} teachers, {len(s)} subjects")
    print("Teachers sample:", list(t.items())[:5])
    print("Subjects sample:", list(s.items())[:5])


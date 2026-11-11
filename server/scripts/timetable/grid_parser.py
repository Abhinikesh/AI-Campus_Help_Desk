"""
grid_parser.py
Decomposes timetable pages into weekday rows (Monday-Friday) and 10 period columns.
Extracts individual timetable sessions, multi-period spans, and subgroup splits.
"""
import re
from typing import Dict, List, Any, Optional

COL_BOUNDS = [88.5 + i * 67.8 for i in range(11)]
ROW_BOUNDS = [125.0 + i * 66.8 for i in range(6)]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
PERIOD_TIMES = [
    ("08:10", "09:00"),
    ("09:00", "09:50"),
    ("09:50", "10:40"),
    ("10:40", "11:30"),
    ("11:30", "12:20"),
    ("12:20", "13:10"),
    ("13:10", "14:00"),
    ("14:00", "14:50"),
    ("14:50", "15:40"),
    ("15:40", "16:30"),
]

ROOM_RE = re.compile(
    r"^(AF-?\d+[A-Z]?|AS-?\d+[A-Z]?|CF-?\d+[A-Z]?|CG-?\d+[A-Z]?|AG-?\d+[-A-Z0-9]*|AT-?\d+[A-Z]?)$"
)
GROUP_RE = re.compile(
    r"^(3[A-Z0-9\-]+|5[A-Z0-9\-]+|7[A-Z0-9\-]+|C[12]|Group|[12]|FR1|GR1|S1)$"
)
NON_GROUP_WORDS = {"3QA-APT", "3QA-SOFT", "5QA-APT", "5QA-VERB", "5QA-Tech"}


class GridParser:
    @staticmethod
    def extract_sessions(
        page_words: List[Dict[str, Any]],
        page_num: int,
        teachers_legend: Dict[str, str],
        subjects_legend: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        raw_sessions: List[Dict[str, Any]] = []

        for d_idx in range(5):
            day_name = DAY_NAMES[d_idx]
            day_of_week = d_idx + 1
            r_top = ROW_BOUNDS[d_idx]
            r_bot = ROW_BOUNDS[d_idx + 1]
            r_mid = (r_top + r_bot) / 2.0

            p = 1
            while p <= 10:
                c_left = COL_BOUNDS[p - 1]
                c_right = COL_BOUNDS[p]

                # Words in current period column
                p_words = [
                    w for w in page_words
                    if r_top <= w["top"] < r_bot
                    and c_left <= w["left"] < c_right
                    and w["text"] not in ["Mo", "Tu", "We", "Th", "Fr", "aSc", "Timetables"]
                ]

                if not p_words:
                    p += 1
                    continue

                # Check multi-period extension (p into p+1)
                span = 1
                if p < 10:
                    next_left = COL_BOUNDS[p]
                    next_right = COL_BOUNDS[p + 1]
                    next_words = [
                        w for w in page_words
                        if r_top <= w["top"] < r_bot
                        and next_left <= w["left"] < next_right
                        and w["text"] not in ["Mo", "Tu", "We", "Th", "Fr", "aSc", "Timetables"]
                    ]

                    if next_words:
                        next_rooms = GridParser._find_rooms(next_words)
                        # Check standalone subject in next column
                        next_subjs = [
                            w["text"] for w in next_words
                            if w["text"] in subjects_legend and w["text"] not in ["Lab", "lab", "SY"]
                        ]
                        if not next_rooms and not next_subjs:
                            has_t = any(w["text"] in teachers_legend for w in next_words)
                            has_lab = any(w["text"].lower() == "lab" for w in next_words)
                            is_sy = any(w["text"] == "SY" for w in p_words)
                            if has_t or has_lab or is_sy:
                                span = 2

                block_left = c_left
                block_right = COL_BOUNDS[p + span - 1]
                block_words = [
                    w for w in page_words
                    if r_top <= w["top"] < r_bot
                    and block_left <= w["left"] < block_right
                    and w["text"] not in ["Mo", "Tu", "We", "Th", "Fr", "aSc", "Timetables"]
                ]

                start_t = PERIOD_TIMES[p - 1][0]
                end_t = PERIOD_TIMES[p + span - 2][1]

                # Check vertical partitioning inside block
                lang_tokens = [w for w in block_words if w["text"] in ["FR1", "GR1", "S1"]]
                if lang_tokens:
                    # 3-tier language tracks
                    tier_h = (r_bot - r_top) / 3.0
                    tiers = [
                        ("FR1", [w for w in block_words if r_top <= w["top"] < r_top + tier_h + 2.0]),
                        ("GR1", [w for w in block_words if r_top + tier_h - 2.0 <= w["top"] < r_top + 2 * tier_h + 2.0]),
                        ("S1", [w for w in block_words if r_top + 2 * tier_h - 2.0 <= w["top"] < r_bot]),
                    ]
                    for g_label, t_words in tiers:
                        if t_words:
                            slot = GridParser._parse_cell_words(
                                t_words, day_of_week, day_name, p, span, start_t, end_t, g_label,
                                page_num, teachers_legend, subjects_legend
                            )
                            if slot:
                                raw_sessions.append(slot)
                else:
                    rooms = GridParser._find_rooms(block_words)
                    groups = [
                        w["text"] for w in block_words
                        if GROUP_RE.match(w["text"]) and w["text"] not in NON_GROUP_WORDS
                    ]

                    # If multiple rooms or group labels exist across the vertical divider
                    if len(rooms) > 1 or len(groups) >= 2 or (
                        groups and any(w["top"] < r_mid for w in block_words) and any(w["top"] >= r_mid for w in block_words)
                    ):
                        top_words = [w for w in block_words if w["top"] < r_mid]
                        bot_words = [w for w in block_words if w["top"] >= r_mid]

                        if top_words:
                            slot_top = GridParser._parse_cell_words(
                                top_words, day_of_week, day_name, p, span, start_t, end_t, None,
                                page_num, teachers_legend, subjects_legend
                            )
                            if slot_top:
                                raw_sessions.append(slot_top)

                        if bot_words:
                            slot_bot = GridParser._parse_cell_words(
                                bot_words, day_of_week, day_name, p, span, start_t, end_t, None,
                                page_num, teachers_legend, subjects_legend
                            )
                            if slot_bot:
                                raw_sessions.append(slot_bot)
                    else:
                        # Full-height single session
                        slot = GridParser._parse_cell_words(
                            block_words, day_of_week, day_name, p, span, start_t, end_t, "All",
                            page_num, teachers_legend, subjects_legend
                        )
                        if slot:
                            raw_sessions.append(slot)

                p += span

        # Post-process: merge split subgroup labs spanning consecutive periods
        # e.g., Period 3 DEC in AS11 and Period 4 lab with PRA/VIS in the same track
        merged_sessions = GridParser._merge_split_subgroup_labs(raw_sessions, subjects_legend)
        return merged_sessions

    @staticmethod
    def _find_rooms(words: List[Dict[str, Any]]) -> List[str]:
        rooms = []
        i = 0
        while i < len(words):
            w = words[i]["text"]
            if w == "Not" and i + 1 < len(words) and words[i + 1]["text"] == "Fixed":
                rooms.append("Not Fixed")
                i += 2
                continue
            elif ROOM_RE.match(w):
                rooms.append(w)
            i += 1
        return rooms

    @staticmethod
    def _parse_cell_words(
        words: List[Dict[str, Any]],
        day_of_week: int,
        day_name: str,
        period: int,
        span: int,
        start_t: str,
        end_t: str,
        forced_group: Optional[str],
        page_num: int,
        teachers_legend: Dict[str, str],
        subjects_legend: Dict[str, str],
    ) -> Optional[Dict[str, Any]]:
        if not words:
            return None

        # 1. Room
        rooms = GridParser._find_rooms(words)
        room = rooms[0] if rooms else "TBA"

        # 2. Group
        group = forced_group
        if not group or group == "All":
            texts = [w["text"] for w in words]
            if "Group" in texts:
                g_idx = texts.index("Group")
                if g_idx + 1 < len(texts) and texts[g_idx + 1] in ["1", "2"]:
                    group = f"Group {texts[g_idx + 1]}"
            if not group:
                for w in words:
                    if GROUP_RE.match(w["text"]) and w["text"] not in NON_GROUP_WORDS:
                        group = w["text"]
                        break

        # 3. Instructors
        instructors = []
        for w in words:
            if w["text"] in teachers_legend and w["text"] not in instructors:
                instructors.append(w["text"])

        # 4. Subject tokens
        subj_tokens = []
        for w in words:
            t = w["text"]
            if t in rooms or t in ["Not", "Fixed", "/", "Group", "1", "2"]:
                continue
            if group and (t == group or t in group.split()):
                continue
            if t in instructors and t not in subjects_legend:
                continue
            subj_tokens.append(t)

        raw_subj = " ".join(subj_tokens).strip()

        # If subject is empty and room is TBA, omit phantom
        if not raw_subj and room == "TBA" and not instructors:
            return None

        return {
            "sourcePage": page_num,
            "dayOfWeek": day_of_week,
            "dayName": day_name,
            "period": period,
            "periodCount": span,
            "startTime": start_t,
            "endTime": end_t,
            "subjectAcronym": raw_subj,
            "room": room,
            "instructors": instructors,
            "batch": group or "All",
            "sourceGroupLabel": group if group != "All" else None,
            "rawCellText": " ".join([w["text"] for w in sorted(words, key=lambda x: (x["top"], x["left"]))]),
        }

    @staticmethod
    def _merge_split_subgroup_labs(
        sessions: List[Dict[str, Any]], subjects_legend: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """
        Merges consecutive sessions in the same day where the second session is a
        continuation lab (e.g. 'lab' or matching a known '<Subj> lab' in subjects_legend).
        """
        if not sessions:
            return []

        # Sort by day, period, batch
        sessions.sort(key=lambda s: (s["dayOfWeek"], s["period"], s["batch"]))
        merged: List[Dict[str, Any]] = []

        legend_keys_lower = {k.lower(): k for k in subjects_legend.keys()}

        skip_indices = set()
        for i in range(len(sessions)):
            if i in skip_indices:
                continue

            curr = sessions[i]
            # Look for a consecutive continuation in subsequent sessions on same day
            matched_j = None
            for j in range(i + 1, len(sessions)):
                if j in skip_indices:
                    continue
                nxt = sessions[j]
                if nxt["dayOfWeek"] != curr["dayOfWeek"]:
                    break
                
                # Check consecutive period
                if curr["period"] + curr["periodCount"] == nxt["period"]:
                    candidate_subj = f"{curr['subjectAcronym']} {nxt['subjectAcronym']}".strip()
                    cand_lower = candidate_subj.lower()
                    
                    # Is nxt a lab continuation?
                    # Must be explicitly 'lab' or form the full compound name (e.g. 'DEC lab')
                    is_lab_cont = (
                        nxt["subjectAcronym"].lower() in ["lab", "lab."]
                        or (cand_lower in legend_keys_lower and "lab" in cand_lower and nxt["subjectAcronym"].lower() in ["lab", "lab."])
                    )
                    
                    # Batch compatibility: either same batch, or one is 'All'
                    batches_compatible = (
                        curr["batch"] == nxt["batch"]
                        or curr["batch"] == "All"
                        or nxt["batch"] == "All"
                    )

                    if is_lab_cont and batches_compatible:
                        matched_j = j
                        break

            if matched_j is not None:
                nxt = sessions[matched_j]
                skip_indices.add(matched_j)

                # Canonical lab subject
                cand_lower = f"{curr['subjectAcronym']} {nxt['subjectAcronym']}".strip().lower()
                alt_lower = f"{curr['subjectAcronym'].lower()} lab"
                if cand_lower in legend_keys_lower:
                    merged_subj = legend_keys_lower[cand_lower]
                elif alt_lower in legend_keys_lower:
                    merged_subj = legend_keys_lower[alt_lower]
                else:
                    merged_subj = f"{curr['subjectAcronym']} {nxt['subjectAcronym']}".strip()

                combined_instructors = curr["instructors"] + [
                    ins for ins in nxt["instructors"] if ins not in curr["instructors"]
                ]
                combined_room = curr["room"] if curr["room"] != "TBA" else nxt["room"]
                chosen_batch = nxt["batch"] if curr["batch"] == "All" else curr["batch"]
                chosen_label = nxt["sourceGroupLabel"] or curr["sourceGroupLabel"]

                merged.append({
                    "sourcePage": curr["sourcePage"],
                    "dayOfWeek": curr["dayOfWeek"],
                    "dayName": curr["dayName"],
                    "period": curr["period"],
                    "periodCount": curr["periodCount"] + nxt["periodCount"],
                    "startTime": curr["startTime"],
                    "endTime": nxt["endTime"],
                    "subjectAcronym": merged_subj,
                    "room": combined_room,
                    "instructors": combined_instructors,
                    "batch": chosen_batch,
                    "sourceGroupLabel": chosen_label,
                    "rawCellText": f"{curr['rawCellText']} | {nxt['rawCellText']}",
                })
            else:
                merged.append(curr)

        # Re-sort by dayOfWeek, period, batch
        merged.sort(key=lambda s: (s["dayOfWeek"], s["period"], s["batch"]))
        return merged


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from pdf_extractor import PDFExtractor
    from legend_parser import LegendParser

    extractor = PDFExtractor()
    words = extractor.get_page_words(1)
    t, s = LegendParser.parse_page_legends(words)
    sessions = GridParser.extract_sessions(words, 1, t, s)
    print(f"Page 1 Extracted {len(sessions)} sessions:")
    for ses in sessions[:12]:
        print(
            f"  {ses['dayName'][:2]} P{ses['period']:2d} ({ses['startTime']}-{ses['endTime']}) "
            f"[{ses['subjectAcronym']:12s}] Room: {ses['room']:8s} Teachers: {ses['instructors']} Batch: {ses['batch']}"
        )

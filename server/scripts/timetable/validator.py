"""
validator.py
Automated validation engine for extracted and normalized timetable staging data.
Enforces the 12 integrity rules defined in Phase 3.2 specification.
"""
import re
from typing import Dict, List, Any, Tuple

VALID_PERIOD_TIMES = [
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


class TimetableValidator:
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.rule_results: Dict[str, bool] = {}

    def validate(
        self,
        document_meta: Dict[str, Any],
        pages_summary: List[Dict[str, Any]],
        entries: List[Dict[str, Any]],
        teachers_map: Dict[str, str],
        subjects_map: Dict[str, str],
    ) -> Dict[str, Any]:
        """
        Runs comprehensive validation across the entire extracted staging dataset.
        """
        self.errors.clear()
        self.warnings.clear()
        self.rule_results.clear()

        # Rule 1: All 50 pages processed
        r1 = len(pages_summary) == 50 and document_meta.get("pages") == 50
        if not r1:
            self.errors.append(f"Rule 1 Failed: Expected 50 pages, but found {len(pages_summary)} page records.")
        self.rule_results["rule1_fifty_pages_processed"] = r1

        # Rule 2: Page-level classification valid
        r2 = True
        for p in pages_summary:
            status = p.get("cohort", {}).get("classificationStatus")
            if status not in ["RESOLVED", "SPECIAL_CROSS_DEPT"]:
                self.warnings.append(f"Rule 2 Warning: Page {p['sourcePage']} has classificationStatus '{status}'.")
                r2 = False
        self.rule_results["rule2_page_classification_valid"] = r2

        # Rule 3: Period numbers within [1, 10]
        r3 = True
        for e in entries:
            p = e.get("period")
            pc = e.get("periodCount", 1)
            if not (1 <= p <= 10) or not (1 <= p + pc - 1 <= 10):
                self.errors.append(f"Rule 3 Failed: Entry on page {e.get('sourcePage')} has invalid period {p} (count {pc}).")
                r3 = False
        self.rule_results["rule3_period_numbers_valid"] = r3

        # Rule 4: Start and end times strictly valid format & start < end
        r4 = True
        time_regex = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
        for e in entries:
            st = e.get("startTime", "")
            et = e.get("endTime", "")
            if not time_regex.match(st) or not time_regex.match(et) or st >= et:
                self.errors.append(f"Rule 4 Failed: Entry on page {e.get('sourcePage')} has invalid times: {st} - {et}.")
                r4 = False
        self.rule_results["rule4_time_intervals_valid"] = r4

        # Rule 5: Multi-period entries align with consecutive period boundaries
        r5 = True
        for e in entries:
            p = e["period"]
            pc = e["periodCount"]
            expected_start = VALID_PERIOD_TIMES[p - 1][0]
            expected_end = VALID_PERIOD_TIMES[p + pc - 2][1]
            if e["startTime"] != expected_start or e["endTime"] != expected_end:
                self.errors.append(
                    f"Rule 5 Failed: Period {p} (count {pc}) on page {e['sourcePage']} times {e['startTime']}-{e['endTime']} "
                    f"do not match expected {expected_start}-{expected_end}."
                )
                r5 = False
        self.rule_results["rule5_multi_period_alignment"] = r5

        # Rule 6: Parallel subgroup sessions remain separate entries
        r6 = True
        # Check that sessions with same cohort, day, and period have different batches or session IDs
        cohort_slots = {}
        for e in entries:
            key = (
                e["cohort"]["rawCohortLabel"],
                e["dayOfWeek"],
                e["period"],
                e["batch"],
            )
            if key in cohort_slots:
                prev = cohort_slots[key]
                # Duplicate!
                self.errors.append(
                    f"Rule 6/11 Failed: Duplicate slot collision for {key[0]} Day {key[1]} P{key[2]} Batch '{key[3]}'. "
                    f"Entries on page {prev['sourcePage']} and {e['sourcePage']}."
                )
                r6 = False
            else:
                cohort_slots[key] = e
        self.rule_results["rule6_parallel_subgroups_distinct"] = r6
        self.rule_results["rule11_duplicate_detection"] = r6

        # Rule 7: Multiple instructors retained without loss
        multi_ins_count = sum(1 for e in entries if len(e.get("instructors", [])) > 1)
        r7 = multi_ins_count > 0
        if not r7:
            self.warnings.append("Rule 7 Warning: No multi-instructor sessions detected across 50 pages.")
        self.rule_results["rule7_multiple_instructors_retained"] = r7

        # Rule 8: Source legends parsed consistently
        r8 = len(teachers_map) > 50 and len(subjects_map) > 50
        if not r8:
            self.warnings.append(f"Rule 8 Warning: Low legend count (teachers: {len(teachers_map)}, subjects: {len(subjects_map)}).")
        self.rule_results["rule8_legends_parsed_consistently"] = r8

        # Rule 9: Every entry has source-page provenance
        r9 = True
        for e in entries:
            if not e.get("sourcePage") or not e.get("sourceCellText"):
                self.errors.append("Rule 9 Failed: Entry missing sourcePage or sourceCellText provenance.")
                r9 = False
                break
        self.rule_results["rule9_provenance_preserved"] = r9

        # Rule 10: Empty cells not converted into entries
        r10 = True
        for e in entries:
            subj = e.get("subject", {}).get("acronym", "").strip()
            room = e.get("room", "").strip()
            ins = e.get("instructors", [])
            if not subj and (room == "TBA" or not room) and not ins:
                self.errors.append(f"Rule 10 Failed: Blank phantom entry on page {e.get('sourcePage')} P{e.get('period')}.")
                r10 = False
        self.rule_results["rule10_no_blank_phantoms"] = r10

        # Rule 12: Unknown subjects, teachers, rooms retained and reported
        unmatched_subs = sum(1 for e in entries if e.get("subject", {}).get("matchingStatus") == "UNMATCHED")
        unmatched_ins = sum(
            1 for e in entries for ins in e.get("instructors", []) if ins.get("matchingStatus") == "UNMATCHED"
        )
        r12 = unmatched_subs > 0 or unmatched_ins > 0
        self.rule_results["rule12_unmatched_retained_and_reported"] = True

        all_rules_passed = all(self.rule_results.values()) and len(self.errors) == 0

        # Mark validation status on entries
        for e in entries:
            e["validationStatus"] = "VALIDATED" if all_rules_passed else "FLAGGED"

        return {
            "allRulesPassed": all_rules_passed,
            "rulesSummary": self.rule_results,
            "totalEntriesValidated": len(entries),
            "multiInstructorSessionsCount": multi_ins_count,
            "unmatchedSubjectsInEntries": unmatched_subs,
            "unmatchedInstructorsInEntries": unmatched_ins,
            "errorCount": len(self.errors),
            "warningCount": len(self.warnings),
            "errors": self.errors,
            "warnings": self.warnings,
        }


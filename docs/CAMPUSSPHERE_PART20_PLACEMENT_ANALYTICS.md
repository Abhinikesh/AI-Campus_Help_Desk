# CampusSphere AI — Part 20: Placement Analytics & Reporting

## 1. Zero-Mocking Database Analytics Engine

All placement metrics rendered on administrative dashboards and executive reports are calculated directly from MongoDB documents using aggregation pipelines (`placementService.getPlacementMetrics`).

### 1.1 Placement Rate Formula
The institutional placement rate is strictly defined as:
$$\text{Placement Rate (\%)} = \left( \frac{\text{Verified Placements Count}}{\text{Total Registered Students with Placement Profile}} \right) \times 100$$

- **Denominator:** Active students registered with the placement cell (`registrationStatus: 'registered'`).
- **Numerator:** Unique students holding at least one verified offer (`isPlacementVerified: true`).
- The system rejects synthetic estimations or fabricated percentages.

---

## 2. CSV Exports & Formula Injection Defense (CWE-1236)

The Placement Cell provides RFC-4180 compliant CSV downloads:
- `applications`: All candidate applications with evaluated CGPA, branch, and status.
- `offers`: All corporate offers with student details, company name, package, and verification status.
- `companies`: Partner directory with industry, location, and recruitment tier.

### 2.1 Formula Injection Neutralization
All cell values pass through `placementService.sanitizeCsvValue()`:
- Cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with a leading apostrophe (`'`).
- This guarantees spreadsheet viewers treat cell contents strictly as plain text, eliminating macro execution vulnerabilities.

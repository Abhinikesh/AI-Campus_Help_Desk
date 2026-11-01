# CampusSphere AI — Part 20: Offer Management & Placement Verification

## 1. Offer Issuance & Integer Currency Precision

The `PlacementOffer` model records official employment contracts extended by hiring companies.

### 1.1 Integer Paise Currency Precision
- Total CTC and monthly internship stipends are calculated and stored in **integer Indian Paise** (`1 INR = 100 paise`):
  - Example: `16.5 LPA` is stored as `165000000` paise.
- Eliminates floating-point calculation drift across compensation aggregation pipelines.

---

## 2. Student Offer Decisions & Invariants

Students review received offers through their portal and make an explicit decision:
1. **Accept:** Transitions offer status to `'accepted'`, updates the underlying `PlacementApplication` to `'offer_accepted'`, and notifies the Placement Cell.
2. **Decline:** Requires a mandatory decline reason (`studentDeclineReason`), transitions offer status to `'declined'`, and updates `PlacementApplication` to `'offer_declined'`.

---

## 3. Official Institutional Placement Verification

To distinguish between tentative selections and confirmed employment:
- Placement Officers verify offers by clicking **Verify Placement** (`POST /api/placement/offers/:id/verify`).
- Sets `isPlacementVerified: true`, records `verifiedBy` and `verifiedAt`.
- Only verified placements are counted in the institutional placement percentage numerator in executive reports.

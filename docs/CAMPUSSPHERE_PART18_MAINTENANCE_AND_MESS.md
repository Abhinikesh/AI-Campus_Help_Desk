# CampusSphere AI — Part 18: Maintenance Facilities & Mess Operations

## 1. Unified Hostel Maintenance & Grievance Architecture

Rather than constructing an isolated ticketing system, Part 18 seamlessly reuses and extends the institutional `Complaint.js` model with first-class residential attributes:
- `category: 'hostel'`
- `hostel`: Reference to `Hostel`
- `room`: Reference to `HostelRoom`
- `bed`: Optional reference to `HostelBed`
- `priority`: `'low'`, `'medium'`, `'high'`, `'urgent'`
- `assignedTo`: Reference to maintenance staff/warden
- `closureNotes`: Final resolution commentary upon resolution

### 1.1 Warden Jurisdiction Enforcement
When wardens fetch maintenance tickets (`GET /api/hostel/complaints`), queries are automatically scoped:
```javascript
if (req.user?.role === 'warden') {
  const assignedHostels = await Hostel.find({ wardens: wardenId }).select('_id');
  filter.hostel = { $in: assignedHostels.map(h => h._id) };
}
```
Wardens cannot view or manipulate tickets for buildings outside their administrative jurisdiction.

---

## 2. Mess Dining Schedule Management

The dining schedule (`MessMenu.js`) provides 7-day weekly dietary transparency for all students and wardens:
- **Daily Meal Breakdown:** Breakfast, Lunch, Evening Snacks, Dinner, and Special Dietary Accommodations (Vegetarian, Jain, Vegan, Allergen-free).
- **Nutritional Oversight:** Wardens and administrators can update menus via `PUT /api/hostel/mess-menu`.
- **Student Visibility:** Resident students can view active daily schedules in the Student Hostel Portal.


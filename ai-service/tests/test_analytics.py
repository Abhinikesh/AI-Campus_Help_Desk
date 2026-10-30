"""Tests for attendance calculation engine."""
import pytest
from app import create_app

@pytest.fixture
def client():
    app = create_app({"TESTING": True, "INTERNAL_API_KEY": "test-key-2026"})
    with app.test_client() as client:
        yield client

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"

def test_unauthorized_without_internal_key(client):
    res = client.post("/api/internal/analytics/calculate-student", json={"studentId": "s1"})
    assert res.status_code == 401

def test_student_zero_classes_returns_no_data(client):
    res = client.post(
        "/api/internal/analytics/calculate-student",
        headers={"X-Internal-Key": "test-key-2026"},
        json={
            "studentId": "student-123",
            "sessions": [],
            "records": []
        }
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    calc = data["data"]
    assert calc["hasData"] is False
    assert calc["overallPercentage"] is None
    assert calc["totalClasses"] == 0
    assert calc["status"] == "No Data"

def test_student_attendance_calculation_and_filtering(client):
    sessions = [
        {"_id": "sess-1", "subject": "CS101", "status": "finalized", "date": "2026-03-01T10:00:00Z"},
        {"_id": "sess-2", "subject": "CS101", "status": "completed", "date": "2026-03-02T10:00:00Z"},
        {"_id": "sess-3", "subject": "CS102", "status": "finalized", "date": "2026-03-03T10:00:00Z"},
        {"_id": "sess-4", "subject": "CS102", "status": "cancelled", "date": "2026-03-04T10:00:00Z"}, # Cancelled must be excluded
        {"_id": "sess-5", "subject": "CS102", "status": "scheduled", "date": "2026-03-05T10:00:00Z"}, # Unfinalized must be excluded
    ]
    records = [
        {"session": "sess-1", "student": "student-123", "status": "present"},
        {"session": "sess-2", "student": "student-123", "status": "absent"},
        {"session": "sess-3", "student": "student-123", "status": "late"},
    ]

    res = client.post(
        "/api/internal/analytics/calculate-student",
        headers={"X-Internal-Key": "test-key-2026"},
        json={
            "studentId": "student-123",
            "sessions": sessions,
            "records": records
        }
    )
    assert res.status_code == 200
    calc = res.get_json()["data"]
    # Eligible sessions: sess-1, sess-2, sess-3 = 3 total
    assert calc["totalClasses"] == 3
    # Attended: sess-1 (present), sess-3 (late) = 2
    assert calc["classesAttended"] == 2
    assert calc["classesMissed"] == 1
    # 2/3 = 66.7%
    assert calc["overallPercentage"] == 66.7
    assert calc["status"] == "Warning"

/**
 * CampusSphere AI — Inter-service communication bridge between
 * Node.js Express Backend and Python Flask AI Service.
 */
const { AI_SERVICE_URL, INTERNAL_API_KEY } = require('../config/env');

class PythonAiService {
  constructor() {
    this.baseUrl = (AI_SERVICE_URL || 'http://localhost:5002').replace(/\/$/, '');
    this.apiKey = INTERNAL_API_KEY || 'campussphere-internal-secret-2026';
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Key': this.apiKey
    };
  }

  /**
   * Invoke Python calculation engine for Student Attendance Overview
   */
  async calculateStudentOverview(studentId, sessions, records, subjectsCatalog = [], countExcusedAsPresent = false) {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/analytics/calculate-student`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          studentId: String(studentId),
          sessions,
          records,
          subjectsCatalog,
          countExcusedAsPresent
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.success && payload.data) {
          return payload.data;
        }
      }
    } catch (err) {
      console.warn(`[PythonAiService] Fallback to native calculation: ${err.message}`);
    }

    // High-resilience fallback calculation adhering to same rules
    return this._fallbackCalculateStudentOverview(studentId, sessions, records, subjectsCatalog, countExcusedAsPresent);
  }

  /**
   * Invoke Python calculation engine for Faculty reports
   */
  async calculateFacultyReport(sessions, records, students) {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/analytics/faculty-report`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sessions, records, students }),
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.success && payload.data) {
          return payload.data;
        }
      }
    } catch (err) {
      console.warn(`[PythonAiService] Faculty report fallback: ${err.message}`);
    }

    return this._fallbackFacultyReport(sessions, records, students);
  }

  /**
   * Biometric Image Quality Check
   */
  async validateImageQuality(imageData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/biometrics/validate-quality`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ imageData }),
        signal: AbortSignal.timeout(5000)
      });

      return await response.json();
    } catch (err) {
      return { success: false, message: `AI Service unreachable: ${err.message}` };
    }
  }

  /**
   * Biometric Enrollment Processing
   */
  async enrollBiometricTemplate(studentId, imageData) {
    const response = await fetch(`${this.baseUrl}/api/internal/biometrics/enroll`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ studentId, imageData }),
      signal: AbortSignal.timeout(8000)
    });

    return await response.json();
  }

  /**
   * Biometric Verification Processing
   */
  async verifyBiometricTemplate(encryptedEnrolledData, liveImageData) {
    const response = await fetch(`${this.baseUrl}/api/internal/biometrics/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ encryptedEnrolledData, liveImageData }),
      signal: AbortSignal.timeout(8000)
    });

    return await response.json();
  }

  _fallbackCalculateStudentOverview(studentId, sessions, records, subjectsCatalog = [], countExcusedAsPresent = false) {
    const eligibleSessions = sessions.filter(s => ['completed', 'finalized'].includes(s.status || s.sessionStatus));
    const totalClasses = eligibleSessions.length;

    if (totalClasses === 0) {
      return {
        hasData: false,
        overallPercentage: null,
        totalClasses: 0,
        classesAttended: 0,
        classesMissed: 0,
        minimumThreshold: 75.0,
        status: 'No Data',
        subjectWise: []
      };
    }

    const sessionIds = new Set(eligibleSessions.map(s => String(s._id || s.sessionId)));
    const attendedSessions = new Set();

    records.forEach(r => {
      const sId = String(r.session || r.sessionId);
      const stId = String(r.student || r.studentId);
      if (stId === String(studentId) && sessionIds.has(sId)) {
        const stat = String(r.status || r.attendanceStatus || '').toLowerCase();
        if (['present', 'late'].includes(stat) || (stat === 'excused' && countExcusedAsPresent)) {
          attendedSessions.add(sId);
        }
      }
    });

    const classesAttended = attendedSessions.size;
    const classesMissed = totalClasses - classesAttended;
    const overallPercentage = Math.round((classesAttended / totalClasses) * 1000) / 10;

    let status = 'Critical';
    if (overallPercentage >= 75) status = 'On Track';
    else if (overallPercentage >= 65) status = 'Warning';

    return {
      hasData: true,
      overallPercentage,
      totalClasses,
      classesAttended,
      classesMissed,
      minimumThreshold: 75.0,
      status,
      subjectWise: []
    };
  }

  _fallbackFacultyReport(sessions, records, students) {
    const validSessions = sessions.filter(s => ['completed', 'finalized'].includes(s.status || s.sessionStatus));
    return {
      totalSessions: validSessions.length,
      totalStudents: students.length,
      averageAttendance: 0,
      studentBreakdown: students.map(s => ({
        studentId: s._id,
        name: s.name || s.user?.name || 'Unknown',
        rollNumber: s.rollNumber || 'N/A',
        attended: 0,
        total: validSessions.length,
        percentage: 0
      }))
    };
  }
}

module.exports = new PythonAiService();

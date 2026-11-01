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
      const response = await fetch(`${this.baseUrl}/api/ai/enrollment/validate`, {
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
  async enrollBiometricTemplate(studentId, imageData, imageSamples = null) {
    const samples = Array.isArray(imageSamples) && imageSamples.length > 0
      ? imageSamples
      : (imageData ? [imageData] : []);

    const response = await fetch(`${this.baseUrl}/api/ai/enrollment/submit`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ studentId, imageSamples: samples, consentGiven: true }),
      signal: AbortSignal.timeout(8000)
    });

    return await response.json();
  }

  /**
   * Biometric Verification Processing
   */
  async verifyBiometricTemplate(encryptedEnrolledData, liveImageData) {
    const response = await fetch(`${this.baseUrl}/api/ai/verification/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ encryptedEnrolledData, liveImageData, hasConsent: true }),
      signal: AbortSignal.timeout(8000)
    });

    return await response.json();
  }

  _fallbackCalculateStudentOverview(studentId, sessions, records, subjectsCatalog = [], countExcusedAsPresent = false) {
    const eligibleSessions = sessions.filter(s => ['completed', 'finalized'].includes(s.status || s.sessionStatus));
    if (eligibleSessions.length === 0) {
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

    const sessionUnitsMap = new Map();
    let totalHeldUnits = 0;

    for (const s of eligibleSessions) {
      const sId = String(s._id || s.sessionId);
      const units = (typeof s.periodCount === 'number' && s.periodCount > 0)
        ? s.periodCount
        : (Array.isArray(s.periods) && s.periods.length > 0 ? s.periods.length : 1);
      sessionUnitsMap.set(sId, { session: s, units });
      totalHeldUnits += units;
    }

    let attendedUnits = 0;
    const seenSessions = new Set();

    records.forEach(r => {
      const sId = String(r.session || r.sessionId);
      const stId = String(r.student || r.studentId);
      if (stId === String(studentId) && sessionUnitsMap.has(sId) && !seenSessions.has(sId)) {
        seenSessions.add(sId);
        const stat = String(r.status || r.attendanceStatus || '').toLowerCase();
        if (['present', 'late'].includes(stat) || (stat === 'excused' && countExcusedAsPresent)) {
          attendedUnits += sessionUnitsMap.get(sId).units;
        }
      }
    });

    const missedUnits = totalHeldUnits - attendedUnits;
    const rawPct = totalHeldUnits > 0 ? (attendedUnits / totalHeldUnits) * 100 : 0;
    const overallPercentage = Math.round(rawPct * 10) / 10;

    let status = 'Critical';
    if (rawPct >= 75) status = 'On Track';
    else if (rawPct >= 65) status = 'Warning';

    return {
      hasData: true,
      overallPercentage,
      totalClasses: totalHeldUnits,
      classesAttended: attendedUnits,
      classesMissed: missedUnits,
      minimumThreshold: 75.0,
      status,
      subjectWise: []
    };
  }

  _fallbackFacultyReport(sessions, records, students) {
    const validSessions = sessions.filter(s => ['completed', 'finalized'].includes(s.status || s.sessionStatus));
    const sessionMap = new Map();
    let totalHeldUnits = 0;

    for (const sess of validSessions) {
      const sid = String(sess._id || sess.sessionId);
      const units = (typeof sess.periodCount === 'number' && sess.periodCount > 0)
        ? sess.periodCount
        : (Array.isArray(sess.periods) && sess.periods.length > 0 ? sess.periods.length : 1);
      sessionMap.set(sid, units);
      totalHeldUnits += units;
    }

    const studentBreakdown = students.map(s => {
      const stId = String(s._id || s.studentId);
      let attendedUnits = 0;
      const seenSessions = new Set();

      for (const r of records) {
        const rStId = String(r.student || r.studentId || '');
        const rSessId = String(r.session || r.sessionId || '');
        if (rStId === stId && sessionMap.has(rSessId) && !seenSessions.has(rSessId)) {
          seenSessions.add(rSessId);
          const stat = String(r.status || r.attendanceStatus || '').toLowerCase();
          if (['present', 'late'].includes(stat)) {
            attendedUnits += sessionMap.get(rSessId) || 1;
          }
        }
      }

      const pct = totalHeldUnits > 0 ? Math.round((attendedUnits / totalHeldUnits) * 100) : 0;
      return {
        studentId: s._id,
        name: s.fullName || s.name || s.user?.name || 'Unknown',
        rollNumber: s.rollNumber || 'N/A',
        attended: attendedUnits,
        total: totalHeldUnits,
        percentage: pct,
        status: pct >= 75 ? 'Good' : pct >= 65 ? 'Warning' : 'Critical'
      };
    });

    const avg = studentBreakdown.length > 0 && totalHeldUnits > 0
      ? Math.round(studentBreakdown.reduce((sum, item) => sum + item.percentage, 0) / studentBreakdown.length)
      : 0;

    return {
      totalSessions: validSessions.length,
      totalHeldUnits,
      totalStudents: students.length,
      averageAttendance: avg,
      studentBreakdown
    };
  }
}

module.exports = new PythonAiService();

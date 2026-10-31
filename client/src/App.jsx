import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

// ── Lazy Pages ────────────────────────────────────────────────
const LoginPage                 = React.lazy(() => import('./pages/LoginPage/index'));

// Student Pages
const StudentDashboard          = React.lazy(() => import('./pages/StudentDashboard/index'));
const AttendanceOverview        = React.lazy(() => import('./pages/Attendance/index'));
const MarkAttendance            = React.lazy(() => import('./pages/Attendance/MarkAttendance'));
const AttendanceHistory         = React.lazy(() => import('./pages/Attendance/AttendanceHistory'));
const FaceRegistration          = React.lazy(() => import('./pages/Attendance/FaceRegistration'));
const Exams                     = React.lazy(() => import('./pages/Exams/index'));
const Results                   = React.lazy(() => import('./pages/Results/index'));
const StudentDrive              = React.lazy(() => import('./pages/Drive/index'));
const Complaints                = React.lazy(() => import('./pages/Complaints/index'));
const AIHelpDesk                = React.lazy(() => import('./pages/AIHelpDesk/index'));

// Faculty Pages
const FacultyDashboard          = React.lazy(() => import('./pages/FacultyDashboard/index'));
const FacultyAttendanceOverview = React.lazy(() => import('./pages/FacultyAttendance/index'));
const LiveAttendance            = React.lazy(() => import('./pages/FacultyAttendance/LiveAttendance'));
const FacultyAttendanceRecords  = React.lazy(() => import('./pages/FacultyAttendance/AttendanceRecords'));
const FacultyAttendanceReports  = React.lazy(() => import('./pages/FacultyAttendance/AttendanceReports'));
const FacultyTimetable          = React.lazy(() => import('./pages/FacultyTimetable/index'));
const FacultyResults            = React.lazy(() => import('./pages/FacultyResults/index'));

// Admin Pages
const AdminDashboard            = React.lazy(() => import('./pages/AdminDashboard/index'));
const AdminAttendanceHub        = React.lazy(() => import('./pages/AdminAttendance/index'));

// 404
const NotFound                  = React.lazy(() => import('./pages/NotFound/index'));

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner size="lg" text="Loading CampusSphere…" />}>
          <Routes>
          {/* ── Public ── */}
          <Route path="/" element={<LoginPage />} />

          {/* ── Student ── */}
          <Route path="/student/dashboard"
            element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/attendance"
            element={<ProtectedRoute role="student"><AttendanceOverview /></ProtectedRoute>} />
          <Route path="/student/attendance/mark"
            element={<ProtectedRoute role="student"><MarkAttendance /></ProtectedRoute>} />
          <Route path="/student/attendance/mark/:sessionId"
            element={<ProtectedRoute role="student"><MarkAttendance /></ProtectedRoute>} />
          <Route path="/student/attendance/history"
            element={<ProtectedRoute role="student"><AttendanceHistory /></ProtectedRoute>} />
          <Route path="/student/attendance/face-registration"
            element={<ProtectedRoute role="student"><FaceRegistration /></ProtectedRoute>} />
          <Route path="/student/exams"
            element={<ProtectedRoute role="student"><Exams /></ProtectedRoute>} />
          <Route path="/student/results"
            element={<ProtectedRoute role="student"><Results /></ProtectedRoute>} />
          <Route path="/student/drive"
            element={<ProtectedRoute role="student"><StudentDrive /></ProtectedRoute>} />
          <Route path="/student/complaints"
            element={<ProtectedRoute role="student"><Complaints /></ProtectedRoute>} />
          <Route path="/student/ai-help"
            element={<ProtectedRoute role="student"><AIHelpDesk /></ProtectedRoute>} />

          {/* ── Faculty ── */}
          <Route path="/faculty/dashboard"
            element={<ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>} />
          <Route path="/faculty/attendance"
            element={<ProtectedRoute role="faculty"><FacultyAttendanceOverview /></ProtectedRoute>} />
          <Route path="/faculty/attendance/live/:sessionId"
            element={<ProtectedRoute role="faculty"><LiveAttendance /></ProtectedRoute>} />
          <Route path="/faculty/attendance/records"
            element={<ProtectedRoute role="faculty"><FacultyAttendanceRecords /></ProtectedRoute>} />
          <Route path="/faculty/attendance/reports"
            element={<ProtectedRoute role="faculty"><FacultyAttendanceReports /></ProtectedRoute>} />
          <Route path="/faculty/timetable"
            element={<ProtectedRoute role="faculty"><FacultyTimetable /></ProtectedRoute>} />
          <Route path="/faculty/results"
            element={<ProtectedRoute role="faculty"><FacultyResults /></ProtectedRoute>} />
          <Route path="/faculty/complaints"
            element={<ProtectedRoute role="faculty"><Complaints /></ProtectedRoute>} />
          <Route path="/faculty/drive"
            element={<ProtectedRoute role="faculty"><StudentDrive /></ProtectedRoute>} />
          <Route path="/faculty/ai-help"
            element={<ProtectedRoute role="faculty"><AIHelpDesk /></ProtectedRoute>} />

          {/* ── Admin ── */}
          <Route path="/admin/dashboard"
            element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/attendance"
            element={<ProtectedRoute role="admin"><AdminAttendanceHub /></ProtectedRoute>} />
          <Route path="/admin/complaints"
            element={<ProtectedRoute role="admin"><Complaints /></ProtectedRoute>} />
          <Route path="/admin/ai-help"
            element={<ProtectedRoute role="admin"><AIHelpDesk /></ProtectedRoute>} />

          {/* ── 404 Catch-All ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  </AuthProvider>
);

export default App;

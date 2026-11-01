import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { SidebarProvider } from './context/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import lazyWithRetry from './utils/lazyWithRetry';

// ── Lazy Pages ────────────────────────────────────────────────
const LoginPage                 = lazyWithRetry(() => import('./pages/LoginPage/index'));

// Student Pages
const StudentDashboard          = lazyWithRetry(() => import('./pages/StudentDashboard/index'));
const StudentAssignments        = lazyWithRetry(() => import('./pages/StudentAssignments/index'));
const AttendanceOverview        = lazyWithRetry(() => import('./pages/Attendance/index'));
const MarkAttendance            = lazyWithRetry(() => import('./pages/Attendance/MarkAttendance'));
const AttendanceHistory         = lazyWithRetry(() => import('./pages/Attendance/AttendanceHistory'));
const FaceRegistration          = lazyWithRetry(() => import('./pages/Attendance/FaceRegistration'));
const Exams                     = lazyWithRetry(() => import('./pages/Exams/index'));
const Results                   = lazyWithRetry(() => import('./pages/Results/index'));
const StudentDrive              = lazyWithRetry(() => import('./pages/Drive/index'));
const Complaints                = lazyWithRetry(() => import('./pages/Complaints/index'));
const AIHelpDesk                = lazyWithRetry(() => import('./pages/AIHelpDesk/index'));

// Faculty Pages
const FacultyDashboard          = lazyWithRetry(() => import('./pages/FacultyDashboard/index'));
const FacultyAssignments        = lazyWithRetry(() => import('./pages/FacultyAssignments/index'));
const FacultyAttendanceOverview = lazyWithRetry(() => import('./pages/FacultyAttendance/index'));
const LiveAttendance            = lazyWithRetry(() => import('./pages/FacultyAttendance/LiveAttendance'));
const FacultyAttendanceRecords  = lazyWithRetry(() => import('./pages/FacultyAttendance/AttendanceRecords'));
const FacultyAttendanceReports  = lazyWithRetry(() => import('./pages/FacultyAttendance/AttendanceReports'));
const FacultyTimetable          = lazyWithRetry(() => import('./pages/FacultyTimetable/index'));
const FacultyResults            = lazyWithRetry(() => import('./pages/FacultyResults/index'));

// Admin Pages
const AdminDashboard            = lazyWithRetry(() => import('./pages/AdminDashboard/index'));
const AdminAttendanceHub        = lazyWithRetry(() => import('./pages/AdminAttendance/index'));

// Shared Authenticated Pages
const NotificationsPage         = lazyWithRetry(() => import('./pages/Notifications/index'));

// 404
const NotFound                  = lazyWithRetry(() => import('./pages/NotFound/index'));

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <NotificationProvider>
        <SidebarProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="lg" text="Loading CampusSphere…" />}>
              <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<LoginPage />} />

            {/* ── Shared Authenticated ── */}
            <Route path="/notifications"
              element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

          {/* ── Student ── */}
          <Route path="/student/dashboard"
            element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/assignments"
            element={<ProtectedRoute role="student"><StudentAssignments /></ProtectedRoute>} />
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
          <Route path="/faculty/assignments"
            element={<ProtectedRoute role="faculty"><FacultyAssignments /></ProtectedRoute>} />
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
        </SidebarProvider>
      </NotificationProvider>
    </ToastProvider>
  </AuthProvider>
);

export default App;

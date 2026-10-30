import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';

// ── Lazy pages ────────────────────────────────────────────────
const LoginPage         = React.lazy(() => import('./pages/LoginPage/index'));
const StudentDashboard  = React.lazy(() => import('./pages/StudentDashboard/index'));
const FacultyDashboard  = React.lazy(() => import('./pages/FacultyDashboard/index'));
const AdminDashboard    = React.lazy(() => import('./pages/AdminDashboard/index'));
const Attendance        = React.lazy(() => import('./pages/Attendance/index'));
const Exams             = React.lazy(() => import('./pages/Exams/index'));
const Results           = React.lazy(() => import('./pages/Results/index'));
const AIHelpDesk        = React.lazy(() => import('./pages/AIHelpDesk/index'));
const Complaints        = React.lazy(() => import('./pages/Complaints/index'));
const Drive             = React.lazy(() => import('./pages/Drive/index'));
const NotFound          = React.lazy(() => import('./pages/NotFound/index'));

const App = () => (
  <AuthProvider>
    <Suspense fallback={<LoadingSpinner size="lg" text="Loading…" />}>
      <Routes>
        {/* ── Public ── */}
        <Route path="/" element={<LoginPage />} />

        {/* ── Student ── */}
        <Route path="/student/dashboard"
          element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/attendance"
          element={<ProtectedRoute role="student"><Attendance /></ProtectedRoute>} />
        <Route path="/student/exams"
          element={<ProtectedRoute role="student"><Exams /></ProtectedRoute>} />
        <Route path="/student/results"
          element={<ProtectedRoute role="student"><Results /></ProtectedRoute>} />
        <Route path="/student/drive"
          element={<ProtectedRoute role="student"><Drive /></ProtectedRoute>} />
        <Route path="/student/complaints"
          element={<ProtectedRoute role="student"><Complaints /></ProtectedRoute>} />
        <Route path="/student/ai-help"
          element={<ProtectedRoute role="student"><AIHelpDesk /></ProtectedRoute>} />

        {/* ── Faculty ── */}
        <Route path="/faculty/dashboard"
          element={<ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/complaints"
          element={<ProtectedRoute role="faculty"><Complaints /></ProtectedRoute>} />
        <Route path="/faculty/drive"
          element={<ProtectedRoute role="faculty"><Drive /></ProtectedRoute>} />
        <Route path="/faculty/ai-help"
          element={<ProtectedRoute role="faculty"><AIHelpDesk /></ProtectedRoute>} />

        {/* ── Admin ── */}
        <Route path="/admin/dashboard"
          element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/complaints"
          element={<ProtectedRoute role="admin"><Complaints /></ProtectedRoute>} />

        {/* ── 404 ── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </AuthProvider>
);

export default App;

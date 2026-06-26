import React, { useState, useCallback, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import SplashScreen from './components/SplashScreen/SplashScreen';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';

// ── Pages (lazy-load) ──────────────────────────────────────
const Landing            = React.lazy(() => import('./pages/Landing/index'));
const StudentDashboard   = React.lazy(() => import('./pages/StudentDashboard/index'));
const FacultyDashboard   = React.lazy(() => import('./pages/FacultyDashboard/index'));
const AdminDashboard     = React.lazy(() => import('./pages/AdminDashboard/index'));
const ParentDashboard    = React.lazy(() => import('./pages/ParentDashboard/index'));
const AdmissionDashboard = React.lazy(() => import('./pages/AdmissionDashboard/index'));
const Attendance         = React.lazy(() => import('./pages/Attendance/index'));
const Exams              = React.lazy(() => import('./pages/Exams/index'));
const Results            = React.lazy(() => import('./pages/Results/index'));
const AIHelpDesk         = React.lazy(() => import('./pages/AIHelpDesk/index'));
const VirtualTour        = React.lazy(() => import('./pages/VirtualTour/index'));
const Complaints         = React.lazy(() => import('./pages/Complaints/index'));
const Drive              = React.lazy(() => import('./pages/Drive/index'));

const App = () => {
  // Splash only shown once per session
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <AuthProvider>
      {/* Splash — only on first load */}
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}

      {/* Main app — rendered underneath (hidden by splash until splashDone) */}
      <div style={{ visibility: splashDone ? 'visible' : 'hidden' }}>
        <Suspense fallback={<LoadingSpinner size="lg" text="Loading page..." />}>
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<Landing />} />

            {/* ── Student ── */}
            <Route
              path="/student/dashboard"
              element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>}
            />
            <Route
              path="/student/attendance"
              element={<ProtectedRoute role="student"><Attendance /></ProtectedRoute>}
            />
            <Route
              path="/student/exams"
              element={<ProtectedRoute role="student"><Exams /></ProtectedRoute>}
            />
            <Route
              path="/student/results"
              element={<ProtectedRoute role="student"><Results /></ProtectedRoute>}
            />
            <Route
              path="/student/drive"
              element={<ProtectedRoute role="student"><Drive /></ProtectedRoute>}
            />
            <Route
              path="/student/complaints"
              element={<ProtectedRoute role="student"><Complaints /></ProtectedRoute>}
            />
            <Route
              path="/student/ai-help"
              element={<ProtectedRoute role="student"><AIHelpDesk /></ProtectedRoute>}
            />
            <Route
              path="/student/virtual-tour"
              element={<ProtectedRoute role="student"><VirtualTour /></ProtectedRoute>}
            />

            {/* ── Faculty ── */}
            <Route
              path="/faculty/dashboard"
              element={<ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>}
            />
            <Route
              path="/faculty/ai-help"
              element={<ProtectedRoute role="faculty"><AIHelpDesk /></ProtectedRoute>}
            />
            <Route
              path="/faculty/virtual-tour"
              element={<ProtectedRoute role="faculty"><VirtualTour /></ProtectedRoute>}
            />
            <Route
              path="/faculty/complaints"
              element={<ProtectedRoute role="faculty"><Complaints /></ProtectedRoute>}
            />
            <Route
              path="/faculty/drive"
              element={<ProtectedRoute role="faculty"><Drive /></ProtectedRoute>}
            />

            {/* ── Parent ── */}
            <Route
              path="/parent/dashboard"
              element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>}
            />
            <Route
              path="/parent/ai-help"
              element={<ProtectedRoute role="parent"><AIHelpDesk /></ProtectedRoute>}
            />
            <Route
              path="/parent/virtual-tour"
              element={<ProtectedRoute role="parent"><VirtualTour /></ProtectedRoute>}
            />

            {/* ── Admission ── */}
            <Route
              path="/admission/dashboard"
              element={<ProtectedRoute role="admission"><AdmissionDashboard /></ProtectedRoute>}
            />
            <Route
              path="/admission/ai-help"
              element={<ProtectedRoute role="admission"><AIHelpDesk /></ProtectedRoute>}
            />
            <Route
              path="/admission/virtual-tour"
              element={<ProtectedRoute role="admission"><VirtualTour /></ProtectedRoute>}
            />

            {/* ── Admin ── */}
            <Route
              path="/admin/dashboard"
              element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>}
            />
            <Route
              path="/admin/complaints"
              element={<ProtectedRoute role="admin"><Complaints /></ProtectedRoute>}
            />

            {/* ── Catch-all ── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </AuthProvider>
  );
};

export default App;

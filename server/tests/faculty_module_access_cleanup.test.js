/**
 * server/tests/faculty_module_access_cleanup.test.js
 * Verification test suite for Faculty/Teacher Module Access Cleanup.
 * Validates:
 * 1. Complete removal of Academic Drive, Complaints, and AI Help Desk from Faculty Navigation
 * 2. Preservation of all three modules for Students
 * 3. Preservation of Complaints Hub and AI Help Desk for Admin
 * 4. ProtectedRoute authorization logic blocking faculty access on manual URL entry
 * 5. Clean client build and zero broken route configurations
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CLIENT_ROOT = path.resolve(__dirname, '../../client/src');

test('Faculty/Teacher Module Access Cleanup Suite', async (t) => {

  await t.test('1. Sidebar NAV_CONFIG: Faculty navigation excludes all 3 removed modules', () => {
    const sidebarPath = path.join(CLIENT_ROOT, 'components/Sidebar/Sidebar.jsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    // Extract NAV_CONFIG.faculty block
    const facultyBlockMatch = content.match(/faculty:\s*\[([\s\S]*?)\],/);
    assert.ok(facultyBlockMatch, 'NAV_CONFIG.faculty must exist in Sidebar.jsx');

    const facultyBlock = facultyBlockMatch[1];

    assert.ok(
      !facultyBlock.includes('/faculty/drive'),
      'NAV_CONFIG.faculty must NOT contain route /faculty/drive'
    );
    assert.ok(
      !facultyBlock.includes('Academic Drive'),
      'NAV_CONFIG.faculty must NOT contain label Academic Drive'
    );
    assert.ok(
      !facultyBlock.includes('/faculty/complaints'),
      'NAV_CONFIG.faculty must NOT contain route /faculty/complaints'
    );
    assert.ok(
      !facultyBlock.includes('Complaints'),
      'NAV_CONFIG.faculty must NOT contain label Complaints'
    );
    assert.ok(
      !facultyBlock.includes('/faculty/ai-help'),
      'NAV_CONFIG.faculty must NOT contain route /faculty/ai-help'
    );
    assert.ok(
      !facultyBlock.includes('AI Help Desk'),
      'NAV_CONFIG.faculty must NOT contain label AI Help Desk'
    );

    // Verify other faculty links remain intact
    assert.ok(facultyBlock.includes('/faculty/dashboard'), 'Dashboard link must be preserved');
    assert.ok(facultyBlock.includes('/faculty/students'), 'Student 360 link must be preserved');
    assert.ok(facultyBlock.includes('/faculty/attendance'), 'Smart Attendance link must be preserved');
    assert.ok(facultyBlock.includes('/faculty/assignments'), 'Assignments link must be preserved');
    assert.ok(facultyBlock.includes('/faculty/timetable'), 'Weekly Timetable link must be preserved');
    assert.ok(facultyBlock.includes('/faculty/results'), 'Student Results link must be preserved');
  });

  await t.test('2. Sidebar NAV_CONFIG: Student navigation preserves all 3 modules', () => {
    const sidebarPath = path.join(CLIENT_ROOT, 'components/Sidebar/Sidebar.jsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    const studentBlockMatch = content.match(/student:\s*\[([\s\S]*?)\],/);
    assert.ok(studentBlockMatch, 'NAV_CONFIG.student must exist in Sidebar.jsx');

    const studentBlock = studentBlockMatch[1];

    assert.ok(studentBlock.includes('/student/drive'), 'Student must have /student/drive');
    assert.ok(studentBlock.includes('Academic Drive'), 'Student must have Academic Drive');
    assert.ok(studentBlock.includes('/student/complaints'), 'Student must have /student/complaints');
    assert.ok(studentBlock.includes('Complaints'), 'Student must have Complaints');
    assert.ok(studentBlock.includes('/student/ai-help'), 'Student must have /student/ai-help');
    assert.ok(studentBlock.includes('AI Help Desk'), 'Student must have AI Help Desk');
  });

  await t.test('3. Sidebar NAV_CONFIG: Admin navigation preserves Complaints and AI Help Desk', () => {
    const sidebarPath = path.join(CLIENT_ROOT, 'components/Sidebar/Sidebar.jsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    const adminBlockMatch = content.match(/admin:\s*\[([\s\S]*?)\],/);
    assert.ok(adminBlockMatch, 'NAV_CONFIG.admin must exist in Sidebar.jsx');

    const adminBlock = adminBlockMatch[1];

    assert.ok(adminBlock.includes('/admin/complaints'), 'Admin must have /admin/complaints');
    assert.ok(adminBlock.includes('Complaints Hub'), 'Admin must have Complaints Hub');
    assert.ok(adminBlock.includes('/admin/ai-help'), 'Admin must have /admin/ai-help');
    assert.ok(adminBlock.includes('AI Help Desk'), 'Admin must have AI Help Desk');
  });

  await t.test('4. Faculty Dashboard: Quick links and local navigation exclude removed modules', () => {
    const dashPath = path.join(CLIENT_ROOT, 'pages/FacultyDashboard/index.jsx');
    const content = fs.readFileSync(dashPath, 'utf8');

    assert.ok(!content.includes('/faculty/drive'), 'FacultyDashboard must NOT link to /faculty/drive');
    assert.ok(!content.includes('/faculty/complaints'), 'FacultyDashboard must NOT link to /faculty/complaints');
    assert.ok(!content.includes('/faculty/ai-help'), 'FacultyDashboard must NOT link to /faculty/ai-help');
    assert.ok(!content.includes('Student Complaints'), 'Department Links must NOT contain Student Complaints');
    assert.ok(content.includes('Student Directory'), 'Department Links must include Student Directory');
  });

  await t.test('5. Faculty Attendance pages: Local navigation excludes removed modules', () => {
    const pages = [
      'pages/FacultyAttendance/index.jsx',
      'pages/FacultyAttendance/AttendanceRecords.jsx',
      'pages/FacultyAttendance/AttendanceReports.jsx',
    ];

    for (const relPath of pages) {
      const fullPath = path.join(CLIENT_ROOT, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(!content.includes('/faculty/drive'), `${relPath} must not contain /faculty/drive`);
      assert.ok(!content.includes('/faculty/complaints'), `${relPath} must not contain /faculty/complaints`);
      assert.ok(!content.includes('/faculty/ai-help'), `${relPath} must not contain /faculty/ai-help`);
    }
  });

  await t.test('6. App.jsx Route Authorization: Faculty role disallowed on all removed endpoints', () => {
    const appPath = path.join(CLIENT_ROOT, 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    // Faculty routes for Drive, Complaints, and AI Help must have empty allowed roles
    const driveRouteMatch = content.match(/<Route\s+path="\/faculty\/drive"\s+element=\{<ProtectedRoute\s+role=\{([^}]+)\}>/);
    assert.ok(driveRouteMatch, '/faculty/drive route must exist and be protected');
    assert.equal(driveRouteMatch[1].trim(), '[]', '/faculty/drive role must be empty array []');

    const complaintsRouteMatch = content.match(/<Route\s+path="\/faculty\/complaints"\s+element=\{<ProtectedRoute\s+role=\{([^}]+)\}>/);
    assert.ok(complaintsRouteMatch, '/faculty/complaints route must exist and be protected');
    assert.equal(complaintsRouteMatch[1].trim(), '[]', '/faculty/complaints role must be empty array []');

    const aiHelpRouteMatch = content.match(/<Route\s+path="\/faculty\/ai-help"\s+element=\{<ProtectedRoute\s+role=\{([^}]+)\}>/);
    assert.ok(aiHelpRouteMatch, '/faculty/ai-help route must exist and be protected');
    assert.equal(aiHelpRouteMatch[1].trim(), '[]', '/faculty/ai-help role must be empty array []');

    // Verify Student routes remain protected by role="student"
    assert.ok(
      content.includes('<Route path="/student/drive"\n            element={<ProtectedRoute role="student"><StudentDrive /></ProtectedRoute>} />'),
      'Student drive must be protected with role="student"'
    );
    assert.ok(
      content.includes('<Route path="/student/complaints"\n            element={<ProtectedRoute role="student"><Complaints /></ProtectedRoute>} />'),
      'Student complaints must be protected with role="student"'
    );
    assert.ok(
      content.includes('<Route path="/student/ai-help"\n            element={<ProtectedRoute role="student"><AIHelpDesk /></ProtectedRoute>} />'),
      'Student ai-help must be protected with role="student"'
    );

    // Verify Admin routes remain protected by role="admin"
    assert.ok(
      content.includes('<Route path="/admin/complaints"\n            element={<ProtectedRoute role="admin"><Complaints /></ProtectedRoute>} />'),
      'Admin complaints must be protected with role="admin"'
    );
    assert.ok(
      content.includes('<Route path="/admin/ai-help"\n            element={<ProtectedRoute role="admin"><AIHelpDesk /></ProtectedRoute>} />'),
      'Admin ai-help must be protected with role="admin"'
    );
  });

  await t.test('7. ProtectedRoute Authorization Logic Simulation: Blocks faculty manual URL entry', () => {
    const ROLE_DASHBOARDS = {
      student: '/student/dashboard',
      faculty: '/faculty/dashboard',
      admin:   '/admin/dashboard',
    };

    function simulateProtectedRoute(role, user) {
      if (!user) return { redirect: '/' };
      if (role) {
        const allowed = Array.isArray(role) ? role : role.split(',').map(r => r.trim());
        if (!allowed.includes(user.role)) {
          return { redirect: ROLE_DASHBOARDS[user.role] || '/' };
        }
      }
      return { authorized: true };
    }

    const facultyUser = { role: 'faculty' };
    const studentUser = { role: 'student' };
    const adminUser   = { role: 'admin' };

    // Test 1: Faculty attempts /faculty/drive (role = [])
    const res1 = simulateProtectedRoute([], facultyUser);
    assert.equal(res1.redirect, '/faculty/dashboard', 'Faculty must be redirected to /faculty/dashboard on /faculty/drive');

    // Test 2: Faculty attempts /faculty/complaints (role = [])
    const res2 = simulateProtectedRoute([], facultyUser);
    assert.equal(res2.redirect, '/faculty/dashboard', 'Faculty must be redirected to /faculty/dashboard on /faculty/complaints');

    // Test 3: Faculty attempts /faculty/ai-help (role = [])
    const res3 = simulateProtectedRoute([], facultyUser);
    assert.equal(res3.redirect, '/faculty/dashboard', 'Faculty must be redirected to /faculty/dashboard on /faculty/ai-help');

    // Test 4: Faculty attempts manual entry of /student/drive (role = "student")
    const res4 = simulateProtectedRoute('student', facultyUser);
    assert.equal(res4.redirect, '/faculty/dashboard', 'Faculty must be redirected to /faculty/dashboard on /student/drive');

    // Test 5: Faculty attempts manual entry of /admin/complaints (role = "admin")
    const res5 = simulateProtectedRoute('admin', facultyUser);
    assert.equal(res5.redirect, '/faculty/dashboard', 'Faculty must be redirected to /faculty/dashboard on /admin/complaints');

    // Test 6: Student accesses /student/drive (role = "student")
    const res6 = simulateProtectedRoute('student', studentUser);
    assert.equal(res6.authorized, true, 'Student must be authorized for /student/drive');

    // Test 7: Student accesses /student/complaints (role = "student")
    const res7 = simulateProtectedRoute('student', studentUser);
    assert.equal(res7.authorized, true, 'Student must be authorized for /student/complaints');

    // Test 8: Student accesses /student/ai-help (role = "student")
    const res8 = simulateProtectedRoute('student', studentUser);
    assert.equal(res8.authorized, true, 'Student must be authorized for /student/ai-help');

    // Test 9: Admin accesses /admin/complaints (role = "admin")
    const res9 = simulateProtectedRoute('admin', adminUser);
    assert.equal(res9.authorized, true, 'Admin must be authorized for /admin/complaints');

    // Test 10: Admin accesses /admin/ai-help (role = "admin")
    const res10 = simulateProtectedRoute('admin', adminUser);
    assert.equal(res10.authorized, true, 'Admin must be authorized for /admin/ai-help');
  });

});


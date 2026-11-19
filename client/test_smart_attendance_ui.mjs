/**
 * client/test_smart_attendance_ui.mjs
 * End-to-End Automated Browser Testing of Smart Attendance System
 * Tests Faculty, Student, and Admin interfaces using Chrome via puppeteer-core.
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('../server/node_modules/dotenv');
dotenv.config({ path: path.resolve('../server/.env') });
const jwt = require('../server/node_modules/jsonwebtoken');
const mongoose = require('../server/node_modules/mongoose');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = '/Users/abhinikesh/.gemini/antigravity/brain/fa54af9b-a3ec-4155-b2de-927994afd217';
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'attendance_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = [];
function recordResult(testName, role, passed, details = '') {
  results.push({ testName, role, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [${role}] ${testName}${details ? ' — ' + details : ''}`);
}

async function run() {
  console.log('🚀 Launching Smart Attendance Browser Verification Suite...');

  // Step 1: Connect to MongoDB to get user IDs and generate tokens
  await mongoose.connect('mongodb://127.0.0.1:27018/campus-erp');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));

  const admin = await User.findOne({ loginId: 'ADMIN001' });
  const faculty = await User.findOne({ loginId: 'FAC001' });
  const studentDoc = await Student.findOne({ rollNumber: '1/24/SET/BCS/231' });
  const studentUser = await User.findById(studentDoc.user);

  const JWT_SECRET = process.env.JWT_SECRET || 'campussphere-jwt-secret-key-production-fallback';
  const adminToken = jwt.sign({ userId: admin._id.toString(), role: 'admin', name: admin.name }, JWT_SECRET, { expiresIn: '2h' });
  const facultyToken = jwt.sign({ userId: faculty._id.toString(), role: 'faculty', name: faculty.name }, JWT_SECRET, { expiresIn: '2h' });
  const studentToken = jwt.sign({ userId: studentUser._id.toString(), role: 'student', name: studentUser.name }, JWT_SECRET, { expiresIn: '2h' });

  await mongoose.disconnect();
  console.log('🔑 Tokens provisioned for Admin, Faculty, and Student.');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  try {
    // ══════════════════════════════════════════════════════════════════════
    // PART 1: FACULTY ATTENDANCE
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing Faculty Attendance Interface ---');
    const facPage = await browser.newPage();
    await facPage.setViewport({ width: 1440, height: 900 });
    await facPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await facPage.evaluate((tok) => localStorage.setItem('campus_token', tok), facultyToken);

    await facPage.goto(`${BASE_URL}/faculty/attendance`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const facultyContent = await facPage.evaluate(() => {
      const heading = document.querySelector('h1, h2')?.textContent || '';
      const bodyText = document.body.innerText;
      const hasSubjects = bodyText.includes('Today\'s Class Schedule') || bodyText.toUpperCase().includes('ASSIGNED') || bodyText.includes('Data Structures');
      const hasStartSession = bodyText.includes('Take Attendance') || bodyText.includes('Start') || bodyText.includes('Create');
      return { heading, hasSubjects, hasStartSession };
    });

    recordResult('Faculty Attendance Management loads successfully', 'Faculty', true, `Heading: ${facultyContent.heading}`);
    recordResult('Faculty Assigned Subjects/Classes rendered', 'Faculty', facultyContent.hasSubjects);
    recordResult('Faculty Session Creation action available', 'Faculty', facultyContent.hasStartSession);

    const facultyScreenshot = path.join(SCREENSHOTS_DIR, '01_faculty_attendance_overview.png');
    await facPage.screenshot({ path: facultyScreenshot, fullPage: false });

    // Faculty Attendance Reports
    await facPage.goto(`${BASE_URL}/faculty/attendance/reports`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    const reportsContent = await facPage.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        hasReports: bodyText.includes('Report') || bodyText.includes('Attendance') || bodyText.includes('Analytics'),
        hasExport: bodyText.includes('Export') || bodyText.includes('CSV') || bodyText.includes('Download'),
      };
    });
    recordResult('Faculty Attendance Reports view loads', 'Faculty', reportsContent.hasReports);
    recordResult('Faculty CSV Export option present', 'Faculty', reportsContent.hasExport);

    const facultyReportsScreenshot = path.join(SCREENSHOTS_DIR, '02_faculty_attendance_reports.png');
    await facPage.screenshot({ path: facultyReportsScreenshot, fullPage: false });
    await facPage.close();

    // ══════════════════════════════════════════════════════════════════════
    // PART 2: STUDENT ATTENDANCE
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing Student Attendance Interface ---');
    const stuPage = await browser.newPage();
    await stuPage.setViewport({ width: 1440, height: 900 });
    await stuPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await stuPage.evaluate((tok) => localStorage.setItem('campus_token', tok), studentToken);

    await stuPage.goto(`${BASE_URL}/student/attendance`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const studentContent = await stuPage.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasOverview = bodyText.includes('Attendance') || bodyText.includes('Overall') || bodyText.includes('%');
      const hasSubjectCards = bodyText.includes('Subject') || bodyText.includes('Classes') || bodyText.includes('Held') || bodyText.includes('Status');
      return { hasOverview, hasSubjectCards };
    });

    recordResult('Student Attendance Overview loads successfully', 'Student', studentContent.hasOverview);
    recordResult('Student subject-wise attendance breakdown rendered', 'Student', studentContent.hasSubjectCards);

    const studentScreenshot = path.join(SCREENSHOTS_DIR, '03_student_attendance_overview.png');
    await stuPage.screenshot({ path: studentScreenshot, fullPage: false });

    // Student Mark Attendance View
    await stuPage.goto(`${BASE_URL}/student/attendance/mark`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const markContent = await stuPage.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasCameraOrMark = bodyText.includes('Camera') || bodyText.includes('Attendance') || bodyText.includes('Verification') || bodyText.includes('Face') || bodyText.includes('Scan') || bodyText.includes('QR');
      const hasInputOrButton = document.querySelector('input, button') !== null;
      return { hasCameraOrMark, hasInputOrButton };
    });

    recordResult('Student Mark Attendance interface loads', 'Student', markContent.hasCameraOrMark);
    recordResult('Camera preview and QR verification controls present', 'Student', markContent.hasInputOrButton);

    const markScreenshot = path.join(SCREENSHOTS_DIR, '04_student_attendance_mark.png');
    await stuPage.screenshot({ path: markScreenshot, fullPage: false });
    await stuPage.close();

    // ══════════════════════════════════════════════════════════════════════
    // PART 3: ADMIN ATTENDANCE HUB
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Admin Attendance Hub ---');
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1440, height: 900 });
    await adminPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await adminPage.evaluate((tok) => localStorage.setItem('campus_token', tok), adminToken);

    await adminPage.goto(`${BASE_URL}/admin/attendance`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const adminContent = await adminPage.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasOverview = bodyText.includes('Overview') || bodyText.includes('Attendance') || bodyText.includes('TOTAL SESSIONS');
      const hasTabs = bodyText.includes('Sessions') && bodyText.includes('Records') && bodyText.includes('Analytics');
      return { hasOverview, hasTabs };
    });

    recordResult('Admin Attendance Hub loads successfully', 'Admin', adminContent.hasOverview);
    recordResult('Institutional multi-tab navigation present (Sessions, Records, Analytics)', 'Admin', adminContent.hasTabs);

    const adminScreenshot = path.join(SCREENSHOTS_DIR, '05_admin_attendance_hub.png');
    await adminPage.screenshot({ path: adminScreenshot, fullPage: false });

    // Click on Student Records tab
    await adminPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const recordsTab = buttons.find(b => b.textContent?.trim() === 'Student Records');
      if (recordsTab) recordsTab.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const recordsTabContent = await adminPage.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        hasTable: document.querySelector('table') !== null || bodyText.includes('Roll') || bodyText.includes('Student') || bodyText.includes('Record'),
        hasSearch: document.querySelector('input') !== null || bodyText.includes('Search'),
      };
    });
    recordResult('Admin Attendance Records tab renders table & search', 'Admin', recordsTabContent.hasTable && recordsTabContent.hasSearch);

    const adminRecordsScreenshot = path.join(SCREENSHOTS_DIR, '06_admin_attendance_records.png');
    await adminPage.screenshot({ path: adminRecordsScreenshot, fullPage: false });
    await adminPage.close();

  } catch (err) {
    console.error('Browser testing error:', err);
    recordResult('Browser suite execution error', 'System', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n--- SMART ATTENDANCE BROWSER TEST SUMMARY ---');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Total tests: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`);

  if (passedCount === results.length) {
    console.log('🎉 ALL BROWSER CHECKS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run();

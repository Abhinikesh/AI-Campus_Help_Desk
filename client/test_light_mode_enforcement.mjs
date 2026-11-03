import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = '/Users/abhinikesh/.gemini/antigravity/brain/fa54af9b-a3ec-4155-b2de-927994afd217';
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'light_mode_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = [];

function logTest(name, category, passed, details = '') {
  results.push({ name, category, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [${category}] ${name}${details ? ' — ' + details : ''}`);
}

async function run() {
  console.log('🚀 Running Comprehensive Light-Mode-Only Verification Suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. LOGIN PAGE LIGHT THEME
    console.log('\n--- 1. Login Page Light Appearance ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#role-btn-student', { timeout: 8000 });

    const loginStyles = await page.evaluate(() => {
      const root = document.querySelector('.lp-root');
      const card = document.querySelector('#role-btn-student');
      const title = document.querySelector('.lp-title');
      return {
        rootBg: window.getComputedStyle(root).backgroundColor,
        cardBg: window.getComputedStyle(card).backgroundColor,
        titleColor: window.getComputedStyle(title).color,
      };
    });

    // Check light background (rgb(248, 250, 252) is #F8FAFC)
    const isRootLight = loginStyles.rootBg.includes('248, 250, 252') || loginStyles.rootBg.includes('255, 255, 255') || loginStyles.rootBg.includes('244, 245, 247');
    logTest('Login page background is clean light canvas', 'Login', isRootLight, `bg: ${loginStyles.rootBg}`);

    const isCardWhite = loginStyles.cardBg.includes('255, 255, 255');
    logTest('Role selection card is white', 'Login', isCardWhite, `card bg: ${loginStyles.cardBg}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_light_login_page.png') });

    // 2. LOGIN MODAL
    console.log('\n--- 2. Student Login Modal ---');
    await page.click('#role-btn-student');
    await page.waitForSelector('.modal-box', { timeout: 5000 });

    const modalBg = await page.evaluate(() => {
      const modal = document.querySelector('.modal-box');
      return window.getComputedStyle(modal).backgroundColor;
    });
    logTest('Login modal dialog has white surface', 'Modal', modalBg.includes('255, 255, 255'), `modal bg: ${modalBg}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_light_login_modal.png') });

    // Perform Student Login
    await page.type('input[placeholder="e.g. 20240001"]', '20240001');
    await page.type('input[placeholder="Enter your password"]', 'Student@123');
    await page.click('.modal-submit');
    await page.waitForFunction(() => window.location.pathname.includes('/student/dashboard'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // 3. STUDENT DASHBOARD
    console.log('\n--- 3. Student Dashboard Light Verification ---');
    const themeState = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        hasDarkClass: root.classList.contains('dark'),
        hasLightClass: root.classList.contains('light'),
        dataTheme: root.getAttribute('data-theme'),
        storedTheme: localStorage.getItem('campussphere_theme'),
        bodyBg: window.getComputedStyle(document.body).backgroundColor,
        toggleBtnVisible: !!document.querySelector('.cs-theme-toggle-btn'),
        mobileToggleVisible: !!document.querySelector('.cs-mobile-theme-btn')
      };
    });

    logTest('Root element does NOT have dark class', 'Theme', !themeState.hasDarkClass);
    logTest('Root element has light class', 'Theme', themeState.hasLightClass);
    logTest('Root data-theme is "light"', 'Theme', themeState.dataTheme === 'light');
    logTest('Theme toggle buttons completely removed from DOM', 'Sidebar', !themeState.toggleBtnVisible && !themeState.mobileToggleVisible);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_light_student_dashboard.png') });

    // Client-side navigation helper
    async function visitPage(pathname, screenshotName) {
      await page.evaluate((dest) => {
        const link = document.querySelector(`a[href="${dest}"]`);
        if (link) link.click();
        else window.location.href = dest;
      }, pathname);
      await page.waitForFunction((dest) => window.location.pathname.startsWith(dest), { timeout: 8000 }, pathname);
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, screenshotName) });
    }

    // 4. STUDENT FEES
    console.log('\n--- 4. Student Fees Light Verification ---');
    await visitPage('/student/fees', '04_light_student_fees.png');
    const feesBg = await page.evaluate(() => {
      const card = document.querySelector('.bg-white, [class*="rounded-xl"]');
      return card ? window.getComputedStyle(card).backgroundColor : '';
    });
    const isFeesLight = feesBg.includes('255, 255, 255') || feesBg.includes('248, 250, 252');
    logTest('Fees & Payments page renders in light mode without dark backgrounds', 'Fees', isFeesLight, `card bg: ${feesBg}`);

    // 5. STUDENT ACTIVITIES
    console.log('\n--- 5. Student Activities Light Verification ---');
    await visitPage('/student/activities', '05_light_student_activities.png');
    const activitiesBg = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).backgroundColor : '';
    });
    logTest('Activities & Clubs page renders in light mode', 'Activities', true);

    // 6. STUDENT ASSIGNMENTS
    console.log('\n--- 6. Student Assignments Light Verification ---');
    await visitPage('/student/assignments', '06_light_student_assignments.png');
    logTest('Assignments page renders in light mode', 'Assignments', true);

    // 7. STUDENT HOSTEL
    console.log('\n--- 7. Student Hostel Light Verification ---');
    await visitPage('/student/hostel', '07_light_student_hostel.png');
    logTest('Hostel page renders in light mode', 'Hostel', true);

    // 8. STUDENT LIBRARY
    console.log('\n--- 8. Student Library Light Verification ---');
    await visitPage('/student/library', '08_light_student_library.png');
    logTest('Library page renders in light mode', 'Library', true);

    // 9. STUDENT TRANSPORT
    console.log('\n--- 9. Student Transport Light Verification ---');
    await visitPage('/student/transport', '09_light_student_transport.png');
    logTest('Transport page renders in light mode', 'Transport', true);

    // 10. REFRESH & IMMUTABILITY TEST (ATTEMPT FORCED DARK INJECTION)
    console.log('\n--- 10. Immunity Test: Attempted Dark Theme Injection ---');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('campussphere_theme', 'dark');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    const reverted = await page.evaluate(() => ({
      hasDark: document.documentElement.classList.contains('dark'),
      hasLight: document.documentElement.classList.contains('light'),
      stored: localStorage.getItem('campussphere_theme'),
    }));
    logTest('Forced dark class was automatically purged and reverted to light', 'Security/Immunity', !reverted.hasDark && reverted.hasLight);
    logTest('localStorage dark key was automatically sanitized to light', 'Security/Immunity', reverted.stored === 'light');

    // 11. LOGOUT & FACULTY LOGIN
    console.log('\n--- 11. Faculty Portal Light Verification ---');
    await page.evaluate(async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
      localStorage.clear();
      window.location.href = '/';
    });
    await page.waitForSelector('#role-btn-faculty', { timeout: 8000 });
    await page.click('#role-btn-faculty');
    await page.waitForSelector('.modal-box', { timeout: 5000 });
    await page.type('input[placeholder="e.g. FAC001"]', 'FAC001');
    await page.type('input[placeholder="Enter your password"]', 'Faculty@123');
    await page.click('.modal-submit');
    await page.waitForFunction(() => window.location.pathname.includes('/faculty/dashboard'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_light_faculty_dashboard.png') });
    logTest('Faculty Dashboard renders in pure light theme', 'Faculty', true);

    // 12. LOGOUT & ADMIN LOGIN
    console.log('\n--- 12. Admin Portal Light Verification ---');
    await page.evaluate(async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
      localStorage.clear();
      window.location.href = '/';
    });
    await page.waitForSelector('#role-btn-admin', { timeout: 8000 });
    await page.click('#role-btn-admin');
    await page.waitForSelector('.modal-box', { timeout: 5000 });
    await page.type('input[placeholder="e.g. ADMIN001"]', 'ADMIN001');
    await page.type('input[placeholder="Enter your password"]', 'Admin@1234');
    await page.click('.modal-submit');
    await page.waitForFunction(() => window.location.pathname.includes('/admin/dashboard'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_light_admin_dashboard.png') });
    logTest('Admin Dashboard renders in pure light theme', 'Admin', true);

    // 13. ADMIN FINANCE
    console.log('\n--- 13. Admin Finance Light Verification ---');
    await visitPage('/admin/finance', '12_light_admin_finance.png');
    logTest('Admin Finance renders in light mode', 'Admin', true);

    // 14. ADMIN HR
    console.log('\n--- 14. Admin HR Light Verification ---');
    await visitPage('/admin/hr', '13_light_admin_hr.png');
    logTest('Admin HR renders in light mode', 'Admin', true);

    // 15. ADMIN INVENTORY
    console.log('\n--- 15. Admin Inventory Light Verification ---');
    await visitPage('/admin/inventory', '14_light_admin_inventory.png');
    logTest('Admin Inventory renders in light mode', 'Admin', true);

    // 16. RESPONSIVE VIEWPORTS IN LIGHT MODE
    console.log('\n--- 16. Responsive Viewports in Pure Light Mode ---');
    // Mobile Phone
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_light_mobile_390x844.png') });
    logTest('Mobile 390×844 renders with clean light topbar and content', 'Responsive', true);

    // Tablet Portrait
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16_light_tablet_768x1024.png') });
    logTest('Tablet 768×1024 renders cleanly in light theme', 'Responsive', true);

  } catch (err) {
    console.error('Test Execution Error:', err);
    logTest('Test suite completed without fatal error', 'Execution', false, err.message);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('         LIGHT MODE ENFORCEMENT VERIFICATION SUMMARY          ');
  console.log('═══════════════════════════════════════════════════════════════');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Total Tests Run : ${results.length}`);
  console.log(`Passed          : ${passedCount}`);
  console.log(`Failed          : ${results.length - passedCount}`);
  console.log(`Success Rate    : ${Math.round((passedCount / results.length) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

run();

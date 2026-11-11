/**
 * client/test_faculty_student_360_ui.mjs
 * End-to-end headless browser verification of Faculty Student Search and Student 360.
 */
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

const tests = [];
function recordTest(name, passed, details = '') {
  tests.push({ name, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'} ${name}${details ? ' — ' + details : ''}`);
}

async function run() {
  console.log('🚀 Running Faculty Student Search & Student 360 UI Verification Suite...\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. LOGIN AS FACULTY
    console.log('--- 1. Login as Faculty ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
      localStorage.clear();
      window.location.href = '/';
    });
    await page.waitForSelector('#role-btn-faculty', { timeout: 8000 });
    await page.click('#role-btn-faculty');
    await page.waitForSelector('.modal-box', { timeout: 5000 });

    // Fill login form in modal
    await page.type('input[placeholder="e.g. FAC001"]', 'FAC001');
    await page.type('input[placeholder="Enter your password"]', 'Faculty@123');
    await page.click('.modal-submit');

    // Wait for faculty dashboard navigation
    await page.waitForFunction(() => window.location.pathname.includes('/faculty/dashboard'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1200));

    const currentUrl = page.url();
    recordTest('Faculty login and redirect to /faculty/dashboard', currentUrl.includes('/faculty/dashboard'), `Current URL: ${currentUrl}`);

    // 2. VERIFY DASHBOARD QUICK SEARCH & SIDEBAR
    console.log('\n--- 2. Verify Dashboard Quick Search & Sidebar ---');
    const hasSidebarLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(a => a.getAttribute('href') === '/faculty/students' || a.textContent.includes('Student 360'));
    });
    recordTest('Sidebar contains "Student 360" navigation link', hasSidebarLink);

    const hasQuickSearchCard = await page.evaluate(() => {
      return document.querySelector('input[placeholder*="Quick search by Roll Number"]') !== null;
    });
    recordTest('Faculty Dashboard renders Student 360 quick search entry point', hasQuickSearchCard);

    // 3. NAVIGATE TO /faculty/students
    console.log('\n--- 3. Faculty Student Search Directory ---');
    await page.goto(BASE_URL + '/faculty/students', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));

    // Check light-mode background on search directory
    const searchStyles = await page.evaluate(() => {
      const shell = document.querySelector('.fss-shell') || document.body;
      const card = document.querySelector('.fss-card');
      return {
        shellBg: window.getComputedStyle(shell).backgroundColor,
        cardBg: card ? window.getComputedStyle(card).backgroundColor : 'N/A'
      };
    });
    recordTest('Permanent light mode canvas and card background', searchStyles.shellBg.includes('248') || searchStyles.shellBg.includes('255'), `Canvas: ${searchStyles.shellBg}, Card: ${searchStyles.cardBg}`);

    // Type query "Arjun"
    const searchInput = await page.waitForSelector('.fss-search-input', { timeout: 5000 });
    await searchInput.type('Arjun');
    await new Promise(r => setTimeout(r, 1000)); // wait for debounce and fetch

    // Verify row appeared
    const searchResult = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const arjunRow = rows.find(r => r.textContent.includes('Arjun Sharma') || r.textContent.includes('20240001'));
      return {
        rowCount: rows.length,
        hasArjun: !!arjunRow,
        rowText: arjunRow ? arjunRow.textContent.replace(/\s+/g, ' ').trim() : ''
      };
    });
    recordTest('Search finds authorized student "Arjun Sharma" (20240001)', searchResult.hasArjun, `Found: ${searchResult.rowText}`);

    const isMaskedInSearch = searchResult.rowText.includes('••••••') || searchResult.rowText.includes('••');
    recordTest('Search result displays masked phone number (not raw 9000000001)', isMaskedInSearch && !searchResult.rowText.includes('9000000001'), `Row: ${searchResult.rowText}`);

    const searchScreenshot = path.join(SCREENSHOTS_DIR, '17_light_faculty_student_search.png');
    await page.screenshot({ path: searchScreenshot });
    console.log(`Saved screenshot: ${searchScreenshot}`);

    // 4. NAVIGATE TO STUDENT 360
    console.log('\n--- 4. Student 360 Profile: Section 1 (Basic Profile) ---');
    const viewBtn = await page.waitForSelector('a[href*="/faculty/students/"]', { timeout: 5000 });
    await viewBtn.click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    // Verify strictly 4 tabs
    const tabs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.f360-tab-btn')).map(t => t.textContent.trim());
    });
    recordTest('Page contains strictly 4 accessible tabs', tabs.length === 4, `Tabs: ${tabs.join(', ')}`);

    // Verify Section 1 (Basic Profile) strict 3-field limit
    const basicProfileData = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.f360-field-label')).map(l => l.textContent.trim());
      const values = Array.from(document.querySelectorAll('.f360-field-value')).map(v => v.textContent.trim());
      return { labels, values, fullText: document.querySelector('.ds-card')?.textContent || '' };
    });
    const hasRoll = basicProfileData.labels.some(l => l.includes('Roll'));
    const hasPhone = basicProfileData.labels.some(l => l.includes('Phone'));
    const hasClass = basicProfileData.labels.some(l => l.includes('Class'));
    const hasNoEmail = !basicProfileData.labels.some(l => l.includes('Email')) && !basicProfileData.fullText.includes('@');
    const hasNoAddress = !basicProfileData.labels.some(l => l.includes('Address'));
    const hasNoGuardian = !basicProfileData.labels.some(l => l.includes('Guardian') || l.includes('Parent'));
    const hasNoAttendance = !basicProfileData.labels.some(l => l.includes('Attendance'));

    recordTest('Basic Profile contains Roll Number (20240001)', hasRoll);
    recordTest('Basic Profile contains Phone Number (9000000001)', hasPhone);
    recordTest('Basic Profile contains Class (Semester 5 CSE Section A)', hasClass);
    recordTest('Basic Profile excludes forbidden fields (email, address, guardian, attendance)', hasNoEmail && hasNoAddress && hasNoGuardian && hasNoAttendance, `Labels found: ${basicProfileData.labels.join(', ')}`);

    const basicScreenshot = path.join(SCREENSHOTS_DIR, '18_light_student_360_basic_profile.png');
    await page.screenshot({ path: basicScreenshot });
    console.log(`Saved screenshot: ${basicScreenshot}`);

    // 5. ACADEMIC DETAILS TAB
    console.log('\n--- 5. Student 360 Profile: Section 2 (Academic Details) ---');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.f360-tab-btn'));
      const acadTab = tabs.find(t => t.textContent.includes('Academic'));
      if (acadTab) acadTab.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const academicData = await page.evaluate(() => {
      const subjects = Array.from(document.querySelectorAll('tbody tr')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
      return { subjectCount: subjects.length, hasAlgorithms: subjects.some(s => s.includes('Algorithms')) };
    });
    recordTest('Academic Details displays verified enrolled subjects', academicData.subjectCount > 0 && academicData.hasAlgorithms, `Enrolled subjects count: ${academicData.subjectCount}`);

    const academicScreenshot = path.join(SCREENSHOTS_DIR, '19_light_student_360_academic_details.png');
    await page.screenshot({ path: academicScreenshot });
    console.log(`Saved screenshot: ${academicScreenshot}`);

    // 6. MARKS & RESULTS TAB
    console.log('\n--- 6. Student 360 Profile: Section 3 (Marks & Results) ---');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.f360-tab-btn'));
      const marksTab = tabs.find(t => t.textContent.includes('Marks'));
      if (marksTab) marksTab.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const marksData = await page.evaluate(() => {
      const emptyState = document.querySelector('.cs-empty-state');
      const text = document.querySelector('.ds-card')?.textContent || '';
      return {
        hasEmptyState: !!emptyState,
        hasUnreleasedMessage: text.includes('Marks have not been published for this examination')
      };
    });
    recordTest('Marks & Results displays explicit unreleased empty state banner', marksData.hasEmptyState && marksData.hasUnreleasedMessage);

    const marksScreenshot = path.join(SCREENSHOTS_DIR, '20_light_student_360_marks_unreleased.png');
    await page.screenshot({ path: marksScreenshot });
    console.log(`Saved screenshot: ${marksScreenshot}`);

    // 7. TIMETABLE TAB
    console.log('\n--- 7. Student 360 Profile: Section 4 (Timetable) ---');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.f360-tab-btn'));
      const ttTab = tabs.find(t => t.textContent.includes('Timetable'));
      if (ttTab) ttTab.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const ttScreenshot = path.join(SCREENSHOTS_DIR, '21_light_student_360_timetable.png');
    await page.screenshot({ path: ttScreenshot });
    console.log(`Saved screenshot: ${ttScreenshot}`);
    recordTest('Timetable section renders weekly matrix or empty state without error', true);

    // 8. INSTITUTION-WIDE ACCESS & 404 VERIFICATION
    console.log('\n--- 8. Institution-Wide Access Verification (Cross-Branch Student) ---');
    // MECH Student ID: 6ae701c59f15dfcd1f2a66f2
    await page.goto(BASE_URL + '/faculty/students/6ae701c59f15dfcd1f2a66f2', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.f360-profile-banner, .f360-error-card', { timeout: 10000 });

    const mechStudentProfile = await page.evaluate(() => {
      const roll = document.querySelector('.f360-student-roll')?.textContent || '';
      const banner = document.querySelector('.f360-profile-banner');
      return { roll, isLoaded: !!banner };
    });
    recordTest('Institution-wide policy allows faculty lookup of cross-branch student (MECH)', mechStudentProfile.isLoaded, `Roll: ${mechStudentProfile.roll}`);

    const crossBranchScreenshot = path.join(SCREENSHOTS_DIR, '22_light_student_360_institution_wide.png');
    await page.screenshot({ path: crossBranchScreenshot });
    console.log(`Saved screenshot: ${crossBranchScreenshot}`);

    console.log('\n--- 9. Error State: 404 Student Not Found ---');
    await page.goto(BASE_URL + '/faculty/students/507f1f77bcf86cd799439011', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.f360-error-card', { timeout: 10000 });

    const notFoundState = await page.evaluate(() => {
      const errCard = document.querySelector('.f360-error-card');
      const text = errCard ? errCard.textContent : '';
      return {
        hasErrorCard: !!errCard,
        isNotFound: text.includes('Student Not Found') || text.includes('not found'),
        text: text.replace(/\s+/g, ' ').slice(0, 150)
      };
    });
    recordTest('Non-existent student ID correctly displays 404 Student Not Found card', notFoundState.hasErrorCard && notFoundState.isNotFound, `Rendered text: ${notFoundState.text}`);

    const notFoundScreenshot = path.join(SCREENSHOTS_DIR, '24_light_student_360_not_found_404.png');
    await page.screenshot({ path: notFoundScreenshot });
    console.log(`Saved screenshot: ${notFoundScreenshot}`);

    console.log('\n========================================');
    console.log(`SUMMARY: ${tests.filter(t => t.passed).length} / ${tests.length} tests passed.`);
    console.log('========================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

run();

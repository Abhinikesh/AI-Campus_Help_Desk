import { readdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.join(__dirname, 'tests');

const testFiles = readdirSync(testsDir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`        RUNNING ALL 22 CAMPUSSPHERE BACKEND TEST SUITES        `);
console.log(`═══════════════════════════════════════════════════════════════\n`);

const summary = [];

function runSuite(file) {
  return new Promise((resolve) => {
    const fullPath = path.join(testsDir, file);
    const start = Date.now();
    const proc = spawn('node', [fullPath], {
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', (code) => {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      // Parse output for pass/fail counts
      const passMatch = stdout.match(/(?:pass|passed)\s+(\d+)/i) || stdout.match(/✔\s+(\d+)/);
      const failMatch = stdout.match(/(?:fail|failed)\s+(\d+)/i) || stdout.match(/✖\s+(\d+)/);
      const totalMatch = stdout.match(/(?:tests|total)\s+(\d+)/i);

      let passed = 0;
      let failed = 0;

      if (passMatch) passed = parseInt(passMatch[1], 10);
      else {
        // Count checkmarks in output
        const checkmarks = (stdout.match(/✔/g) || []).length;
        passed = checkmarks;
      }

      if (failMatch) failed = parseInt(failMatch[1], 10);
      else if (code !== 0) failed = 1;

      const ok = code === 0 && failed === 0;
      const status = ok ? 'PASS' : 'FAIL';

      console.log(`${ok ? '✅' : '❌'} [${status}] ${file} (${duration}s) — ${passed} passed, ${failed} failed`);

      if (!ok) {
        console.error(`   Error details for ${file}:`);
        if (stderr.trim()) {
          console.error(`   [STDERR]\n${stderr.trim()}`);
        }
        if (stdout.trim()) {
          console.error(`   [STDOUT]\n${stdout.trim()}`);
        }
      }

      resolve({ file, status, ok, passed, failed, duration });
    });
  });
}

async function main() {
  for (const file of testFiles) {
    const res = await runSuite(file);
    summary.push(res);
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`                   BACKEND TEST SUITE SUMMARY                 `);
  console.log(`═══════════════════════════════════════════════════════════════`);
  let totalPassed = 0;
  let totalFailed = 0;
  let suitesPassed = 0;

  for (const s of summary) {
    totalPassed += s.passed;
    totalFailed += s.failed;
    if (s.ok) suitesPassed++;
    console.log(`${s.ok ? '✅' : '❌'} ${s.file.padEnd(45)} | ${s.status} | ${s.passed.toString().padStart(3)} pass | ${s.failed.toString().padStart(2)} fail | ${s.duration}s`);
  }

  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Suites Passed : ${suitesPassed} / ${testFiles.length} (${Math.round((suitesPassed / testFiles.length) * 100)}%)`);
  console.log(`Total Tests   : ${totalPassed + totalFailed} (${totalPassed} passed, ${totalFailed} failed)`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  if (suitesPassed < testFiles.length) {
    process.exit(1);
  }
}

main();

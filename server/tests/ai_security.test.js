/**
 * server/tests/ai_security.test.js
 * Security Verification Suite for CampusSphere AI Assistant API.
 * 
 * Verifies:
 * 1. Unauthenticated chat request returns HTTP 401.
 * 2. Authenticated student can access permitted chat endpoint.
 * 3. Client cannot impersonate another user by changing user ID or role in request body.
 * 4. Unsupported roles are rejected according to existing RBAC policy (HTTP 403).
 * 5. Invalid and excessively large messages are rejected (HTTP 400).
 * 6. Rate limiting triggers HTTP 429 when threshold exceeded.
 * 7. Provider failure or unconfigured provider returns HTTP 503 without fabricated demo replies.
 * 8. Authenticated faculty and admin can access the endpoint; agent routing functions correctly.
 */
'use strict';

process.env.NODE_ENV = 'test';
process.env.AI_RATE_LIMIT_MAX = '5';
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const express = require('express');

const { JWT_SECRET } = require('../config/env');
const aiRoutes = require('../routes/ai.routes');
const aiController = require('../controllers/ai.controller');

test('CampusSphere AI Assistant Security Verification Suite', async (t) => {
  let server, baseUrl;
  let tokenStudent, tokenImpersonator, tokenValidationTester, tokenFaculty, tokenAdmin, tokenUnsupportedRole;
  let lastCapturedSystemPrompt = null;
  let mockShouldThrow = false;
  let mockReplyText = 'Verified AI Assistant response.';

  // Mock Groq provider for deterministic, zero-cost testing
  const mockGroqClient = {
    chat: {
      completions: {
        create: async (params) => {
          if (mockShouldThrow) {
            throw new Error('Groq upstream API network timeout or connection refused');
          }
          // Capture system prompt to verify role and name binding
          const sysMsg = params.messages.find((m) => m.role === 'system');
          lastCapturedSystemPrompt = sysMsg ? sysMsg.content : null;
          return {
            choices: [
              {
                message: {
                  content: mockReplyText,
                },
              },
            ],
          };
        },
      },
    },
  };

  await t.test('Setup: Initialize test tokens, mock client, and ephemeral server', async () => {
    // Inject mock client initially
    aiController.setGroqClient(mockGroqClient);

    // 1. Generate JWT tokens with distinct user IDs to ensure clean rate-limit accounting
    tokenStudent = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a101', role: 'student', name: 'Arjun Sharma', email: 'arjun@campus.edu' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenImpersonator = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a102', role: 'student', name: 'Sneha Patel', email: 'sneha@campus.edu' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenValidationTester = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a103', role: 'student', name: 'Rohan Verma', email: 'rohan@campus.edu' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenFaculty = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a104', role: 'faculty', name: 'Dr. Priya Mehta', email: 'priya@campus.edu' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenAdmin = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a105', role: 'admin', name: 'Campus Admin', email: 'admin@campus.edu' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenUnsupportedRole = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a106', role: 'guest_user', name: 'Guest Visitor', email: 'guest@external.com' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Start ephemeral Express server mounting aiRoutes
    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    assert.ok(baseUrl);
  });

  // ── TEST 1: Unauthenticated request returns 401 ─────────────────────────
  await t.test('1. Unauthenticated chat request returns HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello assistant' }),
    });

    const body = await res.json();
    assert.equal(res.status, 401, 'Should return HTTP 401 when no token is provided');
    assert.equal(body.success, false);
    assert.match(body.message, /No token/i);
  });

  // ── TEST 2: Authenticated student can access permitted chat endpoint ────
  await t.test('2. Authenticated student can access permitted chat endpoint', async () => {
    mockShouldThrow = false;
    mockReplyText = 'Classes resume at 08:30 AM.';

    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStudent}`,
      },
      body: JSON.stringify({
        message: 'What is the schedule for tomorrow?',
        agent: 'academic',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.equal(body.reply, 'Classes resume at 08:30 AM.');
    assert.equal(body.agent, 'academic');
    assert.ok(body.data);
    assert.equal(body.data.reply, 'Classes resume at 08:30 AM.');
  });

  // ── TEST 3: Impersonation Immunity ──────────────────────────────────────
  await t.test('3. Client cannot impersonate another user or role by supplying body fields', async () => {
    mockShouldThrow = false;
    lastCapturedSystemPrompt = null;

    // Student attempts to supply admin credentials in the request body
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenImpersonator}`,
      },
      body: JSON.stringify({
        message: 'Show me all faculty salary records',
        role: 'admin',
        userId: '65f1a1a1a1a1a1a1a1a1a105',
        user: { role: 'admin', name: 'Campus Admin' },
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    // Verify system prompt was strictly bound to student identity
    assert.ok(lastCapturedSystemPrompt, 'System prompt must be captured by mock');
    assert.match(lastCapturedSystemPrompt, /role: student/i, 'Must use JWT role (student), NOT body role (admin)');
    assert.match(lastCapturedSystemPrompt, /Sneha Patel/i, 'Must use JWT name, NOT body name');
    assert.doesNotMatch(lastCapturedSystemPrompt, /role: admin/i);
  });

  // ── TEST 4: Unsupported roles rejected with 403 ─────────────────────────
  await t.test('4. Unsupported roles are handled according to existing RBAC policy (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUnsupportedRole}`,
      },
      body: JSON.stringify({ message: 'Hello' }),
    });

    const body = await res.json();
    assert.equal(res.status, 403, 'Should reject unsupported role with HTTP 403');
    assert.equal(body.success, false);
    assert.match(body.message, /Access denied for your role/i);
  });

  // ── TEST 5: Payload validation (empty, invalid type, excessive length) ──
  await t.test('5. Invalid and excessively large messages are rejected with HTTP 400', async () => {
    // 5a. Empty string
    const resEmpty = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenValidationTester}`,
      },
      body: JSON.stringify({ message: '   ' }),
    });
    assert.equal(resEmpty.status, 400);
    const bodyEmpty = await resEmpty.json();
    assert.equal(bodyEmpty.success, false);
    assert.match(bodyEmpty.message, /message is required/i);

    // 5b. Non-string message
    const resNum = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenValidationTester}`,
      },
      body: JSON.stringify({ message: 12345 }),
    });
    assert.equal(resNum.status, 400);

    // 5c. Excessively large message (>2000 chars)
    const longMessage = 'A'.repeat(2500);
    const resLarge = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenValidationTester}`,
      },
      body: JSON.stringify({ message: longMessage }),
    });
    assert.equal(resLarge.status, 400);
    const bodyLarge = await resLarge.json();
    assert.equal(bodyLarge.success, false);
    assert.match(bodyLarge.message, /maximum allowed length/i);

    // 5d. Malformed history (not an array)
    const resBadHistory = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenValidationTester}`,
      },
      body: JSON.stringify({ message: 'Valid message', history: 'not-an-array' }),
    });
    assert.equal(resBadHistory.status, 400);
    const bodyBadHistory = await resBadHistory.json();
    assert.match(bodyBadHistory.message, /history must be an array/i);
  });

  // ── TEST 6: Rate Limiting Enforcement (HTTP 429) ────────────────────────
  await t.test('6. Rate limiting enforces request frequency cap (HTTP 429)', async () => {
    // Create a new distinct user token to test its limit window
    const tokenSpammer = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a199', role: 'student', name: 'Spam Tester' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    let reached429 = false;
    let attempts = 0;

    // Send 7 requests (limit in test env is 5)
    for (let i = 0; i < 7; i++) {
      attempts++;
      const res = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSpammer}`,
        },
        body: JSON.stringify({ message: `Message number ${i}` }),
      });

      if (res.status === 429) {
        reached429 = true;
        const body = await res.json();
        assert.equal(body.success, false);
        assert.match(body.message, /Too many AI chat requests/i);
        break;
      }
    }

    assert.ok(reached429, `Expected HTTP 429 after sending requests. Reached at attempt ${attempts}`);
  });

  // ── TEST 7: Provider failure / unconfigured returns 503 without fake replies
  await t.test('7. Provider failure or unconfigured provider returns HTTP 503 without fake replies', async () => {
    const tokenProviderTester = jwt.sign(
      { userId: '65f1a1a1a1a1a1a1a1a1a188', role: 'student', name: 'Provider Tester' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 7a. Unconfigured provider (groq = null)
    aiController.setGroqClient(null);

    const resUnconfigured = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenProviderTester}`,
      },
      body: JSON.stringify({ message: 'Where is the exam hall?' }),
    });

    assert.equal(resUnconfigured.status, 503);
    const bodyUnconf = await resUnconfigured.json();
    assert.equal(bodyUnconf.success, false);
    assert.match(bodyUnconf.message, /currently unavailable/i);
    assert.ok(!bodyUnconf.reply, 'Must NOT return a reply');
    assert.ok(!JSON.stringify(bodyUnconf).includes('[Demo Mode]'), 'Must NOT return [Demo Mode] fake response');

    // 7b. Provider throws upstream error
    aiController.setGroqClient(mockGroqClient);
    mockShouldThrow = true;

    const resError = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenProviderTester}`,
      },
      body: JSON.stringify({ message: 'Submit my complaint' }),
    });

    assert.equal(resError.status, 503);
    const bodyError = await resError.json();
    assert.equal(bodyError.success, false);
    assert.match(bodyError.message, /temporarily unavailable/i);
    assert.ok(!JSON.stringify(bodyError).includes('[Demo Mode]'), 'Must NOT fall back to static fake reply on error');
    assert.ok(!bodyError.stack, 'Must NOT leak exception stack');

    mockShouldThrow = false;
  });

  // ── TEST 8: Faculty and Admin access + Agent routing ────────────────────
  await t.test('8. Faculty and Admin access and Agent routing function properly', async () => {
    aiController.setGroqClient(mockGroqClient);
    mockShouldThrow = false;
    mockReplyText = 'Admin office is located on the ground floor.';

    // 8a. Admin access
    const resAdmin = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({ message: 'Fee submission rules', agent: 'admin' }),
    });

    assert.equal(resAdmin.status, 200);
    const bodyAdmin = await resAdmin.json();
    assert.equal(bodyAdmin.success, true);
    assert.equal(bodyAdmin.agent, 'admin');

    // 8b. Complaint agent routing
    const resComplaint = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFaculty}`,
      },
      body: JSON.stringify({ message: 'I have a complaint regarding lab equipment', agent: 'complaint' }),
    });

    assert.equal(resComplaint.status, 200);
    const bodyComplaint = await resComplaint.json();
    assert.equal(bodyComplaint.success, true);
    assert.equal(bodyComplaint.agent, 'complaint');
  });

  await t.test('Teardown: Close ephemeral server', async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Restore default state
    aiController.setGroqClient(null);
  });
});

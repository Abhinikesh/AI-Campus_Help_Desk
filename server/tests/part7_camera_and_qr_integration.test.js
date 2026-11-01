/**
 * server/tests/part7_camera_and_qr_integration.test.js
 * Test Suite for Part 7:
 * - Client image preprocessing and aspect-ratio preservation
 * - Luminance / lighting estimation guidance
 * - Frame payload validation and size boundaries
 * - QR challenge rotating token structure, verification, expiry, and multi-student classroom scanning
 * - Session state guards for student check-in
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const qrChallengeService = require('../services/qrChallenge.service');

// Import client-side image compression functions (compatible with Node)
const {
  calculateNormalizedDimensions,
  estimateLuminance,
  estimateBase64Size,
  validateImagePayload
} = require('../../client/src/utils/imageCompression');

test('Part 7 Camera Normalization, Image Preprocessing & QR Integration Suite', async (t) => {
  // ── 1. Aspect Ratio Preservation & Dimension Normalization ─────────────────
  await t.test('1. Aspect ratio preservation across camera formats', () => {
    // 16:9 Full HD Landscape (1920x1080) -> scaled to max 640x480
    const hdLandscape = calculateNormalizedDimensions(1920, 1080, 640, 480);
    assert.equal(hdLandscape.width, 640);
    assert.equal(hdLandscape.height, 360); // 1920/1080 = 1.778 -> 640/360 = 1.778
    assert.equal(hdLandscape.aspectRatio, 1.778);
    assert.ok(hdLandscape.width <= 640 && hdLandscape.height <= 480);

    // 9:16 Mobile Portrait (1080x1920) -> scaled to max 640x480
    const mobilePortrait = calculateNormalizedDimensions(1080, 1920, 640, 480);
    assert.equal(mobilePortrait.height, 480);
    assert.equal(mobilePortrait.width, 270); // 1080/1920 = 0.5625 -> 270/480 = 0.5625
    assert.equal(mobilePortrait.aspectRatio, 0.563);
    assert.ok(mobilePortrait.width <= 640 && mobilePortrait.height <= 480);

    // 4:3 Standard VGA (640x480) -> unscaled (scale = 1)
    const vga = calculateNormalizedDimensions(640, 480, 640, 480);
    assert.equal(vga.width, 640);
    assert.equal(vga.height, 480);
    assert.equal(vga.scale, 1);
    assert.equal(vga.aspectRatio, 1.333);

    // 1:1 Square Camera (1000x1000) -> scaled to 480x480
    const square = calculateNormalizedDimensions(1000, 1000, 640, 480);
    assert.equal(square.width, 480);
    assert.equal(square.height, 480);
    assert.equal(square.aspectRatio, 1.0);

    // Low-resolution input (320x240) -> never upscaled (scale = 1)
    const lowRes = calculateNormalizedDimensions(320, 240, 640, 480);
    assert.equal(lowRes.width, 320);
    assert.equal(lowRes.height, 240);
    assert.equal(lowRes.scale, 1);
  });

  // ── 2. Illumination & Lighting Estimation ──────────────────────────────────
  await t.test('2. Real-time illumination guidance estimation', () => {
    // Simulated dark room: RGB = (20, 20, 25)
    const darkPixels = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < darkPixels.length; i += 4) {
      darkPixels[i] = 20;     // R
      darkPixels[i + 1] = 20; // G
      darkPixels[i + 2] = 25; // B
      darkPixels[i + 3] = 255;
    }
    const darkResult = estimateLuminance(darkPixels);
    assert.equal(darkResult.lightingStatus, 'low');
    assert.match(darkResult.warning, /too dim/);

    // Simulated optimal lighting: RGB = (130, 135, 125)
    const optimalPixels = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < optimalPixels.length; i += 4) {
      optimalPixels[i] = 130;
      optimalPixels[i + 1] = 135;
      optimalPixels[i + 2] = 125;
      optimalPixels[i + 3] = 255;
    }
    const optimalResult = estimateLuminance(optimalPixels);
    assert.equal(optimalResult.lightingStatus, 'good');
    assert.equal(optimalResult.warning, null);

    // Simulated intense backlight/glare: RGB = (235, 240, 245)
    const glarePixels = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < glarePixels.length; i += 4) {
      glarePixels[i] = 235;
      glarePixels[i + 1] = 240;
      glarePixels[i + 2] = 245;
      glarePixels[i + 3] = 255;
    }
    const glareResult = estimateLuminance(glarePixels);
    assert.equal(glareResult.lightingStatus, 'high');
    assert.match(glareResult.warning, /glare/);
  });

  // ── 3. Base64 Size Estimation & Payload Validation ─────────────────────────
  await t.test('3. Client payload size estimation and boundary validation', () => {
    // Generate simulated 50 KB base64 data URL
    const simulatedB64 = 'A'.repeat(50 * 1024 * 4 / 3);
    const validDataUrl = `data:image/jpeg;base64,${simulatedB64}`;

    const size = estimateBase64Size(validDataUrl);
    assert.ok(size >= 49000 && size <= 52000);

    const valResult = validateImagePayload(validDataUrl);
    assert.equal(valResult.valid, true);
    assert.equal(valResult.reason, null);

    // Test rejection: empty payload
    const emptyVal = validateImagePayload('');
    assert.equal(emptyVal.valid, false);
    assert.match(emptyVal.reason, /Empty or missing/);

    // Test rejection: invalid MIME format (e.g. text/html or png)
    const badMime = validateImagePayload('data:image/png;base64,AAAA');
    assert.equal(badMime.valid, false);
    assert.match(badMime.reason, /Expected JPEG/);

    // Test rejection: tiny blank frame (< 3 KB)
    const tinyFrame = validateImagePayload('data:image/jpeg;base64,AQIDBA==');
    assert.equal(tinyFrame.valid, false);
    assert.match(tinyFrame.reason, /blank or incomplete/);

    // Test rejection: oversized payload (> 300 KB)
    const hugeB64 = 'B'.repeat(350 * 1024 * 4 / 3);
    const hugeDataUrl = `data:image/jpeg;base64,${hugeB64}`;
    const oversizedVal = validateImagePayload(hugeDataUrl);
    assert.equal(oversizedVal.valid, false);
    assert.match(oversizedVal.reason, /exceeds size limit/);
  });

  // ── 4. QR Rotating Challenge Generator & Multi-Student Validation ──────────
  await t.test('4. Rotating QR challenge token structure and multi-student classroom verification', () => {
    const mockSession = {
      _id: '654321098765432109876543',
      status: 'active',
      qrChallengeToken: null,
      qrChallengeExpiresAt: null,
    };

    const challenge = qrChallengeService.generateChallenge(mockSession._id, 45);
    assert.ok(challenge.token);
    assert.equal(typeof challenge.token, 'string');
    assert.equal(challenge.expiresInSeconds, 45);

    const parts = challenge.token.split('.');
    assert.equal(parts.length, 3); // <timestamp_hex>.<nonce_hex>.<hmac_signature>

    // 1. Valid submission within window
    const isValid = qrChallengeService.validateChallenge(mockSession, challenge.token);
    assert.equal(isValid, true);

    // 2. Classroom broadcast scenario: 3 different students scan the SAME projected token
    // All 3 students succeed because the token is bound to the classroom session
    const student1Check = qrChallengeService.validateChallenge(mockSession, challenge.token);
    const student2Check = qrChallengeService.validateChallenge(mockSession, challenge.token);
    const student3Check = qrChallengeService.validateChallenge(mockSession, challenge.token);
    assert.equal(student1Check, true);
    assert.equal(student2Check, true);
    assert.equal(student3Check, true);

    // 3. Reject cross-session submission (token for session A submitted to session B)
    const otherSession = {
      _id: '999999999999999999999999',
      status: 'active',
    };
    assert.throws(
      () => qrChallengeService.validateChallenge(otherSession, challenge.token),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /different session/);
        return true;
      }
    );

    // 4. Reject expired token (simulated clock at +55s)
    const futureClock = new Date(Date.now() + 55000);
    assert.throws(
      () => qrChallengeService.validateChallenge(mockSession, challenge.token, futureClock),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /expired/);
        return true;
      }
    );

    // 5. Reject token on closed session
    const closedSession = { ...mockSession, status: 'completed' };
    assert.throws(
      () => qrChallengeService.validateChallenge(closedSession, challenge.token),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /inactive or closed session/);
        return true;
      }
    );
  });
});

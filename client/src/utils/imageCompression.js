/**
 * client/src/utils/imageCompression.js
 * Client-side camera frame normalization, aspect-ratio preservation,
 * and lightweight JPEG compression for CampusSphere AI Smart Attendance.
 */

/**
 * Calculate aspect-ratio-preserving dimensions bounded by maxW and maxH.
 * Never stretches or distorts the face geometry.
 * Never upscales images smaller than max dimensions.
 *
 * @param {number} srcW Source frame width
 * @param {number} srcH Source frame height
 * @param {number} [maxW=640] Maximum allowable output width
 * @param {number} [maxH=480] Maximum allowable output height
 * @returns {{ width: number, height: number, scale: number, aspectRatio: number }}
 */
export function calculateNormalizedDimensions(srcW, srcH, maxW = 640, maxH = 480) {
  if (!srcW || !srcH || srcW <= 0 || srcH <= 0) {
    return { width: 640, height: 480, scale: 1, aspectRatio: 1.333 };
  }

  // Downscale only if larger than target boundary
  const scale = Math.min(1, maxW / srcW, maxH / srcH);
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const aspectRatio = Number((width / height).toFixed(3));

  return { width, height, scale, aspectRatio };
}

/**
 * Estimate scene illumination from raw RGBA pixel data using ITU-R BT.601 coefficients.
 * Provides client-side guidance only (not an authoritative biometric or security assertion).
 *
 * @param {Uint8ClampedArray|Array<number>} pixels Array of RGBA pixel bytes
 * @returns {{ averageLuminance: number, lightingStatus: 'low' | 'good' | 'high', warning: string | null }}
 */
export function estimateLuminance(pixels) {
  if (!pixels || pixels.length < 4) {
    return { averageLuminance: 128, lightingStatus: 'good', warning: null };
  }

  let totalLum = 0;
  const count = Math.floor(pixels.length / 4);

  for (let i = 0; i < pixels.length; i += 4) {
    // Standard perceptual luminance: 0.299*R + 0.587*G + 0.114*B
    totalLum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }

  const averageLuminance = Math.round(totalLum / count);

  if (averageLuminance < 45) {
    return {
      averageLuminance,
      lightingStatus: 'low',
      warning: 'Lighting is too dim — please face a light source'
    };
  }

  if (averageLuminance > 215) {
    return {
      averageLuminance,
      lightingStatus: 'high',
      warning: 'High glare detected — avoid bright backlighting'
    };
  }

  return {
    averageLuminance,
    lightingStatus: 'good',
    warning: null
  };
}

/**
 * Estimate byte size of a Base64 data URL string.
 *
 * @param {string} dataUrl
 * @returns {number} Size in bytes
 */
export function estimateBase64Size(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  // Each 4 base64 chars represent 3 bytes; subtract padding '='
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.max(0, Math.round((b64.length * 3) / 4) - padding);
}

/**
 * Validate a captured image data URL before submitting to backend.
 *
 * @param {string} dataUrl Base64 image string
 * @param {number} [maxSizeBytes=300000] Maximum acceptable payload size (300 KB default)
 * @returns {{ valid: boolean, sizeKb: number, reason: string | null }}
 */
export function validateImagePayload(dataUrl, maxSizeBytes = 300 * 1024) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, sizeKb: 0, reason: 'Empty or missing camera frame payload' };
  }

  if (!dataUrl.startsWith('data:image/jpeg;base64,') && !dataUrl.startsWith('data:image/jpg;base64,')) {
    return { valid: false, sizeKb: 0, reason: 'Invalid image format. Expected JPEG data URL.' };
  }

  const bytes = estimateBase64Size(dataUrl);
  const sizeKb = Math.round(bytes / 1024);

  // Minimum threshold: a valid 640x480 face JPEG is at least 15 KB
  if (bytes < 3000) {
    return { valid: false, sizeKb, reason: 'Captured frame is blank or incomplete (payload too small)' };
  }

  // Maximum threshold: should comfortably fit well below 300 KB
  if (bytes > maxSizeBytes) {
    return { valid: false, sizeKb, reason: `Compressed image exceeds size limit (${sizeKb} KB > ${Math.round(maxSizeBytes / 1024)} KB)` };
  }

  return { valid: true, sizeKb, reason: null };
}


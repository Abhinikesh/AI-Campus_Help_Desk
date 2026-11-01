import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  Camera, CameraOff, RefreshCw, FlipHorizontal, CheckCircle,
  AlertTriangle, ShieldCheck, Sun, SunMedium, Moon, Eye
} from 'lucide-react';
import {
  calculateNormalizedDimensions,
  estimateLuminance,
  estimateBase64Size,
  validateImagePayload
} from '../../utils/imageCompression';
import './AttendanceShared.css';

/**
 * CameraPreview
 * Production-hardened WebRTC camera capture component with:
 * - Aspect-ratio preserving dimension normalization (max 640x480, no distortion)
 * - JPEG quality compression (targeting < 150 KB)
 * - Client-side real-time illumination feedback
 * - Strict media track lifecycle and visibility change cleanup
 * - 10-state lifecycle support
 */
export const CameraPreview = forwardRef(({
  status = 'ready', // 'idle' | 'requesting_permission' | 'ready' | 'guidance' | 'capturing' | 'compressing' | 'submitting' | 'verifying' | 'success' | 'rejected' | 'error'
  guideMessage = 'Center your face within the guide',
  boundingBoxes = [],
  onStreamActive = null,
  showControls = true,
  isClassroomMode = false,
  targetMaxWidth = 640,
  targetMaxHeight = 480,
  jpegQuality = 0.80,
}, ref) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sampleCanvasRef = useRef(null);
  const illuminationTimerRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(null); // null: unrequested, true: granted, false: denied
  const [errorMessage, setErrorMessage] = useState('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [lighting, setLighting] = useState({ averageLuminance: 128, lightingStatus: 'good', warning: null });
  const [lastMetrics, setLastMetrics] = useState(null);

  /**
   * Capture and compress the current video frame while preserving aspect ratio.
   * Returns normalized metadata object, with .dataUrl available for direct string use.
   */
  const captureNormalizedFrame = useCallback(() => {
    if (!videoRef.current || !cameraActive) return null;
    try {
      const video = videoRef.current;
      const srcW = video.videoWidth || 640;
      const srcH = video.videoHeight || 480;

      // Aspect-ratio-preserving dimensions (bounded by max 640x480)
      const { width: targetW, height: targetH, aspectRatio } = calculateNormalizedDimensions(
        srcW,
        srcH,
        targetMaxWidth,
        targetMaxHeight
      );

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Mirror horizontally if user front camera
      if (isMirrored && !isClassroomMode) {
        ctx.translate(targetW, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, targetW, targetH);

      const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      const sizeBytes = estimateBase64Size(dataUrl);
      const sizeKb = Math.round(sizeBytes / 1024);

      const validation = validateImagePayload(dataUrl);

      const metrics = {
        dataUrl,
        width: targetW,
        height: targetH,
        originalWidth: srcW,
        originalHeight: srcH,
        aspectRatio,
        sizeBytes,
        sizeKb,
        quality: jpegQuality,
        isValid: validation.valid,
        validationReason: validation.reason,
        timestamp: Date.now(),
      };

      setLastMetrics(metrics);
      return metrics;
    } catch (err) {
      console.warn('[CameraPreview] Frame capture error:', err.message);
      return null;
    }
  }, [cameraActive, isMirrored, isClassroomMode, targetMaxWidth, targetMaxHeight, jpegQuality]);

  /**
   * Backwards-compatible captureFrame returning base64 data URL string directly.
   */
  const captureFrame = useCallback(() => {
    const result = captureNormalizedFrame();
    return result ? result.dataUrl : null;
  }, [captureNormalizedFrame]);

  // Expose imperative API to parent components
  useImperativeHandle(ref, () => ({
    captureFrame,
    captureNormalizedFrame,
    isCameraActive: () => cameraActive,
    hasCameraPermission: () => hasPermission === true,
    getLightingStatus: () => lighting,
    getLastMetrics: () => lastMetrics,
    restartCamera: startCamera,
    stopCamera: stopActiveTracks,
  }), [captureFrame, captureNormalizedFrame, cameraActive, hasPermission, lighting, lastMetrics]);

  /**
   * Stop all active media stream tracks cleanly.
   */
  const stopActiveTracks = useCallback(() => {
    if (illuminationTimerRef.current) {
      clearInterval(illuminationTimerRef.current);
      illuminationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  /**
   * Sample video frame illumination periodically for client-side lighting guidance.
   */
  const sampleIllumination = useCallback(() => {
    if (!videoRef.current || !cameraActive) return;
    try {
      const video = videoRef.current;
      if (video.readyState < 2) return; // HAVE_CURRENT_DATA

      if (!sampleCanvasRef.current) {
        sampleCanvasRef.current = document.createElement('canvas');
        sampleCanvasRef.current.width = 32;
        sampleCanvasRef.current.height = 24;
      }

      const canvas = sampleCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, 32, 24);
      const imgData = ctx.getImageData(0, 0, 32, 24);

      const result = estimateLuminance(imgData.data);
      setLighting(result);
    } catch (e) {
      // Ignore background sample error
    }
  }, [cameraActive]);

  /**
   * Request user media and bind to video element.
   */
  const startCamera = async () => {
    setErrorMessage('');
    stopActiveTracks();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setErrorMessage('Camera access is not supported by your current browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isClassroomMode ? 'environment' : 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('[CameraPreview] Video play promise caught:', e));
      }

      setHasPermission(true);
      setCameraActive(true);
      if (onStreamActive) onStreamActive(stream);

      // Start illumination sampler
      if (illuminationTimerRef.current) clearInterval(illuminationTimerRef.current);
      illuminationTimerRef.current = setInterval(sampleIllumination, 1400);
    } catch (err) {
      console.warn('[CameraPreview] Camera start error:', err.name, err.message);
      setHasPermission(false);
      setCameraActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access denied. Please click the camera icon in your browser address bar to allow access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera hardware detected on your device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage('Camera is currently in use by another application. Please close other camera tabs.');
      } else {
        setErrorMessage(`Unable to access camera: ${err.message || 'Please check permissions.'}`);
      }
    }
  };

  // Mount effect & cleanup
  useEffect(() => {
    startCamera();

    // Tab visibility change listener: stop polling or pause when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (illuminationTimerRef.current) {
          clearInterval(illuminationTimerRef.current);
          illuminationTimerRef.current = null;
        }
      } else if (cameraActive && !illuminationTimerRef.current) {
        illuminationTimerRef.current = setInterval(sampleIllumination, 1400);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopActiveTracks();
    };
  }, [isClassroomMode]);

  const toggleMirror = () => {
    setIsMirrored((prev) => !prev);
  };

  const isVerifying = status === 'verifying' || status === 'submitting' || status === 'compressing' || status === 'capturing';
  const isSuccess = status === 'success';
  const isError = status === 'error' || status === 'rejected';

  return (
    <div className="camera-container">
      <div className="camera-feed-wrap">
        {hasPermission === false ? (
          <div className="camera-placeholder">
            <CameraOff size={44} style={{ color: '#EF4444', marginBottom: 6 }} />
            <h4>Camera Access Required</h4>
            <p>{errorMessage || 'CampusSphere requires camera access for smart biometric verification.'}</p>
            <button
              type="button"
              className="ds-btn ds-btn-primary"
              style={{ marginTop: 12 }}
              onClick={startCamera}
            >
              <RefreshCw size={14} /> Retry Camera Access
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`camera-video ${!isMirrored || isClassroomMode ? 'unmirrored' : ''}`}
            />

            {/* Student Mode: Single Face Oval Guide Overlay */}
            {!isClassroomMode && (
              <div className="face-guide-overlay">
                <div
                  className={`face-oval ${
                    isSuccess
                      ? 'detected'
                      : isVerifying
                      ? 'verifying'
                      : isError
                      ? 'error'
                      : lighting.warning
                      ? 'warning'
                      : ''
                  }`}
                >
                  {isVerifying && <div className="scan-line" />}
                </div>

                {/* Primary Guide Message */}
                <div className="camera-guide-text">
                  {isVerifying ? (
                    <>
                      <ShieldCheck size={14} style={{ color: '#60A5FA' }} />
                      <span>{status === 'compressing' ? 'Optimizing biometric frame…' : 'Verifying facial biometric signature…'}</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle size={14} style={{ color: '#34D399' }} />
                      <span>Face matched with high confidence</span>
                    </>
                  ) : isError ? (
                    <>
                      <AlertTriangle size={14} style={{ color: '#F87171' }} />
                      <span>Match uncertain — please reposition</span>
                    </>
                  ) : (
                    <>
                      <Camera size={14} style={{ color: '#93C5FD' }} />
                      <span>{guideMessage}</span>
                    </>
                  )}
                </div>

                {/* Client-Side Real-Time Lighting Feedback (Guidance only) */}
                {cameraActive && !isVerifying && !isSuccess && (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: lighting.warning ? 'rgba(217, 119, 6, 0.85)' : 'rgba(15, 23, 42, 0.65)',
                      color: '#F8FAFC',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {lighting.lightingStatus === 'low' ? (
                      <Moon size={12} style={{ color: '#FCD34D' }} />
                    ) : lighting.lightingStatus === 'high' ? (
                      <Sun size={12} style={{ color: '#FCD34D' }} />
                    ) : (
                      <SunMedium size={12} style={{ color: '#34D399' }} />
                    )}
                    <span>{lighting.warning || 'Lighting condition: Optimal'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Classroom Mode: Live Multi-Face Bounding Boxes */}
            {isClassroomMode && boundingBoxes.length > 0 && (
              boundingBoxes.map((box, i) => (
                <div
                  key={i}
                  className="classroom-bbox"
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.w}%`,
                    height: `${box.h}%`,
                  }}
                >
                  <span className="bbox-label">{box.label}</span>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {showControls && (
        <div className="camera-controls-bar">
          <div className="camera-status-pill">
            <span
              className={`camera-status-dot ${
                !cameraActive ? 'error' : isVerifying ? 'busy' : 'active'
              }`}
            />
            <span>
              {!cameraActive
                ? 'Camera Inactive'
                : isVerifying
                ? 'Processing Frame'
                : 'Sensor Live (640×480)'}
            </span>
          </div>

          <div className="camera-btn-group">
            {!isClassroomMode && (
              <button
                type="button"
                className="camera-icon-btn"
                title="Toggle Mirror View"
                onClick={toggleMirror}
              >
                <FlipHorizontal size={13} />
                <span>{isMirrored ? 'Mirrored' : 'Normal'}</span>
              </button>
            )}
            <button
              type="button"
              className="camera-icon-btn"
              title="Restart Camera Stream"
              onClick={startCamera}
            >
              <RefreshCw size={13} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

CameraPreview.displayName = 'CameraPreview';

export default CameraPreview;

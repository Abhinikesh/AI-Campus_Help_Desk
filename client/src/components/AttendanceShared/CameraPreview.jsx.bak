import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Camera, CameraOff, RefreshCw, FlipHorizontal, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import './AttendanceShared.css';

/**
 * CameraPreview
 * Native HTML5 WebRTC camera capture component with face positioning overlay,
 * status states, and fallback handling.
 */
export const CameraPreview = forwardRef(({
  status = 'ready', // 'ready' | 'detecting' | 'verifying' | 'success' | 'error'
  guideMessage = 'Center your face within the guide',
  boundingBoxes = [], // For classroom camera view [{ x, y, w, h, label }]
  onStreamActive = null,
  showControls = true,
  isClassroomMode = false,
}, ref) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(null); // null, true, false
  const [errorMessage, setErrorMessage] = useState('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      if (!videoRef.current || !cameraActive) return null;
      try {
        const video = videoRef.current;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (isMirrored && !isClassroomMode) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', 0.88);
      } catch (err) {
        console.warn('Frame capture error:', err);
        return null;
      }
    },
    isCameraActive: () => cameraActive,
    hasCameraPermission: () => hasPermission === true,
    restartCamera: startCamera,
  }));

  const startCamera = async () => {
    setErrorMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setErrorMessage('Camera access is not supported by your browser.');
        return;
      }

      // Stop any existing tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
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
        videoRef.current.play().catch(e => console.warn('Video play caught:', e));
      }

      setHasPermission(true);
      setCameraActive(true);
      if (onStreamActive) onStreamActive(stream);
    } catch (err) {
      console.warn('Camera permission / start error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser address bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera hardware was detected on your device.');
      } else {
        setErrorMessage(`Unable to access camera: ${err.message || 'Please check device permissions.'}`);
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isClassroomMode]);

  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
  };

  return (
    <div className="camera-container">
      <div className="camera-feed-wrap">
        {hasPermission === false ? (
          <div className="camera-placeholder">
            <CameraOff size={44} style={{ color: '#EF4444', marginBottom: 6 }} />
            <h4>Camera Access Needed</h4>
            <p>{errorMessage || 'CampusSphere requires camera access for smart biometric verification.'}</p>
            <button
              type="button"
              className="ds-btn ds-btn-primary"
              style={{ marginTop: 12 }}
              onClick={startCamera}
            >
              <RefreshCw size={14} /> Retry Camera
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

            {/* Student Mode: Single Face Guide Overlay */}
            {!isClassroomMode && (
              <div className="face-guide-overlay">
                <div
                  className={`face-oval ${
                    status === 'success'
                      ? 'detected'
                      : status === 'verifying'
                      ? 'verifying'
                      : status === 'error'
                      ? 'error'
                      : ''
                  }`}
                >
                  {status === 'verifying' && <div className="scan-line" />}
                </div>

                <div className="camera-guide-text">
                  {status === 'verifying' ? (
                    <>
                      <ShieldCheck size={14} style={{ color: '#60A5FA' }} />
                      <span>Verifying facial biometric signature…</span>
                    </>
                  ) : status === 'success' ? (
                    <>
                      <CheckCircle size={14} style={{ color: '#34D399' }} />
                      <span>Face matched with high confidence</span>
                    </>
                  ) : status === 'error' ? (
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
                !cameraActive ? 'error' : status === 'verifying' ? 'busy' : 'active'
              }`}
            />
            <span>
              {!cameraActive
                ? 'Camera Inactive'
                : status === 'verifying'
                ? 'Processing Frame'
                : 'Sensor Live'}
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

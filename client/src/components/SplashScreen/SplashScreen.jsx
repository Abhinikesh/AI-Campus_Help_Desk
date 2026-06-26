import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import './SplashScreen.css';

const SplashScreen = ({ onDone }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade-out just before the CSS bar finishes
    const fadeTimer = setTimeout(() => setFading(true), 2200);
    // Fully unmount after fade animation (0.6s)
    const doneTimer = setTimeout(() => onDone(), 2800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={`splash-root${fading ? ' fade-out' : ''}`}>
      {/* ── Center content ── */}
      <div className="splash-logo-wrap">
        <div className="splash-icon-ring">
          <GraduationCap size={60} color="#3b82f6" strokeWidth={1.5} />
        </div>

        <h1 className="splash-title">
          Campus<span>Sphere</span> AI
        </h1>

        <p className="splash-tagline">Your Smart Campus. Powered by AI.</p>
      </div>

      {/* ── Bottom loader ── */}
      <div className="splash-loader-wrap">
        <div className="splash-bar-track">
          <div className="splash-bar-fill" />
        </div>
        <div className="splash-dots">
          <div className="splash-dot" />
          <div className="splash-dot" />
          <div className="splash-dot" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;

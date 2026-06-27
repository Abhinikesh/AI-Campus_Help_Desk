import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, GraduationCap, BookOpen, Shield, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './LoginModal.css';

// ── Role metadata ────────────────────────────────────────────
const ROLE_META = {
  student: {
    label:    'Student',
    icon:     GraduationCap,
    title:    'Student Login',
    subtitle: 'Sign in to access your student dashboard',
    btnText:  'Sign in as Student',
  },
  faculty: {
    label:    'Faculty',
    icon:     BookOpen,
    title:    'Faculty Login',
    subtitle: 'Sign in to access your faculty dashboard',
    btnText:  'Sign in as Faculty',
  },
  admin: {
    label:    'Admin',
    icon:     Shield,
    title:    'Admin Login',
    subtitle: 'Manage campus operations and analytics',
    btnText:  'Sign in as Admin',
  },
};

// ── Google SVG (official 4-color) ────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.8299 3.96409 7.2899V4.9581H0.957273C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
    <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9254L15.0218 2.344C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.2899C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
  </svg>
);

// ── Reusable Google Sign-In Button ───────────────────────────
const GoogleSignInButton = () => (
  <button type="button" className="google-btn" onClick={() => {}}>
    <GoogleIcon />
    Continue with Google
  </button>
);

// ── Reusable Password Field with toggle ──────────────────────
const PasswordField = ({ label, value, onChange, error, placeholder, hint }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="modal-field">
      <label className="modal-label">{label}</label>
      <div className="pw-wrap">
        <input
          className={`modal-input${error ? ' error-input' : ''}`}
          type={show ? 'text' : 'password'}
          placeholder={placeholder || 'Enter your password'}
          value={value}
          onChange={onChange}
          autoComplete="current-password"
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint  && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error">
          <AlertCircle size={12} /> {error}
        </span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Main LoginModal component
// ═══════════════════════════════════════════════════════════════
const LoginModal = ({ role, onClose }) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [closing,      setClosing]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [apiError,     setApiError]     = useState('');
  const [forgotView,   setForgotView]   = useState(false);
  const [resetSent,    setResetSent]    = useState(false);

  const activeRole = role || 'student';
  const [idFocused,    setIdFocused]    = useState(false);

  // ── Shared fields ──────────────────────────────────────────
  const [identifier, setIdentifier] = useState(''); // roll / email
  const [password,   setPassword]   = useState('');

  // ── Forgot password field ──────────────────────────────────
  const [resetEmail, setResetEmail] = useState('');

  // ── Inline validation errors ───────────────────────────────
  const [idError,  setIdError]  = useState('');
  const [pwError,  setPwError]  = useState('');

  const meta       = ROLE_META[activeRole] || ROLE_META.student;
  const isStudent  = activeRole === 'student';

  // ── Helpers ────────────────────────────────────────────────
  const clearErrors = () => { setIdError(''); setPwError(''); setApiError(''); };

  // ── Validation ─────────────────────────────────────────────
  const validate = () => {
    let ok = true;
    clearErrors();

    if (!identifier.trim()) {
      setIdError('Required'); ok = false;
    }
    if (!password) {
      setPwError('Required'); ok = false;
    }
    return ok;
  };

  // ── Close ──────────────────────────────────────────────────
  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 240);
  };
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await login(identifier, password, activeRole);
      handleClose();
      navigate(data.redirectTo);
    } catch (err) {
      setApiError(
        err?.response?.data?.message ||
        err.message ||
        'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Reset password (design-only) ───────────────────────────
  const handleResetSubmit = (e) => {
    e.preventDefault();
    setResetSent(true);
  };

  // ── ESC key ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Identifier label / placeholder per role ─────────────────
  const idLabel = isStudent
    ? 'Student ID'
    : activeRole === 'faculty'
    ? 'Faculty ID / Email'
    : activeRole === 'admin'
    ? 'Admin Email'
    : 'Email Address';

  const idPlaceholder = isStudent
    ? 'e.g. 1/24/SET/BCS/001'
    : activeRole === 'faculty'
    ? 'faculty@campussphere.edu'
    : activeRole === 'admin'
    ? 'admin@campussphere.edu'
    : 'Enter your ID or email';

  const idType = isStudent ? 'text' : 'email';

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className={`modal-box${closing ? ' closing' : ''}`}>

        {/* ── Close button ── */}
        <button className="modal-close" onClick={handleClose} aria-label="Close modal">
          <X size={18} />
        </button>

        {/* ═══════════════════════════════════════════════════
            FORGOT PASSWORD VIEW
        ═══════════════════════════════════════════════════ */}
        {forgotView ? (
          <>
            <h2 className="modal-title">Reset Password</h2>

            <form onSubmit={handleResetSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
              <div className="modal-field">
                <label className="modal-label">Your Student ID / Email</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="Enter your ID or email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoFocus
                />
              </div>

              {resetSent && (
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 500, textAlign: 'center' }}>
                  Reset link sent! Check your inbox.
                </div>
              )}

              <button type="submit" className="modal-submit">
                Send Reset Link
              </button>

              <button
                type="button"
                className="modal-back-link"
                onClick={() => { setForgotView(false); setResetSent(false); setResetEmail(''); }}
              >
                ← Back to Login
              </button>
            </form>
          </>
        ) : (
        /* ═══════════════════════════════════════════════════
            MAIN LOGIN VIEW
        ═══════════════════════════════════════════════════ */
        <>
          <h2 className="modal-title">{meta.title}</h2>
          <p className="modal-subtitle">{meta.subtitle}</p>

          <form className="modal-form" onSubmit={handleSubmit} noValidate>

            {/* Identifier field */}
            <div className="modal-field">
              <label className="modal-label">{idLabel}</label>
              <input
                className={`modal-input${idError ? ' error-input' : ''}`}
                type={idType}
                placeholder={idPlaceholder}
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setIdError(''); }}
                onFocus={() => setIdFocused(true)}
                onBlur={() => setIdFocused(false)}
                autoComplete="username"
                autoFocus
              />
              {isStudent && (
                <span className="field-helper-text">
                  Format: Batch/Year/School/Branch/RollNo
                </span>
              )}
              {isStudent && idFocused && (
                <div className="id-helper-card">
                  <div className="id-helper-row">
                    <div className="id-helper-segment">
                      <span className="segment-value">1</span>
                      <span className="segment-line">|</span>
                      <span className="segment-label">Div</span>
                    </div>
                    <span className="segment-separator">/</span>
                    <div className="id-helper-segment">
                      <span className="segment-value">24</span>
                      <span className="segment-line">|</span>
                      <span className="segment-label">Year</span>
                    </div>
                    <span className="segment-separator">/</span>
                    <div className="id-helper-segment">
                      <span className="segment-value">SET</span>
                      <span className="segment-line">|</span>
                      <span className="segment-label">School</span>
                    </div>
                    <span className="segment-separator">/</span>
                    <div className="id-helper-segment">
                      <span className="segment-value">BCS</span>
                      <span className="segment-line">|</span>
                      <span className="segment-label">Branch</span>
                    </div>
                    <span className="segment-separator">/</span>
                    <div className="id-helper-segment">
                      <span className="segment-value">001</span>
                      <span className="segment-line">|</span>
                      <span className="segment-label">Roll</span>
                    </div>
                  </div>
                </div>
              )}
              {idError && (
                <span className="field-error">{idError}</span>
              )}
            </div>

            {/* Password field */}
            <PasswordField
              label="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              error={pwError}
              hint={isStudent ? 'Default password is your Student ID' : undefined}
            />

            {/* Submit */}
            <button className="modal-submit" type="submit" disabled={loading}>
              {loading ? (
                <><div className="btn-spinner" /> Signing in…</>
              ) : (
                meta.btnText
              )}
            </button>

            {apiError && (
              <div className="modal-api-error-text">
                Incorrect ID or password
              </div>
            )}

            {/* Forgot password */}
            <div className="modal-forgot">
              <button type="button" onClick={() => { clearErrors(); setForgotView(true); }}>
                Forgot password?
              </button>
            </div>

          </form>

          {/* Divider */}
          <div className="modal-divider" style={{ marginTop: 20 }}>or</div>

          {/* Google Sign-In */}
          <div style={{ marginTop: 12 }}>
            <GoogleSignInButton />
          </div>
        </>
        )}

      </div>
    </div>
  );
};

export default LoginModal;

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
  const [loginId,   setLoginId]   = useState(''); // roll number (student) or employee/admin ID
  const [password,  setPassword]  = useState('');

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

    if (!loginId.trim()) {
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
      const data = await login(loginId, password, activeRole);
      handleClose();
      // data.data.redirectTo from new consistent JSON shape
      navigate(data?.data?.redirectTo || '/');
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
  // loginId is: roll number for students, employee ID for faculty, admin ID for admin
  const idLabel = isStudent
    ? 'Roll Number'
    : activeRole === 'faculty'
    ? 'Employee ID'
    : 'Admin ID';

  const idPlaceholder = isStudent
    ? 'e.g. 20240001'
    : activeRole === 'faculty'
    ? 'e.g. FAC001'
    : 'e.g. ADMIN001';

  const idType = 'text'; // always text — IDs are not emails

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

            {/* Login ID field */}
            <div className="modal-field">
              <label className="modal-label">{idLabel}</label>
              <input
                className={`modal-input${idError ? ' error-input' : ''}`}
                type={idType}
                placeholder={idPlaceholder}
                value={loginId}
                onChange={(e) => { setLoginId(e.target.value); setIdError(''); }}
                autoComplete="username"
                autoFocus
              />
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

        </>
        )}

      </div>
    </div>
  );
};

export default LoginModal;

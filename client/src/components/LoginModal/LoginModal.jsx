import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, GraduationCap, BookOpen, Users, UserPlus, Shield,
  AlertCircle, Eye, EyeOff, ArrowLeft
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
  parent: {
    label:    'Parent',
    icon:     Users,
    title:    'Parent Login',
    subtitle: "Track your child's academic progress and attendance",
    btnText:  'Sign in as Parent',
  },
  admission: {
    label:    'New Admission',
    icon:     UserPlus,
    title:    'New Admission Portal',
    subtitle: 'Begin your admission journey at CampusSphere',
    btnText:  'Continue to Admission',
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
  const { login, admissionLogin } = useAuth();
  const navigate = useNavigate();

  const [closing,      setClosing]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [apiError,     setApiError]     = useState('');
  const [forgotView,   setForgotView]   = useState(false);
  const [resetSent,    setResetSent]    = useState(false);

  // ── Shared fields ──────────────────────────────────────────
  const [identifier, setIdentifier] = useState(''); // roll / email / phone / appId
  const [password,   setPassword]   = useState('');
  const [dob,        setDob]        = useState('');   // admission: date of birth
  const [admPhone,   setAdmPhone]   = useState('');   // admission: phone number

  // ── Forgot password field ──────────────────────────────────
  const [resetEmail, setResetEmail] = useState('');

  // ── Inline validation errors ───────────────────────────────
  const [idError,  setIdError]  = useState('');
  const [pwError,  setPwError]  = useState('');
  const [dobError, setDobError] = useState('');

  const meta       = ROLE_META[role] || ROLE_META.student;
  const RoleIcon   = meta.icon;
  const isAdm      = role === 'admission';
  const isStudent  = role === 'student';
  const isParent   = role === 'parent';

  // ── Helpers ────────────────────────────────────────────────
  const clearErrors = () => { setIdError(''); setPwError(''); setDobError(''); setApiError(''); };

  // ── Validation ─────────────────────────────────────────────
  const validate = () => {
    let ok = true;
    clearErrors();

    if (isAdm) {
      // Admission: Application ID required
      if (!identifier.trim()) {
        setIdError('Application ID is required'); ok = false;
      }
      // DOB required
      if (!dob) {
        setDobError('Date of birth is required'); ok = false;
      }
      // Password required
      if (!password) {
        setPwError('Password is required'); ok = false;
      } else if (password.length < 6) {
        setPwError('Password must be at least 6 characters'); ok = false;
      }
    } else {
      // identifier validation
      if (!identifier.trim()) {
        setIdError('This field is required'); ok = false;
      } else if (isStudent && !/^\d{8}$/.test(identifier)) {
        setIdError('Roll number must be exactly 8 digits'); ok = false;
      } else if (!isStudent && !isParent && !identifier.includes('@')) {
        setIdError('Please enter a valid email address'); ok = false;
      } else if (isParent && !/^\d{10}$/.test(identifier)) {
        setIdError('Please enter a valid 10-digit mobile number'); ok = false;
      }

      // password
      if (!password) {
        setPwError('Password is required'); ok = false;
      } else if (password.length < 8) {
        setPwError('Password must be at least 8 characters'); ok = false;
      }
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
      if (isAdm) {
        // Bridge: pass identifier as name, admPhone as phone to existing API
        const data = await admissionLogin(identifier, admPhone || dob);
        handleClose();
        navigate(data.redirectTo);
      } else {
        const data = await login(identifier, password, role);
        handleClose();
        navigate(data.redirectTo);
      }
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
  }, []);

  // ── Identifier label / placeholder per role ─────────────────
  const idLabel = isStudent
    ? 'Roll Number'
    : isParent
    ? 'Registered Mobile Number'
    : 'Email Address';

  const idPlaceholder = isStudent
    ? 'Enter your 8-digit roll number'
    : isParent
    ? '10-digit mobile number'
    : role === 'admin'
    ? 'Enter admin email address'
    : 'Enter your institutional email';

  const idType = isStudent
    ? 'text'
    : isParent
    ? 'tel'
    : 'email';

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
            <button
              type="button"
              className="modal-back-btn"
              onClick={() => { setForgotView(false); setResetSent(false); setResetEmail(''); }}
            >
              <ArrowLeft size={14} /> Back to Login
            </button>

            <h2 className="modal-title">Reset Your Password</h2>
            <p className="modal-subtitle">
              Enter your registered email or roll number and we will send you a reset link.
            </p>

            {resetSent ? (
              <div style={{
                background: 'rgba(22, 163, 74, 0.06)',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                borderRadius: 6,
                padding: '14px 16px',
                fontSize: 14,
                color: '#16A34A',
                fontWeight: 500,
              }}>
                Reset link sent! Check your email or SMS inbox.
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="modal-field">
                  <label className="modal-label">Email / Roll Number</label>
                  <input
                    className="modal-input"
                    type="text"
                    placeholder="Enter your registered email or roll number"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <button type="submit" className="modal-submit">
                  Send Reset Link
                </button>
              </form>
            )}
          </>
        ) : (
        /* ═══════════════════════════════════════════════════
            MAIN LOGIN VIEW
        ═══════════════════════════════════════════════════ */
        <>
          {/* Role badge */}
          <div className="modal-role-badge">
            <RoleIcon size={13} strokeWidth={1.75} />
            {meta.label}
          </div>

          <h2 className="modal-title">{meta.title}</h2>
          <p className="modal-subtitle">{meta.subtitle}</p>

          {/* API error banner */}
          {apiError && (
            <div className="modal-api-error" style={{ marginBottom: 20 }}>
              <AlertCircle size={14} />
              {apiError}
            </div>
          )}

          <form className="modal-form" onSubmit={handleSubmit} noValidate>

            {/* ── ADMISSION FORM ── */}
            {isAdm ? (
              <>
                <div className="modal-field">
                  <label className="modal-label">Application ID</label>
                  <input
                    className={`modal-input${idError ? ' error-input' : ''}`}
                    type="text"
                    placeholder="Enter your application ID"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setIdError(''); }}
                  />
                  {idError && (
                    <span className="field-error"><AlertCircle size={12} /> {idError}</span>
                  )}
                </div>

                <div className="modal-field">
                  <label className="modal-label">Date of Birth</label>
                  <input
                    className={`modal-input${dobError ? ' error-input' : ''}`}
                    type="date"
                    placeholder="DD/MM/YYYY"
                    value={dob}
                    onChange={(e) => { setDob(e.target.value); setDobError(''); }}
                  />
                  {dobError && (
                    <span className="field-error"><AlertCircle size={12} /> {dobError}</span>
                  )}
                </div>

                <PasswordField
                  label="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
                  error={pwError}
                  placeholder="Create or enter your password"
                />
              </>
            ) : (
            /* ── ALL OTHER ROLES ── */
            <>
              {/* Identifier field */}
              <div className="modal-field">
                <label className="modal-label">{idLabel}</label>
                <input
                  className={`modal-input${idError ? ' error-input' : ''}`}
                  type={idType}
                  inputMode={isStudent ? 'numeric' : isParent ? 'tel' : 'email'}
                  placeholder={idPlaceholder}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setIdError(''); }}
                  maxLength={isStudent ? 8 : undefined}
                  autoComplete="username"
                  autoFocus
                />
                {idError && (
                  <span className="field-error"><AlertCircle size={12} /> {idError}</span>
                )}
              </div>

              {/* Password field */}
              <PasswordField
                label="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
                error={pwError}
                hint={role === 'admin' ? 'Admin accounts require institutional email only' : undefined}
              />

              {/* Forgot password */}
              <div className="modal-forgot">
                <button type="button" onClick={() => { clearErrors(); setForgotView(true); }}>
                  Forgot password?
                </button>
              </div>
            </>
            )}

            {/* Submit */}
            <button className="modal-submit" type="submit" disabled={loading}>
              {loading ? (
                <><div className="btn-spinner" /> Signing in…</>
              ) : (
                meta.btnText
              )}
            </button>

            {/* Admission: register link */}
            {isAdm && (
              <p className="modal-register-link">
                New applicant?{' '}
                <button type="button" onClick={() => {}}>Register here</button>
              </p>
            )}

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

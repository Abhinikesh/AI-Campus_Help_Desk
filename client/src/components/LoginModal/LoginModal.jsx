import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, GraduationCap, BookOpen, Users, UserPlus, Shield, AlertCircle, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './LoginModal.css';

const ROLE_META = {
  student:   { label: 'Student',         icon: GraduationCap, color: '#3b82f6' },
  faculty:   { label: 'Faculty',         icon: BookOpen,      color: '#3b82f6' },
  parent:    { label: 'Parent',          icon: Users,         color: '#3b82f6' },
  admission: { label: 'New Admission',   icon: UserPlus,      color: '#3b82f6' },
  admin:     { label: 'College Admin',   icon: Shield,        color: '#3b82f6' },
};

const LoginModal = ({ role, onClose }) => {
  const { login, admissionLogin } = useAuth();
  const navigate  = useNavigate();

  const [closing,  setClosing]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');

  // Fields
  const [identifier, setIdentifier] = useState(''); // rollNumber for student, email for others
  const [password,   setPassword]   = useState('');

  // Admission-only fields
  const [admName,  setAdmName]  = useState('');
  const [admPhone, setAdmPhone] = useState('');

  // Validation errors
  const [idError, setIdError]   = useState('');
  const [pwError, setPwError]   = useState('');

  const meta    = ROLE_META[role] || ROLE_META.student;
  const RoleIcon = meta.icon;
  const isAdmission = role === 'admission';

  // ── Validation ─────────────────────────────────────────────
  const validate = () => {
    let ok = true;
    setIdError(''); setPwError('');

    if (isAdmission) {
      if (admName.length < 2) ok = false;
      if (!/^\d{10}$/.test(admPhone)) ok = false;
    } else {
      if (role === 'student') {
        if (!/^\d{8}$/.test(identifier)) {
          setIdError('Roll number must be exactly 8 digits'); ok = false;
        }
      } else {
        if (!identifier.includes('@')) {
          setIdError('Please enter a valid email address'); ok = false;
        }
      }
      if (password.length < 8) {
        setPwError('Password must be at least 8 characters'); ok = false;
      }
    }
    return ok;
  };

  // ── Close with animation ───────────────────────────────────
  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) {
      if (isAdmission) setApiError('Please provide a valid name and 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      if (isAdmission) {
        const data = await admissionLogin(admName, admPhone);
        handleClose();
        navigate(data.redirectTo);
      } else {
        const data = await login(identifier, password, role);
        handleClose();
        navigate(data.redirectTo);
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Trap ESC key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className={`modal-box${closing ? ' closing' : ''}`}>

        {/* Close */}
        <button className="modal-close" onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Role badge */}
        <div className="modal-role-badge">
          <RoleIcon size={14} />
          {meta.label}
        </div>

        <h2 className="modal-title">{meta.label} Login</h2>
        <p className="modal-subtitle">
          {isAdmission
            ? 'Provide your details to begin your admission journey'
            : `Sign in to access your ${meta.label.toLowerCase()} dashboard`}
        </p>

        {/* API error */}
        {apiError && (
          <div className="modal-api-error" style={{ marginBottom: 20 }}>
            <AlertCircle size={15} />
            {apiError}
          </div>
        )}

        <form className="modal-form" onSubmit={handleSubmit} noValidate>

          {/* ── Admission form ── */}
          {isAdmission ? (
            <>
              <div className="modal-field">
                <label className="modal-label">Full Name</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="Enter your full name"
                  value={admName}
                  onChange={(e) => setAdmName(e.target.value)}
                  required
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Phone Number</label>
                <input
                  className="modal-input"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={admPhone}
                  onChange={(e) => setAdmPhone(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <>
              {/* ── Identifier field ── */}
              <div className="modal-field">
                <label className="modal-label">
                  {role === 'student' ? 'Roll Number' : 'Email Address'}
                </label>
                <input
                  className={`modal-input${idError ? ' error-input' : ''}`}
                  type={role === 'student' ? 'text' : 'email'}
                  inputMode={role === 'student' ? 'numeric' : 'email'}
                  placeholder={role === 'student' ? '8-digit roll number' : 'you@campus.edu'}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setIdError(''); }}
                  maxLength={role === 'student' ? 8 : undefined}
                  autoComplete="username"
                />
                {idError && (
                  <span className="field-error">
                    <AlertCircle size={12} /> {idError}
                  </span>
                )}
              </div>

              {/* ── Password field ── */}
              <div className="modal-field">
                <label className="modal-label">Password</label>
                <input
                  className={`modal-input${pwError ? ' error-input' : ''}`}
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
                  autoComplete="current-password"
                />
                {pwError && (
                  <span className="field-error">
                    <AlertCircle size={12} /> {pwError}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Submit */}
          <button className="modal-submit" type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Signing in…</>
            ) : (
              isAdmission ? 'Continue to Admission Portal' : `Sign in as ${meta.label}`
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default LoginModal;

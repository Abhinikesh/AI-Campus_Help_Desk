import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';
import './AdmissionInquiryModal.css';

const COURSES = [
  'B.Tech Computer Science & Engineering',
  'B.Tech Electronics & Communication',
  'B.Tech Mechanical Engineering',
  'B.Tech Civil Engineering',
  'B.Tech Information Technology',
  'M.Tech Computer Science',
  'MBA',
  'BCA',
  'MCA',
  'Other',
];

const AdmissionInquiryModal = ({ onClose }) => {
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState('');

  const [form, setForm] = useState({
    name:    '',
    email:   '',
    phone:   '',
    course:  '',
    message: '',
  });

  const [errors, setErrors] = useState({});

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 240);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: '' }));
    setApiError('');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.phone.trim()) e.phone = 'Required';
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phone)) e.phone = 'Invalid phone';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.admissionInquiry(form);
      setSubmitted(true);
    } catch (err) {
      setApiError(
        err?.response?.data?.message ||
        err.message ||
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-backdrop" onClick={handleBackdropClick}>
      <div className={`adm-box${closing ? ' closing' : ''}`}>

        {/* Close */}
        <button className="adm-close" onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>

        {submitted ? (
          /* ── Success State ── */
          <div className="adm-success">
            <div className="adm-success-icon">
              <CheckCircle size={40} color="#16A34A" strokeWidth={1.75} />
            </div>
            <h2 className="adm-title" style={{ marginTop: 16 }}>Inquiry Submitted!</h2>
            <p className="adm-subtitle">
              Thank you, <strong>{form.name}</strong>. Our admissions team will contact you at{' '}
              <strong>{form.email}</strong> within 24 hours.
            </p>
            <button className="adm-submit-btn" style={{ marginTop: 24 }} onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <>
            <h2 className="adm-title">New Admission Inquiry</h2>
            <p className="adm-subtitle">
              Fill in your details and our team will get back to you. No account required.
            </p>

            <form className="adm-form" onSubmit={handleSubmit} noValidate>

              {/* Name */}
              <div className="adm-field">
                <label className="adm-label">Full Name</label>
                <input
                  className={`adm-input${errors.name ? ' error' : ''}`}
                  type="text"
                  placeholder="e.g. Arjun Sharma"
                  value={form.name}
                  onChange={set('name')}
                  autoFocus
                />
                {errors.name && <span className="adm-error"><AlertCircle size={12} /> {errors.name}</span>}
              </div>

              {/* Email */}
              <div className="adm-field">
                <label className="adm-label">Email Address</label>
                <input
                  className={`adm-input${errors.email ? ' error' : ''}`}
                  type="email"
                  placeholder="yourname@example.com"
                  value={form.email}
                  onChange={set('email')}
                />
                {errors.email && <span className="adm-error"><AlertCircle size={12} /> {errors.email}</span>}
              </div>

              {/* Phone */}
              <div className="adm-field">
                <label className="adm-label">Phone Number</label>
                <input
                  className={`adm-input${errors.phone ? ' error' : ''}`}
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={set('phone')}
                />
                {errors.phone && <span className="adm-error"><AlertCircle size={12} /> {errors.phone}</span>}
              </div>

              {/* Course */}
              <div className="adm-field">
                <label className="adm-label">Course of Interest <span className="adm-optional">(optional)</span></label>
                <select
                  className="adm-input adm-select"
                  value={form.course}
                  onChange={set('course')}
                >
                  <option value="">Select a course...</option>
                  {COURSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div className="adm-field">
                <label className="adm-label">Message <span className="adm-optional">(optional)</span></label>
                <textarea
                  className="adm-input adm-textarea"
                  placeholder="Any specific questions or requirements..."
                  value={form.message}
                  onChange={set('message')}
                  rows={3}
                />
              </div>

              {/* API Error */}
              {apiError && (
                <div className="adm-api-error">
                  <AlertCircle size={14} /> {apiError}
                </div>
              )}

              {/* Submit */}
              <button className="adm-submit-btn" type="submit" disabled={loading}>
                {loading ? (
                  <><div className="adm-spinner" /> Submitting…</>
                ) : (
                  'Submit Inquiry'
                )}
              </button>

              <p className="adm-note">
                By submitting, you agree to be contacted by our admissions team regarding your inquiry.
              </p>
            </form>
          </>
        )}

      </div>
    </div>
  );
};

export default AdmissionInquiryModal;

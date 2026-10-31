/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FileText, Upload, CreditCard, Award, Phone,
  LogOut, Bell, GraduationCap, CheckCircle, Loader2
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import '../../styles/dashboard-shared.css';
import './Admission.css';

const NAV = [
  { label: 'Application Status',      icon: FileText,   to: '/admission/dashboard' },
  { label: 'Upload Documents',        icon: Upload,     to: '/admission/dashboard' },
  { label: 'Fee Payment',             icon: CreditCard, to: '/admission/dashboard' },
  { label: 'Admit Card',              icon: Award,      to: '/admission/dashboard' },
  { label: 'Contact Admission Office',icon: Phone,      to: '/admission/ai-help'   },
];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// Application stepper data
const STEPS = [
  { label: 'Application Submitted',    desc: 'Received on Mar 20',           status: 'done'    },
  { label: 'Document Upload',          desc: '4 of 6 documents uploaded',     status: 'done'    },
  { label: 'Document Verification',    desc: 'Under review by committee',     status: 'active'  },
  { label: 'Merit List',               desc: 'Expected by May 5',             status: 'pending' },
  { label: 'Fee Payment',              desc: 'Tuition and enrollment fees',   status: 'pending' },
  { label: 'Admission Confirmed',      desc: 'Final step',                    status: 'pending' },
];

// Required documents
const DOCUMENTS = [
  { name: '10th Marksheet',          status: 'Uploaded' },
  { name: '12th Marksheet',          status: 'Uploaded' },
  { name: 'JEE/Entrance Score Card', status: 'Uploaded' },
  { name: 'Government ID (Aadhar)',   status: 'Uploaded' },
  { name: 'Passport-size Photograph',status: 'Pending'  },
  { name: 'Category Certificate',     status: 'Rejected' },
];

const docPill = (s) => ({ Uploaded: 'green', Pending: 'amber', Rejected: 'red' }[s] || 'gray');

const AdmissionDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('Application Status');

  const applicantName = user?.name || 'Applicant';

  return (
    <div className="ds-shell">
      {/* SIDEBAR */}
      <aside className="ds-sidebar">
        <Link to="/" className="ds-sidebar-logo">
          <GraduationCap size={20} color="#1A56DB" strokeWidth={1.75} />
          <span className="ds-logo-text">CampusSphere <span className="ds-logo-ai">AI</span></span>
        </Link>
        <div className="ds-user-block">
          <div className="ds-user-name">{applicantName}</div>
          <span className="ds-role-pill">New Applicant</span>
        </div>
        <nav className="ds-nav">
          {NAV.map(({ label, icon: Icon, to }) => (
            <Link
              key={label} to={to}
              className={`ds-nav-item${activeNav === label ? ' active' : ''}`}
              onClick={() => setActiveNav(label)}
            >
              <Icon size={16} strokeWidth={1.75} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ds-sidebar-footer">
          <button className="ds-logout-btn" onClick={() => logout(navigate)}>
            <LogOut size={16} strokeWidth={1.75} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="ds-main">
        <header className="ds-header">
          <span className="ds-header-title">{activeNav}</span>
          <div className="ds-header-right">
            <button className="ds-bell-btn"><Bell size={18} /></button>
            <div className="ds-avatar">{initials(applicantName)}</div>
          </div>
        </header>

        <div className="ds-content">

          {/* STAT CARDS */}
          <div className="ds-stat-row">
            <div className="ds-stat-card">
              <div className="ds-stat-label">Application Status</div>
              <div className="ds-stat-value" style={{ fontSize: 18, marginTop: 4 }}>Under Review</div>
              <div className="ds-stat-trend neu">Step 3 of 6</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Documents Uploaded</div>
              <div className="ds-stat-value">4 <span style={{ fontSize: 16, fontWeight: 400, color: '#6B7280' }}>of 6</span></div>
              <div className="ds-stat-trend down">▼ 2 still pending</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Merit Rank</div>
              <div className="ds-stat-value">#234</div>
              <div className="ds-stat-trend up">▲ Top 10%</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-label">Next Step</div>
              <div className="ds-stat-value" style={{ fontSize: 14, lineHeight: 1.3, marginTop: 4 }}>Document Verification</div>
              <div className="ds-stat-trend neu">In progress</div>
            </div>
          </div>

          {/* APPLICATION STEPPER + DOCUMENTS */}
          <div className="ds-two-col">

            {/* Application Status Stepper */}
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Application Status</span>
              </div>
              <div className="ds-stepper">
                {STEPS.map((step, i) => (
                  <div key={i}>
                    <div className="ds-step">
                      <div className="ds-step-left">
                        <div className={`ds-step-circle ${step.status}`}>
                          {step.status === 'done' ? (
                            <CheckCircle size={16} />
                          ) : step.status === 'active' ? (
                            <Loader2 size={16} style={{ animation: 'dspin 1s linear infinite' }} />
                          ) : (
                            i + 1
                          )}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`ds-step-connector${step.status === 'done' ? ' done' : ''}`} />
                        )}
                      </div>
                      <div className="ds-step-body">
                        <div className={`ds-step-title ${step.status}`}>{step.label}</div>
                        <div className="ds-step-desc">{step.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload Documents */}
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Upload Documents</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {DOCUMENTS.map((doc, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: i < DOCUMENTS.length - 1 ? '1px solid #F4F5F7' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{doc.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`ds-pill ${docPill(doc.status)}`}>{doc.status}</span>
                      {doc.status !== 'Uploaded' && (
                        <label style={{ cursor: 'pointer' }}>
                          <input type="file" style={{ display: 'none' }} />
                          <span className="ds-btn outline sm" style={{ pointerEvents: 'none' }}>Upload</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PROGRAMS OFFERED */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">Programs Offered</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { name: 'B.Tech Computer Science', dur: '4 Years', seats: '60 Seats', fee: '₹1,20,000/yr' },
                { name: 'B.Tech AI & ML',          dur: '4 Years', seats: '60 Seats', fee: '₹1,30,000/yr' },
                { name: 'B.Tech Electronics',       dur: '4 Years', seats: '60 Seats', fee: '₹1,10,000/yr' },
                { name: 'MBA',                      dur: '2 Years', seats: '40 Seats', fee: '₹90,000/yr'   },
                { name: 'BBA',                      dur: '3 Years', seats: '60 Seats', fee: '₹70,000/yr'   },
                { name: 'B.Sc Data Science',        dur: '3 Years', seats: '40 Seats', fee: '₹80,000/yr'   },
                { name: 'M.Tech',                   dur: '2 Years', seats: '20 Seats', fee: '₹1,40,000/yr' },
                { name: 'Ph.D Programs',            dur: '3-5 Yrs', seats: '10 Seats', fee: '₹60,000/yr'   },
              ].map((prog, i) => (
                <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{prog.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>{prog.dur} · {prog.seats}</div>
                  <div style={{ fontSize: 12, color: '#1A56DB', fontWeight: 500 }}>{prog.fee}</div>
                </div>
              ))}
            </div>
          </div>

          {/* IMPORTANT DATES + FAQs */}
          <div className="ds-two-col">
            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Important Dates</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { date: 'Mar 15', event: 'Application Opens',         done: true  },
                  { date: 'Apr 20', event: 'Last Date for Applications', done: true  },
                  { date: 'May 5',  event: 'Merit List Published',       done: false },
                  { date: 'May 15', event: 'Document Verification',      done: false },
                  { date: 'Jun 1',  event: 'Classes Begin',              done: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F4F5F7' }}>
                    <span className={`ds-pill ${item.done ? 'green' : 'gray'}`} style={{ minWidth: 52, justifyContent: 'center' }}>
                      {item.date}
                    </span>
                    <span style={{ fontSize: 13, color: item.done ? '#111827' : '#6B7280' }}>{item.event}</span>
                    {item.done && <CheckCircle size={14} color="#16A34A" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="ds-card">
              <div className="ds-card-header">
                <span className="ds-section-title">Eligibility & FAQs</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { q: 'What is the eligibility for B.Tech?', a: '10+2 with Physics, Chemistry, Math. Minimum 60% marks.' },
                  { q: 'Is there an entrance exam?',          a: 'Yes, we accept JEE Main scores or our own campus test.' },
                  { q: 'What documents are required?',        a: '10th & 12th marksheets, ID proof, passport photo, category certificate.' },
                  { q: 'When does the session start?',        a: 'Academic session begins June 1, 2026.' },
                ].map((faq, i) => (
                  <details key={i} style={{ borderBottom: '1px solid #F4F5F7', padding: '10px 0' }}>
                    <summary style={{ fontSize: 13, fontWeight: 600, color: '#111827', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
                      {faq.q} <span style={{ color: '#9CA3AF', fontSize: 16 }}>+</span>
                    </summary>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, paddingLeft: 4 }}>{faq.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
      <ChatWidget />
    </div>
  );
};

export default AdmissionDashboard;

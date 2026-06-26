import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import {
  GraduationCap, BookOpen, Users, UserPlus, Shield,
  Bot, Map, CheckSquare, AlertTriangle, FolderOpen,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../../components/LoginModal/LoginModal';
import './Landing.css';

// ── Role definitions ────────────────────────────────────────
const ROLES = [
  {
    id:   'student',
    icon: GraduationCap,
    name: 'Student',
    desc: 'Access your courses, attendance and results',
  },
  {
    id:   'faculty',
    icon: BookOpen,
    name: 'Faculty / Teacher',
    desc: 'Manage classes, grades and announcements',
  },
  {
    id:   'parent',
    icon: Users,
    name: 'Parent',
    desc: "Track your child's progress and attendance",
  },
  {
    id:   'admission',
    icon: UserPlus,
    name: 'New Admission',
    desc: 'Begin your admission journey here',
  },
  {
    id:   'admin',
    icon: Shield,
    name: 'College Admin',
    desc: 'Manage campus operations and analytics',
  },
];

// ── Feature definitions ─────────────────────────────────────
const FEATURES = [
  {
    icon:  Bot,
    title: 'AI Help Desk',
    desc:  'Instant AI-powered answers for academic and admin queries',
  },
  {
    icon:  CheckSquare,
    title: 'Real-Time Attendance',
    desc:  'Automated tracking with low-attendance alerts',
  },
  {
    icon:  FolderOpen,
    title: 'Academic Drive',
    desc:  'Centralized notes, papers, and resources',
  },
  {
    icon:  AlertTriangle,
    title: 'Smart Complaints',
    desc:  'Raise, track and resolve grievances instantly',
  },
  {
    icon:  LayoutDashboard,
    title: 'Role-Based Dashboards',
    desc:  'Personalized views for every campus role',
  },
  {
    icon:  Map,
    title: 'Virtual Campus Tour',
    desc:  'Explore campus facilities from anywhere',
  },
];

// ── Stats ───────────────────────────────────────────────────
const STATS = [
  { value: 4536, suffix: '+',  label: 'Students Enrolled' },
  { value: 200,  suffix: '+',  label: 'Expert Faculty'     },
  { value: 94,   suffix: '%',  label: 'Placement Rate'     },
  { value: 24,   suffix: 'x7', label: 'AI Support'         },
];

// ── About highlights ────────────────────────────────────────
const HIGHLIGHTS = [
  'Multi-agent AI helpdesk for instant answers',
  'Role-based access for all campus stakeholders',
  'Real-time attendance and academic tracking',
  '360-degree virtual campus experience',
  'Integrated complaint and grievance management',
];

// ── Animated Number ─────────────────────────────────────────
const AnimatedNumber = ({ value, suffix, inView }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(value / 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(start);
    }, 25);
    return () => clearInterval(timer);
  }, [inView, value]);
  return <>{count}{suffix}</>;
};

// ── Dashboard redirects ─────────────────────────────────────
const ROLE_DASHBOARDS = {
  student:   '/student/dashboard',
  faculty:   '/faculty/dashboard',
  parent:    '/parent/dashboard',
  admission: '/admission/dashboard',
  admin:     '/admin/dashboard',
};

// ── Landing Page ────────────────────────────────────────────
const Landing = () => {
  const { user, loading } = useAuth();

  const [scrolled,    setScrolled]    = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [statsInView, setStatsInView] = useState(false);
  const statsRef = useRef(null);

  // Navbar scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Stats intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsInView(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // Redirect if already logged in
  if (!loading && user) {
    return <Navigate to={ROLE_DASHBOARDS[user.role] || '/'} replace />;
  }

  const openModal  = (roleId) => setActiveModal(roleId);
  const closeModal = ()       => setActiveModal(null);

  const handleExplore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>

      {/* ── NAVBAR ── */}
      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <a className="nav-brand" href="/">
          {/* Cap-and-gown SVG icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          <span className="nav-brand-logo-text">
            CampusSphere<span className="brand-ai"> AI</span>
          </span>
        </a>

        <div className="landing-nav-links">
          <button className="landing-nav-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Home
          </button>
          <button className="landing-nav-link" onClick={() => scrollToSection('features')}>
            Features
          </button>
          <button className="landing-nav-link" onClick={() => scrollToSection('about')}>
            About
          </button>
          <button className="landing-nav-link" onClick={() => scrollToSection('footer')}>
            Contact
          </button>
        </div>

        <div className="landing-nav-actions">
          <button className="btn-outline" style={{ height: 38, fontSize: 14 }} onClick={() => openModal('student')}>
            Login
          </button>
          <button className="btn-primary" style={{ height: 38, fontSize: 14 }} onClick={() => openModal('student')}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-pill">
            Powered by Gemini AI
          </div>

          <h1 className="hero-title">
            The Smart Campus Platform<br />
            for Modern Institutions
          </h1>

          <p className="hero-sub">
            Manage students, faculty, attendance, admissions, and campus
            operations — all in one place.
          </p>

          <div className="hero-cta-row">
            <button className="hero-cta-primary" onClick={handleExplore}>
              Explore Features
            </button>
            <button className="hero-cta-secondary" onClick={() => openModal('student')}>
              Sign In
            </button>
          </div>

          <div className="hero-stats-row">
            <span className="hero-stat-item">4536+ Students</span>
            <div className="hero-stat-separator" />
            <span className="hero-stat-item">200+ Faculty</span>
            <div className="hero-stat-separator" />
            <span className="hero-stat-item">AI Powered 24x7</span>
          </div>
        </div>
      </section>

      {/* ── WHO ARE YOU ── */}
      <section className="roles-section">
        <div className="section-header">
          <div className="section-label">GET STARTED</div>
          <h2 className="section-title">Select Your Role to Continue</h2>
          <p className="section-sub">
            Access your personalized dashboard based on your campus role.
          </p>
        </div>

        <div className="roles-grid">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.id}
                className="role-card"
                onClick={() => openModal(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && openModal(r.id)}
              >
                <div className="role-icon-wrap">
                  <Icon size={24} color="#1A56DB" strokeWidth={1.75} />
                </div>
                <div className="role-name">{r.name}</div>
                <div className="role-desc">{r.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="features-section">
        <div className="section-wrap">
          <div className="section-header">
            <div className="section-label">FEATURES</div>
            <h2 className="section-title">Everything Your Campus Needs</h2>
            <p className="section-sub">
              A unified platform built for every stakeholder in your institution.
            </p>
          </div>

          <div className="features-grid">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="feature-card">
                  <div className="feature-icon">
                    <Icon size={22} color="#1A56DB" strokeWidth={1.75} />
                  </div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="stats-section" ref={statsRef}>
        <div className="stats-grid">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="stat-number">
                <AnimatedNumber value={s.value} suffix={s.suffix} inView={statsInView} />
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="about-section">
        <div className="about-grid">
          {/* Left: text */}
          <div>
            <div className="section-label">ABOUT</div>
            <h2 className="about-title">About CampusSphere AI</h2>
            <p className="about-text">
              CampusSphere AI is a next-generation smart campus platform built to simplify
              every aspect of institutional life. From real-time attendance tracking to an
              AI-powered helpdesk, we bring all campus operations under one roof.
            </p>
            <ul className="about-highlights">
              {HIGHLIGHTS.map((item) => (
                <li key={item}>
                  <svg
                    className="highlight-check"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="10" cy="10" r="10" fill="rgba(26, 86, 219, 0.1)" />
                    <path
                      d="M6 10.5L8.5 13L14 7.5"
                      stroke="#1A56DB"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: illustration placeholder */}
          <div className="about-img-wrap">
            <img
              src="/assets/images/about-campus.jpg"
              alt="Campus building"
              className="about-img"
              style={{ display: 'none' }}
              onLoad={(e) => {
                e.target.style.display = 'block';
                e.target.nextSibling.style.display = 'none';
              }}
            />
            <div className="about-img-placeholder">
              <div className="about-placeholder-grid">
                {[
                  { icon: CheckSquare, label: 'Attendance', sublabel: '94.2% avg' },
                  { icon: Bot,         label: 'AI Help Desk', sublabel: '24x7 active' },
                  { icon: FolderOpen,  label: 'Drive',         sublabel: '1200+ files' },
                  { icon: LayoutDashboard, label: 'Dashboard', sublabel: '5 roles' },
                ].map(({ icon: Icon, label, sublabel }) => (
                  <div key={label} className="about-placeholder-card">
                    <div className="about-placeholder-icon">
                      <Icon size={16} color="#1A56DB" strokeWidth={1.75} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{sublabel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="footer" className="landing-footer">
        <div className="footer-grid">
          <div>
            <div className="footer-brand-name">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
              CampusSphere<span className="footer-brand-ai"> AI</span>
            </div>
            <p className="footer-tagline">
              Your Smart Campus. Powered by AI.
            </p>
          </div>

          <div>
            <div className="footer-col-title">Quick Links</div>
            <ul className="footer-links">
              <li><a href="/">Home</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#footer">Contact</a></li>
            </ul>
          </div>

          <div>
            <div className="footer-col-title">Contact</div>
            <div className="footer-contact">
              <p>info@campussphere.edu</p>
              <p>+91 98765 43210</p>
              <p>Bengaluru, Karnataka, India</p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          &copy; 2026 CampusSphere AI. All rights reserved.
        </div>
      </footer>

      {/* ── Login Modal ── */}
      {activeModal && (
        <LoginModal role={activeModal} onClose={closeModal} />
      )}
    </div>
  );
};

export default Landing;

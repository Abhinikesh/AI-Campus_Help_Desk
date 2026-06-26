import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  GraduationCap, BookOpen, Users, UserPlus, Shield,
  Bot, Map, CheckSquare, AlertTriangle, FolderOpen, LayoutDashboard,
  ArrowRight, Cpu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginModal from '../../components/LoginModal/LoginModal';
import './Landing.css';

// ── Particles ──────────────────────────────────────────────
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size:  Math.random() * 4 + 2,
  left:  Math.random() * 100,
  delay: Math.random() * 8,
  dur:   Math.random() * 12 + 10,
}));

// ── Role definitions ────────────────────────────────────────
const ROLES = [
  {
    id:       'student',
    icon:     GraduationCap,
    name:     'Student',
    desc:     'Access your courses, attendance & results',
  },
  {
    id:       'faculty',
    icon:     BookOpen,
    name:     'Faculty / Teacher',
    desc:     'Manage classes, grades & announcements',
  },
  {
    id:       'parent',
    icon:     Users,
    name:     'Parent',
    desc:     "Track your child's progress & attendance",
  },
  {
    id:       'admission',
    icon:     UserPlus,
    name:     'New Admission',
    desc:     'Begin your admission journey here',
  },
  {
    id:       'admin',
    icon:     Shield,
    name:     'College Admin',
    desc:     'Manage campus operations & analytics',
  },
];

// ── Feature definitions ─────────────────────────────────────
const FEATURES = [
  { icon: Bot,           title: 'AI Multi-Agent Help Desk',    desc: 'Academic, Admin, Navigation & Complaint agents in one chat' },
  { icon: Map,           title: '360° Virtual Campus Tour',    desc: 'Explore campus virtually from anywhere, anytime'            },
  { icon: CheckSquare,   title: 'Real-Time Attendance',        desc: 'Live attendance tracking with low-attendance alerts'        },
  { icon: AlertTriangle, title: 'Smart Complaint System',      desc: 'Raise, track and resolve complaints instantly'              },
  { icon: FolderOpen,    title: 'Academic Drive',              desc: 'Access notes, papers and resources in one place'           },
  { icon: LayoutDashboard, title: 'Role-Based Dashboards',    desc: 'Personalized experience for every campus role'             },
];

// ── Stats ───────────────────────────────────────────────────
const STATS = [
  { value: 5000, suffix: '+', label: 'Students Enrolled' },
  { value: 200,  suffix: '+', label: 'Expert Faculty'     },
  { value: 94,   suffix: '%', label: 'Placement Rate'     },
  { value: 24,   suffix: 'x7', label: 'AI Support'        },
];

// ── AnimatedNumber component ────────────────────────────────
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

// ── Landing Page ────────────────────────────────────────────
const ROLE_DASHBOARDS = {
  student:   '/student/dashboard',
  faculty:   '/faculty/dashboard',
  parent:    '/parent/dashboard',
  admission: '/admission/dashboard',
  admin:     '/admin/dashboard',
};

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [scrolled,    setScrolled]    = useState(false);
  const [activeModal, setActiveModal] = useState(null); // role string | null
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

  // ── If already authenticated, redirect to their dashboard ──
  // We wait until loading=false so we don't redirect before the JWT check completes
  if (!loading && user) {
    return <Navigate to={ROLE_DASHBOARDS[user.role] || '/'} replace />;
  }

  const openModal  = (roleId) => setActiveModal(roleId);
  const closeModal = ()       => setActiveModal(null);

  const handleExplore = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>

      {/* ── NAVBAR ── */}
      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <a className="nav-brand" href="/">
          <GraduationCap size={28} color="#3b82f6" strokeWidth={2} />
          <span className="nav-brand-text">
            Campus<span>Sphere</span> AI
          </span>
        </a>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section">
        {/* 🖼️ REPLACE: put your image file named 'hero-bg.jpg' in /client/public/assets/images/ */}
        <img
          src="/assets/images/hero-bg.jpg"
          alt="Campus aerial view"
          className="hero-bg-img"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="hero-overlay" />

        {/* Floating particles */}
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              width:  p.size,
              height: p.size,
              left:   `${p.left}%`,
              bottom: '-20px',
              animationDuration:  `${p.dur}s`,
              animationDelay:     `${p.delay}s`,
              opacity: 0,
            }}
          />
        ))}

        <div className="hero-content">
          <div className="hero-eyebrow">
            <Cpu size={13} />
            Powered by Gemini AI
          </div>

          <h1 className="hero-title">
            Your AI-Powered<br />
            <span className="gradient-text">Smart Campus</span>
          </h1>

          <p className="hero-sub">
            One platform for students, faculty, parents and admin.
            Powered by multi-agent AI for real answers, real fast.
          </p>

          <div className="hero-cta-row">
            <button className="btn-primary" onClick={handleExplore}
              style={{ fontSize: 16, padding: '14px 32px' }}>
              Explore Features
            </button>
            <button className="btn-outline" onClick={() => openModal('student')}
              style={{ fontSize: 16, padding: '14px 32px' }}>
              Get Started
            </button>
          </div>

          <div className="hero-badges">
            {[
              { icon: '🎓', text: '5000+ Students'   },
              { icon: '👨‍🏫', text: '200+ Faculty'     },
              { icon: '🤖', text: 'AI Powered 24×7'  },
            ].map((b) => (
              <div key={b.text} className="hero-badge">
                <span>{b.icon}</span> {b.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO ARE YOU ── */}
      <section className="roles-section">
        <div className="section-header">
          <div className="section-tag">Get Started</div>
          <h2 className="section-title">Who Are You?</h2>
          <p className="section-sub">Select your role to access your personalised dashboard</p>
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
                  <Icon size={28} color="#3b82f6" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="role-name">{r.name}</div>
                  <div className="role-desc">{r.desc}</div>
                </div>
                <div className="role-arrow">
                  <ArrowRight size={18} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features">
        <div className="section-wrap">
          <div className="section-header">
            <div className="section-tag">Features</div>
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-sub">
              Everything you need for a seamless campus experience, all in one place
            </p>
          </div>

          <div className="features-grid">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="feature-card">
                  <div className="feature-icon">
                    <Icon size={26} color="#3b82f6" strokeWidth={1.75} />
                  </div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
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
      <section style={{ padding: '96px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px' }}>
          <div className="about-grid">
            {/* Left: text */}
            <div>
              <div className="section-tag">About</div>
              <h2 className="about-title" style={{ marginTop: 14 }}>
                About <span className="gradient-text">CampusSphere AI</span>
              </h2>
              <p className="about-text">
                CampusSphere AI is a next-generation smart campus platform designed to simplify
                every aspect of college life. From real-time attendance and results to an intelligent
                helpdesk powered by Gemini AI, we bring all campus services under one roof.
              </p>
              <ul className="about-highlights">
                {[
                  'Multi-agent AI helpdesk for instant answers',
                  'Role-based access for 5 campus stakeholders',
                  'Real-time attendance & academic tracking',
                  '360° virtual campus tour experience',
                  'Integrated complaint & grievance system',
                ].map((item) => (
                  <li key={item}>
                    <div className="highlight-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: image */}
            <div className="about-img-wrap">
              {/* 🖼️ REPLACE: put your image file named 'about-campus.jpg' in /client/public/assets/images/ */}
              <img
                src="/assets/images/about-campus.jpg"
                alt="Campus building"
                className="about-img"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="about-img-placeholder" style={{ display: 'none' }}>
                <GraduationCap size={80} color="rgba(255,255,255,0.2)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <div className="footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <GraduationCap size={24} color="#3b82f6" />
              <div className="footer-brand-name">CampusSphere AI</div>
            </div>
            <p className="footer-tagline">
              Your Smart Campus. Powered by AI. One platform for every campus stakeholder.
            </p>
          </div>

          <div>
            <div className="footer-col-title">Quick Links</div>
            <ul className="footer-links">
              <li><a href="/">Home</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#about">About</a></li>
            </ul>
          </div>

          <div>
            <div className="footer-col-title">Contact</div>
            <div className="footer-contact">
              <p>info@campussphere.edu</p>
              <p style={{ marginTop: 6 }}>+91 98765 43210</p>
              <p style={{ marginTop: 6 }}>Bengaluru, Karnataka, India</p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          © 2026 CampusSphere AI. All rights reserved. · Built with ❤️ using Gemini AI
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

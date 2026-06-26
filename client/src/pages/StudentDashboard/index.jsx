import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/student.service';
import Navbar from '../../components/Navbar/Navbar';
import { 
  CheckCircle, 
  Calendar, 
  CreditCard, 
  AlertCircle, 
  ChevronRight,
  BookOpen,
  FolderDot,
  MessageSquare,
  Map,
  FileWarning,
  GraduationCap,
  Loader2
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import './Student.css';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [profRes, annRes, compRes] = await Promise.all([
          studentService.getProfile(),
          studentService.getAnnouncements(),
          studentService.getComplaints()
        ]);

        if (profRes.success) setProfile(profRes.data);
        // Use global announcements API; fall back to student's embedded announcements
        if (annRes.success && annRes.data.length > 0) {
          setAnnouncements(annRes.data.slice(0, 3));
        } else if (profRes.success && profRes.data.announcements?.length > 0) {
          setAnnouncements(profRes.data.announcements.slice(0, 3));
        }
        if (compRes.success) setComplaints(compRes.data);
      } catch (err) {
        console.error('Error fetching student data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Loading Campus Hub...
      </div>
    );
  }

  const studentName = profile?.userId?.name || user?.name || 'Student';
  // Compute percentage from attended/total (model has no stored .percentage field)
  const attendanceAvg = profile?.attendance?.length
    ? Math.round(
        profile.attendance.reduce((acc, curr) =>
          acc + (curr.total > 0 ? (curr.attended / curr.total) * 100 : 0), 0
        ) / profile.attendance.length
      )
    : 0;

  return (
    <div className="dashboard-layout">
      <Navbar />
      
      <main className="dashboard-content">
        {/* SUBSECTION A: HERO WELCOME BANNER */}
        <section className="hero-banner">
          <div className="hero-content">
            <p className="hero-greeting">Welcome back 👋</p>
            <h1 className="hero-title">Good Morning, {studentName}!</h1>
            <p className="hero-subtitle">Here's your campus update for today.</p>
            
            <div className="hero-actions">
              <Link to="/student/ai-help" className="btn btn-primary">Ask Campus AI</Link>
              <Link to="/student/attendance" className="btn btn-outline">View Attendance</Link>
            </div>
          </div>
          <div className="hero-image-container">
            <img 
              src={`/assets/images/student-hero.jpg`} 
              alt="Student studying" 
              className="hero-image"
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop';
              }}
            />
          </div>
        </section>

        {/* SUBSECTION B: QUICK STATS ROW */}
        <section className="stats-grid">
          {/* Card 1 */}
          <div className="stat-card stat-attendance">
            <div className="stat-header">
              <span className="stat-label">Overall Attendance</span>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <div className="stat-value">{attendanceAvg}%</div>
            {attendanceAvg < 75 && <p className="stat-warning mt-2 text-xs text-red-500">⚠ Below required 75%</p>}
          </div>

          {/* Card 2 */}
          <div className="stat-card stat-exam">
            <div className="stat-header">
              <span className="stat-label">Next Event</span>
              <Calendar size={32} color="#3b82f6" />
            </div>
            <div className="stat-value">Mid-Sem Exams</div>
          </div>

          {/* Card 3 */}
          <div className="stat-card stat-fee">
            <div className="stat-header">
              <span className="stat-label">Fee Due</span>
              <CreditCard size={32} color="#f59e0b" />
            </div>
            <div className="stat-value-row">
              <div className="stat-value">₹{(profile?.fees?.due ?? 0).toLocaleString()}</div>
              {profile?.fees?.due > 0 && <Link to="/student/fees" className="btn-small-link">Pay Now</Link>}
            </div>
          </div>

          {/* Card 4 */}
          <div className="stat-card stat-complaints">
            <div className="stat-header">
              <span className="stat-label">My Complaints</span>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <div className="stat-value">{complaints.filter(c => c.status !== 'resolved').length}</div>
          </div>
        </section>

        {/* SUBSECTION C: ATTENDANCE PREVIEW */}
        <section className="attendance-preview-section">
          <div className="section-header">
            <h2>Attendance Overview</h2>
            <Link to="/student/attendance" className="view-all-link">View All →</Link>
          </div>
          
          <div className="subject-cards-row">
            {profile?.attendance?.slice(0, 5).map((subject, idx) => (
              <div key={idx} className="subject-card">
                <div className="subject-info">
                  <h3 className="subject-name">{subject.subject}</h3>
                  <span className="subject-code">{subject.code}</span>
                </div>
                <div className="progress-ring-container">
                  <svg className="progress-ring" viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="40" />
                    <circle 
                      className={`ring-progress ${(subject.total > 0 ? (subject.attended/subject.total)*100 : 0) < 75 ? 'red-ring' : 'green-ring'}`} 
                      cx="50" cy="50" r="40" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={251.2 * (1 - (subject.total > 0 ? subject.attended/subject.total : 0))} 
                    />
                    <text x="50" y="55" className="ring-text">{subject.total > 0 ? Math.round((subject.attended/subject.total)*100) : 0}%</text>
                  </svg>
                  <div className={`attendance-ratio ${(subject.total > 0 ? (subject.attended/subject.total)*100 : 0) < 75 ? 'warning-text' : ''}`}>
                    Attended: {subject.attended} / Total: {subject.total}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUBSECTION D: RECENT RESULTS */}
        <section className="recent-results-section">
          <div className="section-header">
            <h2>Recent Results</h2>
            <Link to="/student/results" className="view-all-link">View All →</Link>
          </div>
          
          <div className="table-card">
            <div className="table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Marks</th>
                    <th>Max</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile?.results?.length > 0 ? (
                    profile.results.slice(0, 5).map((res, idx) => (
                      <tr key={idx}>
                        <td>{res.subject}</td>
                        <td>{res.code}</td>
                        <td className="fw-bold">{res.marks}</td>
                        <td>{res.maxMarks}</td>
                        <td><span className={`grade-pill grade-${res.grade.toLowerCase().replace('+', 'plus')}`}>{res.grade}</span></td>
                        <td>{res.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No recent results found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SUBSECTION E: ANNOUNCEMENTS + QUICK LINKS */}
        <section className="two-col-layout">
          {/* Announcements */}
          <div className="announcements-col">
            <div className="panel-card">
              <h2>📢 Announcements</h2>
              <div className="announcement-list">
                {announcements.length > 0 ? (
                  announcements.map((ann, idx) => (
                    <React.Fragment key={ann._id}>
                      <div className="announcement-item">
                        <div className="announcement-top">
                          <h3 className="announcement-title">{ann.title}</h3>
                          <span className="announcement-date">{new Date(ann.date).toLocaleDateString()}</span>
                        </div>
                        <p className="announcement-body">{ann.body}</p>
                      </div>
                      {idx < announcements.length - 1 && <div className="divider"></div>}
                    </React.Fragment>
                  ))
                ) : (
                  <p className="p-4 text-slate-400 text-sm">No recent announcements.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="quicklinks-col">
            <div className="panel-card">
              <h2>⚡ Quick Links</h2>
              <div className="quicklinks-list">
                <Link to="/student/exams" className="quicklink-btn">
                  <div className="ql-left"><Calendar className="ql-icon" size={20} /> My Timetable</div>
                  <ChevronRight size={18} className="ql-chevron" />
                </Link>
                <Link to="/student/drive" className="quicklink-btn">
                  <div className="ql-left"><FolderDot className="ql-icon" size={20} /> Academic Drive</div>
                  <ChevronRight size={18} className="ql-chevron" />
                </Link>
                <Link to="/student/ai-help" className="quicklink-btn">
                  <div className="ql-left"><MessageSquare className="ql-icon" size={20} /> AI Help Desk</div>
                  <ChevronRight size={18} className="ql-chevron" />
                </Link>
                <Link to="/student/virtual-tour" className="quicklink-btn">
                  <div className="ql-left"><Map className="ql-icon" size={20} /> Virtual Tour</div>
                  <ChevronRight size={18} className="ql-chevron" />
                </Link>
                <Link to="/student/complaints" className="quicklink-btn">
                  <div className="ql-left"><FileWarning className="ql-icon" size={20} /> Raise Complaint</div>
                  <ChevronRight size={18} className="ql-chevron" />
                </Link>
                <Link to="/student/results" className="quicklink-btn">
                  <div className="ql-left"><GraduationCap className="ql-icon" size={20} /> Results</div>
                  <ChevronRight size={18} className="ql-chevron" />
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <ChatWidget />
    </div>
  );
};

export default StudentDashboard;

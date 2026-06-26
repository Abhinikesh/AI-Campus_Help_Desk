import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';
import { parentService } from '../../services/parent.service';
import { 
  AlertTriangle, CheckCircle, CreditCard, Calendar, 
  Phone, Mail, Loader2, User as UserIcon 
} from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import './Parent.css';

const ParentDashboard = () => {
  const { user } = useAuth() || {};
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await parentService.getStudentData();
        if (res.success) setStudentData(res.data);
      } catch (err) {
        console.error('Error fetching parent student data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateAttendance = () => {
    if (!studentData?.attendance?.length) return 0;
    const totalAttended = studentData.attendance.reduce((sum, item) => sum + (item.attended || 0), 0);
    const totalPossible = studentData.attendance.reduce((sum, item) => sum + (item.total || 0), 0);
    return totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;
  };

  const calculateCGPA = () => {
    if (!studentData?.results?.length) return 0;
    const avg = studentData.results.reduce((sum, r) => sum + (r.marks || 0), 0) / studentData.results.length;
    return (avg / 10).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Loading Student Records...
      </div>
    );
  }

  const attendance = calculateAttendance();
  const cgpa = calculateCGPA();
  const fees = studentData?.fees || { due: 0 };
  const nextExam = studentData?.exams?.[0] || { date: 'TBA', subject: 'N/A' };

  return (
    <div className="parent-layout">
      <Navbar />
      
      <main className="parent-content">
        {/* HERO BANNER */}
        <section className="parent-hero">
          <div className="p-hero-left">
            <p className="p-hero-greeting">Welcome, {user?.name || 'Parent'} 👋</p>
            <h1 className="p-hero-title">Monitoring: {studentData?.studentName || 'Student'}</h1>
            <p className="p-hero-subtitle">
              Roll Number: {studentData?.rollNumber || 'N/A'} • {studentData?.branch || 'General'}
            </p>
            
            <div className="p-hero-actions">
              <button className="btn btn-primary" onClick={() => window.location.href='/parent/ai-help'}>Ask Campus AI</button>
              <button className="btn btn-outline" onClick={() => window.location.href='/parent/virtual-tour'}>Virtual Tour</button>
            </div>
          </div>
          <div className="p-hero-right">
            <div className="image-fallback p-fallback">
              <UserIcon size={48} className="text-slate-500" />
              <span className="fallback-text">Student Profile</span>
            </div>
            <img 
              src={`/assets/images/parent-hero.jpg`} 
              alt="Parent" 
              className="p-hero-img"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.previousSibling.style.display = 'flex';
              }}
            />
          </div>
        </section>

        {/* CHILD STATS ROW */}
        <section className="p-stats-grid">
          <div className="p-stat-card">
            <div className="p-stat-header">
              <span className="p-stat-label">Overall Attendance</span>
              <AlertTriangle size={32} className={attendance < 75 ? "text-red" : "text-gold"} />
            </div>
            <div className="p-stat-val">{attendance}%</div>
            <div className={`p-stat-subtext ${attendance < 75 ? 'text-red' : 'text-gold'}`}>
              {attendance < 75 ? '⚠ High Priority' : '✅ Moderate'}
            </div>
          </div>
          <div className="p-stat-card">
            <div className="p-stat-header">
              <span className="p-stat-label">Current CGPA</span>
              <CheckCircle size={32} className="text-green" />
            </div>
            <div className="p-stat-val">{cgpa} / 10</div>
            <div className="p-stat-subtext text-green">
              {Number(cgpa) > 8 ? '✅ Excellent' : '📈 Good Standing'}
            </div>
          </div>
          <div className="p-stat-card">
            <div className="p-stat-header">
              <span className="p-stat-label">Fee Due</span>
              <CreditCard size={32} className="text-red" />
            </div>
            <div className="p-stat-val">₹{fees.due.toLocaleString()}</div>
            <div className="p-stat-subtext text-red">
              {fees.due > 0 ? '⚠ Payment Pending' : '✅ Cleared'}
            </div>
          </div>
          <div className="p-stat-card">
            <div className="p-stat-header">
              <span className="p-stat-label">Upcoming Exam</span>
              <Calendar size={32} className="text-blue" />
            </div>
            <div className="p-stat-val">{nextExam.date.split(',')[0]}</div>
            <div className="p-stat-subtext text-blue">{nextExam.subject}</div>
          </div>
        </section>

        {/* THREE COLUMN SECTION */}
        <section className="p-three-col">
          {/* Announcements */}
          <div className="p-col-card">
            <h2 className="section-title">Latest Announcements</h2>
            <div className="p-announcements-list">
              {studentData?.announcements?.length > 0 ? (
                studentData.announcements.map((ann, i) => (
                  <React.Fragment key={ann._id}>
                    <div className="p-announce-item">
                      <div className="p-announce-top">
                        <span className="fw-bold fs-14">{ann.title}</span>
                        <span className="p-announce-date">{new Date(ann.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="p-announce-body">{ann.body}</p>
                    </div>
                    {i < studentData.announcements.length - 1 && <div className="p-divider"></div>}
                  </React.Fragment>
                ))
              ) : (
                <p className="text-slate-500 text-center py-4">No recent announcements.</p>
              )}
            </div>
          </div>

          {/* Academic Calendar */}
          <div className="p-col-card">
            <h2 className="section-title">Academic Calendar</h2>
            <div className="p-timeline-list">
              <div className="p-time-item">
                <span className="p-time-pill blue-pill">{nextExam.date.split(',')[0]}</span>
                <span className="p-time-text">Mid-Semester Exams Begin</span>
              </div>
              <div className="p-time-item">
                <span className="p-time-pill green-pill">Apr 25</span>
                <span className="p-time-text">Parent-Teacher Meeting</span>
              </div>
              <div className="p-time-item">
                <span className="p-time-pill gold-pill">May 1</span>
                <span className="p-time-text">Holiday - Spring Break</span>
              </div>
              <div className="p-time-item">
                <span className="p-time-pill red-pill">May 15</span>
                <span className="p-time-text">Final Sem Exams Start</span>
              </div>
            </div>
          </div>

          {/* Student Guidance */}
          <div className="p-col-card">
            <h2 className="section-title">Student Guidance</h2>
            <div className="p-guidance-list">
              <div className="p-guide-box">
                <div className="fw-bold fs-14 mb-2">Grading System</div>
                <p className="p-guide-text">A+(90-100), A(80-89), B(70-79), C(60-69), F(&lt;50)</p>
              </div>
              <div className="p-guide-box">
                <div className="fw-bold fs-14 mb-2">Attendance Policy</div>
                <p className="p-guide-text">Minimum 75% aggregate required for exams.</p>
              </div>
              <div className="p-guide-box">
                <div className="fw-bold fs-14 mb-2">Examination Rules</div>
                <p className="p-guide-text">Carry valid ID card, no mobile phones allowed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT SECTION */}
        <section className="p-contact-section">
          <h2 className="section-title">Campus Contact Directory</h2>
          <div className="p-contact-grid">
            <div className="p-contact-card">
              <div className="p-contact-icon-bg"><Phone size={24} color="#3b82f6" /></div>
              <div className="p-contact-info">
                <h3 className="p-contact-dept">Academic Office</h3>
                <p className="p-contact-detail">+91-9876-543-210</p>
                <p className="p-contact-detail flex-email" onClick={() => navigator.clipboard.writeText('academic@campus.edu')} title="Click to copy"><Mail size={14}/> academic@campus.edu</p>
              </div>
            </div>
            <div className="p-contact-card">
              <div className="p-contact-icon-bg"><Phone size={24} color="#8b5cf6" /></div>
              <div className="p-contact-info">
                <h3 className="p-contact-dept">Administration</h3>
                <p className="p-contact-detail">+91-9876-543-211</p>
                <p className="p-contact-detail flex-email" onClick={() => navigator.clipboard.writeText('admin@campus.edu')} title="Click to copy"><Mail size={14}/> admin@campus.edu</p>
              </div>
            </div>
            <div className="p-contact-card">
              <div className="p-contact-icon-bg"><Phone size={24} color="#f59e0b" /></div>
              <div className="p-contact-info">
                <h3 className="p-contact-dept">Student Affairs</h3>
                <p className="p-contact-detail">+91-9876-543-212</p>
                <p className="p-contact-detail flex-email" onClick={() => navigator.clipboard.writeText('studentaffairs@campus.edu')} title="Click to copy"><Mail size={14}/> studentaffairs@campus.edu</p>
              </div>
            </div>
            <div className="p-contact-card">
              <div className="p-contact-icon-bg"><Phone size={24} color="#22c55e" /></div>
              <div className="p-contact-info">
                <h3 className="p-contact-dept">Fee Payment</h3>
                <p className="p-contact-detail">+91-9876-543-213</p>
                <p className="p-contact-detail flex-email" onClick={() => navigator.clipboard.writeText('fees@campus.edu')} title="Click to copy"><Mail size={14}/> fees@campus.edu</p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <ChatWidget />
    </div>
  );
};

export default ParentDashboard;

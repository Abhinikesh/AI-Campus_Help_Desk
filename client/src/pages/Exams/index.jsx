import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { studentService } from '../../services/student.service';
import {
  Calendar, MapPin, Clock, Download, AlertCircle,
  LayoutDashboard, CalendarCheck, BookOpen,
  BarChart2, Folder, Flag, MessageCircle, Menu, X
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Exams.css';

const sideNav = [
  { label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard },
  { label: 'Attendance', to: '/student/attendance', icon: CalendarCheck },
  { label: 'Exams', to: '/student/exams', icon: BookOpen },
  { label: 'Results', to: '/student/results', icon: BarChart2 },
  { label: 'Drive', to: '/student/drive', icon: Folder },
  { label: 'Complaints', to: '/student/complaints', icon: Flag },
  { label: 'AI Help', to: '/student/ai-help', icon: MessageCircle },
];

const Exams = () => {
  const location = useLocation();
  const [sideOpen, setSideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const res = await studentService.getExams();
        if (res.success) setExams(res.data);
      } catch (err) {
        console.error('Error fetching exams:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner"></div>
        <div className="ds-loading-text">Loading Exam Schedule...</div>
      </div>
    );
  }

  const upcomingExams = exams.filter(e => new Date(e.date) >= new Date() || !isNaN(Date.parse(e.date)));

  return (
    <div className="exams-layout" style={{ marginLeft: 48 }}>
      {/* Collapsible Floating Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200,
        background: '#1E293B', width: sideOpen ? 220 : 48, transition: 'width 0.25s ease',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 16px rgba(0,0,0,0.2)'
      }}>
        {/* Logo area */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #334155', minHeight: 56 }}>
          <button
            onClick={() => setSideOpen(o => !o)}
            style={{
              background: 'none', border: 'none', color: '#94A3B8',
              cursor: 'pointer', fontSize: 20, width: 48, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            {sideOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {sideOpen && (
            <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', paddingRight: 12 }}>
              CampusSphere
            </span>
          )}
        </div>

        {/* Nav Links */}
        {sideNav.map(n => {
          const Icon = n.icon;
          const active = location.pathname === n.to;
          return (
            <Link key={n.to} to={n.to} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              color: active ? '#60A5FA' : '#94A3B8',
              textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap',
              background: active ? 'rgba(96,165,250,0.12)' : 'transparent',
              borderLeft: active ? '3px solid #60A5FA' : '3px solid transparent',
              transition: 'background 0.15s',
            }}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {sideOpen && <span>{n.label}</span>}
            </Link>
          );
        })}
      </div>

      <main className="exams-content">
        <h1 className="page-title">Exam Schedule</h1>

        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
          </button>
          <button 
            className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>

        {activeTab === 'upcoming' && (
          <div className="exams-list">
            {upcomingExams.length > 0 ? (
              upcomingExams.map((exam, i) => {
                const dateObj = new Date(exam.date);
                const day = !isNaN(dateObj) ? dateObj.getDate() : exam.date.split(' ')[1]?.replace(',', '') || '??';
                const month = !isNaN(dateObj) ? dateObj.toLocaleString('default', { month: 'short' }) : exam.date.split(' ')[0] || '??';
                
                return (
                  <div className="exam-card" key={i}>
                    <div className="exam-date-block">
                      <span className="date-day">{day}</span>
                      <span className="date-month">{month}</span>
                    </div>
                    
                    <div className="exam-details">
                      <div className="exam-header">
                        <h3 className="exam-subject">{exam.subject}</h3>
                        <span className="exam-code">{exam.code}</span>
                      </div>
                      <div className="exam-meta">
                        <span className="exam-time"><Clock size={14}/> {exam.time}</span>
                        <span className="exam-room"><MapPin size={14}/> {exam.room}</span>
                      </div>
                    </div>

                    <div className="exam-actions">
                      <span className={`days-badge ${exam.type === 'final' ? 'red-badge' : 'yellow-badge'}`}>
                        {exam.type?.toUpperCase()}
                      </span>
                      <button className="btn btn-outline download-btn flex items-center gap-2">
                        <Download size={16}/> Hall Ticket
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ds-empty">
                <Calendar size={48} />
                <p>No upcoming exams scheduled at the moment.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="ds-empty">
             <AlertCircle size={48} />
             <p>No completed exams found for the current session.</p>
          </div>
        )}

      </main>
    </div>
  );
};

export default Exams;

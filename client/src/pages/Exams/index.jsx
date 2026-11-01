import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import { useSidebar } from '../../context/SidebarContext';
import { studentService } from '../../services/student.service';
import { Calendar, MapPin, Clock, Download, AlertCircle } from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Exams.css';

const Exams = () => {
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await studentService.getExams();
        if (res.success) setExams(res.data);
      } catch (err) {
        console.error('Error fetching exams:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner"></div>
        <div className="ds-loading-text">Loading Exam Schedule...</div>
      </div>
    );
  }

  const now = new Date();
  const upcomingExams = exams.filter(
    (e) => (new Date(e.rawDate || e.date) >= now || e.status === 'scheduled') && e.status !== 'completed'
  );
  const completedExams = exams.filter(
    (e) => new Date(e.rawDate || e.date) < now || e.status === 'completed'
  );

  return (
    <div className="ds-shell">
      <Sidebar />

      <div
        className="ds-main"
        style={{
          marginLeft: isCollapsed ? 64 : 240,
          transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">Exam Schedule</h1>
            <span className="ds-pill blue">Semester 5 (2026–2027)</span>
          </div>
        </header>

        <main className="ds-content">
          {/* Tabs */}
          <div className="tabs-container" style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
            <button
              className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                background: activeTab === 'upcoming' ? '#1A56DB' : '#F3F4F6',
                color: activeTab === 'upcoming' ? '#fff' : '#374151',
              }}
            >
              Upcoming
            </button>
            <button
              className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                background: activeTab === 'completed' ? '#1A56DB' : '#F3F4F6',
                color: activeTab === 'completed' ? '#fff' : '#374151',
              }}
            >
              Completed
            </button>
          </div>

          {activeTab === 'upcoming' && (
            <div className="exams-list">
              {upcomingExams.length > 0 ? (
                upcomingExams.map((exam, i) => {
                  const dateObj = new Date(exam.date);
                  const day = !isNaN(dateObj) ? dateObj.getDate() : exam.date?.split(' ')[1]?.replace(',', '') || '??';
                  const month = !isNaN(dateObj) ? dateObj.toLocaleString('default', { month: 'short' }) : exam.date?.split(' ')[0] || '??';

                  return (
                    <div className="exam-card" key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 20,
                      background: '#fff', border: '1px solid #E5E7EB',
                      borderRadius: 12, padding: '18px 24px', marginBottom: 12,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{
                        minWidth: 60, textAlign: 'center', background: '#EFF6FF',
                        borderRadius: 10, padding: '10px 8px',
                      }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#1A56DB', lineHeight: 1 }}>{day}</div>
                        <div style={{ fontSize: 11, color: '#60A5FA', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{month}</div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{exam.subject}</h3>
                          <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{exam.code}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6B7280' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13}/> {exam.time}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13}/> {exam.room}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                          background: exam.type === 'final' ? '#FEF2F2' : '#FFFBEB',
                          color: exam.type === 'final' ? '#DC2626' : '#D97706',
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          {exam.type === 'final' ? 'End-Semester' : 'Mid-Semester'} Exam
                        </span>
                        <button style={{
                          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                          padding: '6px 14px', borderRadius: 8, border: '1px solid #D1D5DB',
                          background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 500,
                        }}>
                          <Download size={14}/> Hall Ticket
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
            <div className="exams-list">
              {completedExams.length > 0 ? (
                completedExams.map((exam, i) => {
                  const dateObj = new Date(exam.date);
                  const day = !isNaN(dateObj) ? dateObj.getDate() : '??';
                  const month = !isNaN(dateObj) ? dateObj.toLocaleString('default', { month: 'short' }) : '??';

                  return (
                    <div
                      className="exam-card"
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        background: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: 12,
                        padding: '18px 24px',
                        marginBottom: 12,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        opacity: 0.9,
                      }}
                    >
                      <div
                        style={{
                          minWidth: 60,
                          textAlign: 'center',
                          background: '#F3F4F6',
                          borderRadius: 10,
                          padding: '10px 8px',
                        }}
                      >
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#4B5563', lineHeight: 1 }}>{day}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{month}</div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{exam.subject}</h3>
                          <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{exam.code}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6B7280' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13}/> {exam.time}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13}/> {exam.room}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#ECFDF5',
                            color: '#059669',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Completed
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="ds-empty">
                  <AlertCircle size={48} />
                  <p>No completed exams found for the current session.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Exams;

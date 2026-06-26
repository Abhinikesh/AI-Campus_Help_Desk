import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { studentService } from '../../services/student.service';
import { Loader2, Calendar, MapPin, Clock, Download, AlertCircle } from 'lucide-react';
import './Exams.css';

const Exams = () => {
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
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Loading Exam Schedule...
      </div>
    );
  }

  const upcomingExams = exams.filter(e => new Date(e.date) >= new Date() || !isNaN(Date.parse(e.date)));
  const completedExams = exams.filter(e => new Date(e.date) < new Date() && !isNaN(Date.parse(e.date)));

  return (
    <div className="exams-layout">
      <Navbar />
      
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
              <div className="empty-state">
                <Calendar size={48} className="mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">No upcoming exams scheduled at the moment.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="empty-state">
             <AlertCircle size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400">No completed exams found for the current session.</p>
          </div>
        )}

      </main>
    </div>
  );
};

export default Exams;

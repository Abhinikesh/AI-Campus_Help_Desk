import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { studentService } from '../../services/student.service';
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import './Attendance.css';

const Attendance = () => {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const [profRes, attRes] = await Promise.all([
          studentService.getProfile(),
          studentService.getAttendance()
        ]);

        if (profRes.success) setProfile(profRes.data);
        if (attRes.success) setAttendance(attRes.data);
      } catch (err) {
        console.error('Error fetching attendance:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  const calculateOverall = () => {
    if (!attendance.length) return 0;
    const totalAttended = attendance.reduce((sum, item) => sum + (item.attended || 0), 0);
    const totalPossible = attendance.reduce((sum, item) => sum + (item.total || 0), 0);
    return totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;
  };

  const overall = calculateOverall();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Loading Attendance Records...
      </div>
    );
  }

  return (
    <div className="attendance-layout">
      <Navbar />
      
      <main className="attendance-content">
        <div className="page-header">
          <h1 className="page-title">My Attendance</h1>
          <span className="semester-badge">Semester {profile?.semester || 'N/A'}</span>
        </div>

        {/* Warning Banner */}
        {overall < 75 && (
          <div className="warning-banner">
            <AlertCircle size={18} />
            <span>Your attendance is below 75%. You may be barred from examinations.</span>
          </div>
        )}

        <div className="overall-attendance-card">
          <h2 className="overall-stat">Overall: {overall}%</h2>
        </div>

        <div className="attendance-grid">
          {attendance.length > 0 ? (
            attendance.map((sub, idx) => {
              const percent = sub.total > 0 ? Math.round((sub.attended / sub.total) * 100) : 0;
              const isLow = percent < 75;
              
              return (
                <div key={idx} className={`attendance-card ${isLow ? 'warning-card' : ''}`}>
                  <div className="att-card-header">
                    <h3 className="att-subject-name">{sub.subject}</h3>
                    <span className="att-subject-code">{sub.code}</span>
                  </div>
                  
                  <div className="progress-ring-container-large">
                    <svg className="progress-ring-large" viewBox="0 0 100 100">
                      <circle className="ring-bg" cx="50" cy="50" r="40" />
                      <circle 
                        className={`ring-progress ${isLow ? 'red-ring' : 'green-ring'}`} 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 * (1 - percent/100)} 
                      />
                      <text x="50" y="55" className="ring-text-large">{percent}%</text>
                    </svg>
                  </div>
                  
                  <div className="att-stats">
                    <p className={`att-ratio ${isLow ? 'text-red' : ''}`}>
                      Attended: {sub.attended} / Total: {sub.total}
                    </p>
                    {isLow && (
                      <div className="att-classes-needed">
                        You need classes to reach 75%
                      </div>
                    )}
                  </div>
                  
                  <div className={`att-trend ${percent > 80 ? 'trend-improving' : 'trend-declining'}`}>
                    {percent > 80 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                    {percent > 80 ? ' Good Standing' : ' Needs Attention'}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 text-slate-400 bg-slate-800/20 rounded-xl">
              No attendance records found.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Attendance;

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';
import { facultyService } from '../../services/faculty.service';
import { BookOpen, Users, ClipboardList, Megaphone, Trash2, Loader2, ChevronRight } from 'lucide-react';
import ChatWidget from '../../components/ChatWidget/ChatWidget';
import './Faculty.css';

const FacultyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const [targetRole, setTargetRole] = useState('student');
  const [posting, setPosting] = useState(false);

  // Attendance Modal State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [attendanceRoster, setAttendanceRoster] = useState({});
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchFacultyData = async () => {
      try {
        setLoading(true);
        const [profRes, ttRes] = await Promise.all([
          facultyService.getProfile(),
          facultyService.getTimetable()
        ]);

        if (profRes.success) setProfile(profRes.data);
        if (ttRes.success) setTimetable(ttRes.data);
      } catch (err) {
        console.error('Error fetching faculty data:', err);
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchFacultyData();
  }, [user]);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcement.trim()) return;

    setPosting(true);
    try {
      const res = await facultyService.createAnnouncement({
        title: `Announcement from Prof. ${user?.name}`,
        body: announcement,
        targetRoles: [targetRole]
      });
      if (res.success) {
        setAnnouncement('');
        alert('Announcement posted successfully!');
      }
    } catch (err) {
      alert('Failed to post announcement');
    } finally {
      setPosting(false);
    }
  };

  const openAttendanceModal = async (slot) => {
    setSelectedClass(slot);
    setShowAttendanceModal(true);
    setStudentsList([]);
    try {
      const res = await facultyService.getStudents();
      if (res.success) {
        setStudentsList(res.data);
        const initialRoster = {};
        res.data.forEach(s => {
          initialRoster[s._id] = 'Present'; // Default to Present
        });
        setAttendanceRoster(initialRoster);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load students');
    }
  };

  const toggleAttendance = (studentId) => {
    setAttendanceRoster(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'Present' ? 'Absent' : 'Present'
    }));
  };

  const submitAttendance = async () => {
    setSubmittingAttendance(true);
    try {
      const attendanceData = studentsList.map(s => ({
        studentId: s._id,
        status: attendanceRoster[s._id],
        subjectName: selectedClass.subject
      }));
      const res = await facultyService.markAttendance({
        subjectCode: selectedClass.code,
        attendanceData
      });
      if (res.success) {
        alert(res.message);
        setShowAttendanceModal(false);
        setSelectedClass(null);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to submit attendance');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Loading Faculty Workspace...
      </div>
    );
  }

  const facultyName = profile?.userId?.name || user?.name || 'Faculty';

  return (
    <div className="faculty-layout">
      <Navbar />
      
      <main className="faculty-content">
        {/* HERO WELCOME BANNER */}
        <section className="faculty-hero">
          <div className="f-hero-left">
            <p className="f-hero-greeting">Welcome back 👋</p>
            <h1 className="f-hero-title">Good Morning, Dr. {facultyName}!</h1>
            <p className="f-hero-subtitle">Department of Computer Science</p>
            
            <div className="f-hero-actions">
              <Link to="/faculty/ai-help" className="btn btn-purple">Open AI Help Desk</Link>
              <Link to="/faculty/timetable" className="btn btn-outline-purple">View Timetable</Link>
            </div>
          </div>
          <div className="f-hero-right">
            <img 
              src={`/assets/images/faculty-hero.jpg`} 
              alt="Faculty" 
              className="f-hero-img"
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1974&auto=format&fit=crop';
              }}
            />
          </div>
        </section>

        {/* QUICK STATS ROW */}
        <section className="f-stats-grid">
          <div className="f-stat-card stat-classes">
            <div className="f-stat-top">
              <span className="f-stat-label">Classes Today</span>
              <BookOpen size={32} color="#8b5cf6" />
            </div>
            <div className="f-stat-val">{timetable.length}</div>
          </div>
          <div className="f-stat-card stat-students">
            <div className="f-stat-top">
              <span className="f-stat-label">Subjects Handled</span>
              <Users size={32} color="#3b82f6" />
            </div>
            <div className="f-stat-val">{profile?.subjects?.length || 0}</div>
          </div>
          <div className="f-stat-card stat-complaints">
            <div className="f-stat-top">
              <span className="f-stat-label">Office Hours</span>
              <ClipboardList size={32} color="#f59e0b" />
            </div>
            <div className="f-stat-val">2hr</div>
          </div>
          <div className="f-stat-card stat-announcements">
            <div className="f-stat-top">
              <span className="f-stat-label">Profile Status</span>
              <Megaphone size={32} color="#22c55e" />
            </div>
            <div className="f-stat-val">Active</div>
          </div>
        </section>

        {/* TODAY'S TIMETABLE */}
        <section className="f-timetable-section">
          <h2 className="section-title">Today's Schedule</h2>
          <div className="f-table-card">
            <div className="table-wrapper">
              <table className="f-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Room</th>
                    <th>Batch</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.length > 0 ? (
                    timetable.map((slot, idx) => (
                      <tr key={idx}>
                        <td>{slot.startTime} - {slot.endTime}</td>
                        <td className="fw-bold">{slot.subject}</td>
                        <td><span className="code-badge">{slot.code}</span></td>
                        <td>{slot.room}</td>
                        <td>{slot.batch || 'All'}</td>
                        <td>
                          <button 
                            className="btn-pill-blue"
                            onClick={() => openAttendanceModal(slot)}
                          >
                            Mark Attendance
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No classes scheduled for today.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* TWO COLUMN SECTION */}
        <section className="f-two-col">
          {/* My Subjects */}
          <div className="f-col-left">
            <h2 className="section-title">My Subjects</h2>
            <div className="f-subjects-list">
              {profile?.subjects?.length > 0 ? (
                profile.subjects.map((sub, idx) => (
                  <div key={idx} className="f-subject-card">
                    <div className="f-sub-info">
                      <span className="fw-bold fs-16">{sub.name}</span>
                      <span className="code-badge">{sub.code}</span>
                    </div>
                    <div className="f-sub-stats">
                      <span>{sub.credits} Credits</span>
                      <span className="f-divider">|</span>
                      <span>{sub.semester} Semester</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No subjects assigned yet.</p>
              )}
            </div>
          </div>

          {/* Recent Activity/Complaints */}
          <div className="f-col-right">
            <h2 className="section-title">Department Links</h2>
            <div className="f-complaints-list">
              <Link to="/faculty/attendance" className="f-complaint-card hover:bg-slate-800 transition-colors">
                <div className="f-comp-top">
                  <span className="fw-bold">Attendance Records</span>
                  <ChevronRight size={16} />
                </div>
                <p className="f-comp-title">Review and update student presence</p>
              </Link>
              <Link to="/faculty/results" className="f-complaint-card hover:bg-slate-800 transition-colors">
                <div className="f-comp-top">
                  <span className="fw-bold">Results Portal</span>
                  <ChevronRight size={16} />
                </div>
                <p className="f-comp-title">Submit internal and semester marks</p>
              </Link>
              <Link to="/faculty/complaints" className="f-complaint-card hover:bg-slate-800 transition-colors">
                <div className="f-comp-top">
                  <span className="fw-bold">Student Complaints</span>
                  <ChevronRight size={16} />
                </div>
                <p className="f-comp-title">Review academic grievances</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ANNOUNCEMENTS PANEL */}
        <section className="f-announcements-section">
          <div className="f-panel-card">
            <h2 className="section-title">Post Announcement</h2>
            
            <form className="f-announce-form" onSubmit={handlePostAnnouncement}>
              <input 
                type="text" 
                placeholder="Write announcement..." 
                className="f-input"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
              />
              <select 
                className="f-select"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              >
                <option value="student">All Students</option>
                <option value="parent">Parents</option>
                <option value="faculty">Faculty Only</option>
              </select>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={posting || !announcement.trim()}
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </form>
          </div>
        </section>
      </main>
      <ChatWidget />

      {/* Attendance Modal */}
      {showAttendanceModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#1e293b] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700 page-enter">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-bold text-white">Mark Attendance - {selectedClass.subject}</h3>
                <p className="text-sm text-slate-400 mt-1">{selectedClass.code} • Batch: {selectedClass.batch || 'All'}</p>
              </div>
              <button onClick={() => setShowAttendanceModal(false)} className="text-slate-400 hover:text-white p-2">
                 ✕ 
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {studentsList.length > 0 ? (
                <div className="space-y-3">
                  {studentsList.map(student => (
                    <div key={student._id} className="flex justify-between items-center p-4 bg-slate-800 rounded-lg border border-slate-700">
                      <div>
                        <div className="font-semibold text-white">{student.userId?.name || 'Unknown Student'}</div>
                        <div className="text-sm text-slate-400">{student.rollNumber}</div>
                      </div>
                      <button 
                        onClick={() => toggleAttendance(student._id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          attendanceRoster[student._id] === 'Present' 
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                        }`}
                      >
                        {attendanceRoster[student._id] || 'Present'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8 flex flex-col items-center">
                  <Loader2 className="animate-spin mb-3" size={32} />
                  Loading students roster...
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/80">
              <button 
                onClick={() => setShowAttendanceModal(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                disabled={submittingAttendance}
              >
                Cancel
              </button>
              <button 
                onClick={submitAttendance}
                disabled={submittingAttendance || studentsList.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                {submittingAttendance && <Loader2 className="animate-spin" size={16} />}
                {submittingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyDashboard;

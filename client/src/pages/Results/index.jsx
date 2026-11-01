import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import { useSidebar } from '../../context/SidebarContext';
import { studentService } from '../../services/student.service';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import '../../styles/dashboard-shared.css';
import './Results.css';

const Results = () => {
  const { isCollapsed } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [profRes, resRes] = await Promise.all([
          studentService.getProfile(),
          studentService.getResults()
        ]);
        if (profRes.success) {
          setProfile(profRes.data);
          setActiveTab(`Sem ${profRes.data.semester}`);
        }
        if (resRes.success) {
          setResults(resRes.data || []);
          if (resRes.summary) setSummary(resRes.summary);
        }
      } catch (err) {
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const calculateCGPA = () => {
    if (summary && summary.cgpa !== undefined) return summary.cgpa;
    if (!results.length) return 0;
    const avg = results.reduce((sum, r) => sum + (r.marksObtained !== undefined && r.marksObtained !== null ? r.marksObtained : (r.marks || 0)), 0) / results.length;
    return (avg / 10).toFixed(1);
  };

  const calculateTotal = () => {
    if (summary && summary.totalMarksObtained !== undefined) {
      return { total: summary.totalMarksObtained, max: summary.totalMaxMarks };
    }
    const total = results.reduce((sum, r) => sum + (r.marksObtained !== undefined && r.marksObtained !== null ? r.marksObtained : (r.marks || 0)), 0);
    const maxMarks = results.reduce((sum, r) => sum + (r.maxMarks || 100), 0);
    return { total, max: maxMarks };
  };

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner"></div>
        <div className="ds-loading-text">Fetching Results...</div>
      </div>
    );
  }

  const { total, max } = calculateTotal();
  const cgpa = calculateCGPA();
  const semesterTabs = Array.from({ length: profile?.semester || 1 }, (_, i) => `Sem ${i + 1}`).reverse();

  const getGradeColor = (grade) => {
    if (['O', 'A+', 'A'].includes(grade)) return { bg: '#DCFCE7', color: '#16A34A' };
    if (['B+', 'B'].includes(grade)) return { bg: '#DBEAFE', color: '#1A56DB' };
    if (['C', 'D'].includes(grade)) return { bg: '#FEF9C3', color: '#CA8A04' };
    return { bg: '#FEE2E2', color: '#DC2626' };
  };

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
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="ds-header-title">My Results & Grades</h1>
            <span className="ds-pill blue">Semester {profile?.semester || 5} (2026–2027)</span>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
            background: '#1A56DB', color: '#fff', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            <Download size={15} /> Download Marksheet
          </button>
        </header>

        <main className="ds-content">
          {/* Semester Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E5E7EB', paddingBottom: 0 }}>
            {semesterTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  background: 'transparent', borderBottom: activeTab === tab ? '2px solid #1A56DB' : '2px solid transparent',
                  color: activeTab === tab ? '#1A56DB' : '#6B7280', marginBottom: -2, transition: 'all 0.15s',
                }}
              >
                Semester {tab.split(' ')[1]}
              </button>
            ))}
          </div>

          {activeTab === `Sem ${profile?.semester}` ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* CGPA Card */}
              <div style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 28,
                display: 'flex', alignItems: 'center', gap: 32,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ textAlign: 'center', minWidth: 140 }}>
                  <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>CGPA</div>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{cgpa}</div>
                  <div style={{ fontSize: 16, color: '#6B7280' }}>/10</div>
                </div>
                <div style={{ flex: 1, display: 'flex', gap: 32 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 600 }}>TOTAL MARKS</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{total} <span style={{ fontSize: 14, color: '#6B7280' }}>/ {max}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 600 }}>PERCENTAGE</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{max > 0 ? ((total/max)*100).toFixed(1) : 0}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 600 }}>RESULT</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={20} /> PASS
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <table className="ds-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Code</th>
                      <th>Credits</th>
                      <th>Marks</th>
                      <th>Max</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length > 0 ? (
                      results.map((res, i) => {
                        const gc = getGradeColor(res.grade);
                        const marksDisplay = res.isAbsent
                          ? 'Absent'
                          : res.marksObtained !== undefined && res.marksObtained !== null
                          ? res.marksObtained
                          : res.marks;
                        const isPass = res.isPassed !== undefined ? res.isPassed : (res.grade !== 'F');

                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 500, color: '#111827' }}>
                              {res.subjectName || res.subject}
                              {res.examTitle && (
                                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                                  {res.examTitle}
                                </div>
                              )}
                            </td>
                            <td><span className="ds-code-badge">{res.subjectCode || res.code}</span></td>
                            <td style={{ color: '#6B7280' }}>{res.credits || 3}</td>
                            <td style={{ fontWeight: 700, color: res.isAbsent ? '#DC2626' : '#111827' }}>
                              {marksDisplay}
                            </td>
                            <td style={{ color: '#6B7280' }}>{res.maxMarks || 100}</td>
                            <td>
                              <span style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                                background: gc.bg, color: gc.color, fontWeight: 700, fontSize: 13,
                              }}>
                                {res.grade || '—'}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                color: isPass ? '#16A34A' : '#DC2626',
                                fontWeight: 600, fontSize: 13,
                              }}>
                                {isPass ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {isPass ? 'Pass' : (res.isAbsent ? 'Absent' : 'Fail')}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                          No results found for this semester.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <div className="ds-empty">
              <AlertCircle size={48} />
              <p>Historical results for {activeTab} are being migrated to the new system.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Results;

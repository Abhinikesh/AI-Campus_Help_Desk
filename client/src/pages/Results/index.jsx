import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar/Navbar';
import { studentService } from '../../services/student.service';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import './Results.css';

const Results = () => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    const fetchData = async () => {
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
        if (resRes.success) setResults(resRes.data);
      } catch (err) {
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateCGPA = () => {
    if (!results.length) return 0;
    // Simple mock calculation: average of grades or marks
    const avg = results.reduce((sum, r) => sum + (r.marks || 0), 0) / results.length;
    return (avg / 10).toFixed(1);
  };

  const calculateTotal = () => {
    const total = results.reduce((sum, r) => sum + (r.marks || 0), 0);
    const max = results.reduce((sum, r) => sum + (r.maxMarks || 100), 0);
    return { total, max };
  };

  const { total, max } = calculateTotal();
  const cgpa = calculateCGPA();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <Loader2 className="animate-spin mr-2" /> Fetching Results...
      </div>
    );
  }

  const semesterTabs = Array.from({ length: profile?.semester || 1 }, (_, i) => `Sem ${i + 1}`).reverse();

  return (
    <div className="results-layout">
      <Navbar />
      
      <main className="results-content">
        <h1 className="page-title">My Results</h1>
        
        <div className="tabs-container">
          {semesterTabs.map(tab => (
            <button 
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              Semester {tab.split(' ')[1]}
            </button>
          ))}
        </div>

        {activeTab === `Sem ${profile?.semester}` ? (
          <div className="semester-results-view">
            
            {/* CGPA Card */}
            <div className="cgpa-card">
              <div className="cgpa-graphic-container">
                <svg className="cgpa-gauge" viewBox="0 0 100 50">
                  <path className="gauge-bg" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" />
                  <path 
                    className="gauge-progress" 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    strokeDasharray="125.6" 
                    strokeDashoffset={125.6 * (1 - cgpa/10)} 
                  />
                </svg>
                <div className="cgpa-value-container">
                  <div className="cgpa-label">CGPA</div>
                  <div className="cgpa-value">{cgpa}<span className="cgpa-max">/10</span></div>
                </div>
              </div>
            </div>

            {/* Results Table */}
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
                    {results.length > 0 ? (
                      results.map((res, i) => (
                        <tr key={i}>
                          <td>{res.subject}</td>
                          <td><span className="code-badge">{res.code}</span></td>
                          <td className="fw-bold">{res.marks}</td>
                          <td>{res.maxMarks}</td>
                          <td>
                            <span className={`grade-pill grade-${res.grade?.toLowerCase().replace('+', 'plus')}`}>
                              {res.grade}
                            </span>
                          </td>
                          <td><span className="text-green flex items-center gap-1"><CheckCircle size={14}/> Pass</span></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-slate-400">No results found for this semester.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Semester Summary Card */}
            <div className="semester-summary-card">
              <div className="summary-left">
                <div className="summary-stat">
                  <span className="stat-label">Total Marks</span>
                  <span className="stat-val">{total} / {max}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Percentage</span>
                  <span className="stat-val">{max > 0 ? ((total/max) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Result</span>
                  <span className="stat-val text-green">PASS</span>
                </div>
              </div>
              <div className="summary-right">
                <button className="btn btn-primary flex items-center gap-2">
                  <Download size={18} /> Download Marksheet
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div className="empty-state">
            <AlertCircle size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400">Historical results for {activeTab} are currently being migrated to the new system.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Results;

/**
 * client/src/pages/FacultyStudentSearch/index.jsx
 * Faculty Student Search Directory — Comprehensive Institutional Student Lookup.
 * Supports Search by Roll Number, Full/Partial Name, Phone, Email, and Student ID.
 * Features Debounced Queries, Branch/Semester Filters, Disambiguation Data, and Pagination.
 * Permanent Light Mode compliant.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import { facultyService } from '../../services/faculty.service';
import {
  Search, Users, ChevronRight, X, AlertCircle, RefreshCw, Filter, Phone, Mail, Building
} from 'lucide-react';
import '../../styles/dashboard-shared.css';
import '../../styles/theme.css';
import './FacultyStudentSearch.css';

const BRANCH_OPTIONS = ['All', 'CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'EE'];
const SEMESTER_OPTIONS = ['All', '1', '2', '3', '4', '5', '6', '7', '8'];

const FacultyStudentSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialBranch = searchParams.get('branch') || 'All';
  const initialSemester = searchParams.get('semester') || 'All';
  const initialMyClasses = searchParams.get('myClasses') === 'true';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [selectedSemester, setSelectedSemester] = useState(initialSemester);
  const [myClassesOnly, setMyClassesOnly] = useState(initialMyClasses);

  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active request counter to cancel / ignore stale responses
  const activeRequestIdRef = useRef(0);

  // Debounce user input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keep search params in URL in sync
  useEffect(() => {
    const params = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (selectedBranch !== 'All') params.branch = selectedBranch;
    if (selectedSemester !== 'All') params.semester = selectedSemester;
    if (myClassesOnly) params.myClasses = 'true';
    setSearchParams(params);
  }, [debouncedQuery, selectedBranch, selectedSemester, myClassesOnly, setSearchParams]);

  // Fetch search results
  const fetchStudents = useCallback(async (pageToLoad = 1) => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pageToLoad,
        limit: 20,
      };
      if (debouncedQuery) params.q = debouncedQuery;
      if (selectedBranch !== 'All') params.branch = selectedBranch;
      if (selectedSemester !== 'All') params.semester = selectedSemester;
      if (myClassesOnly) params.myClassesOnly = 'true';

      const res = await facultyService.searchStudents(params);

      // Ignore if a newer request was dispatched
      if (requestId !== activeRequestIdRef.current) return;

      if (res.success) {
        setStudents(res.data || []);
        setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      } else {
        setError(res.message || 'Failed to search students');
      }
    } catch (err) {
      if (requestId !== activeRequestIdRef.current) return;
      setError(err.response?.data?.message || err.message || 'An error occurred while searching');
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedQuery, selectedBranch, selectedSemester, myClassesOnly]);

  useEffect(() => {
    fetchStudents(1);
  }, [fetchStudents]);

  const handleClear = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedBranch('All');
    setSelectedSemester('All');
    setMyClassesOnly(false);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchStudents(newPage);
    }
  };

  return (
    <div className="ds-shell">
      <Sidebar />

      <div className="ds-main">
        {/* Header Bar */}
        <header className="ds-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="ds-header-title">Student Directory</span>
            <span className="ds-pill blue">
              {myClassesOnly ? 'My Assigned Classes' : 'Institution Directory'}
            </span>
          </div>
          <div className="ds-header-right">
            <span style={{ fontSize: 13, color: 'var(--cs-text-muted)', fontWeight: 500 }}>
              {pagination.total} Student{pagination.total === 1 ? '' : 's'} Found
            </span>
          </div>
        </header>

        <div className="ds-content">
          {/* Search Box & Filters Bar */}
          <div className="fss-search-card">
            <div className="fss-input-wrapper">
              <Search size={18} className="fss-search-icon" />
              <input
                type="text"
                className="fss-search-input"
                placeholder="Search by student full/partial name, university roll number, phone number, email, or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                aria-label="Search students"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="fss-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  aria-label="Clear search input"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="fss-filters-row">
              <div className="fss-filter-group">
                <Filter size={14} className="fss-filter-icon" />
                <span className="fss-filter-label">Branch:</span>
                <select
                  className="fss-select"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  aria-label="Filter by Branch"
                >
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>
                  ))}
                </select>
              </div>

              <div className="fss-filter-group">
                <span className="fss-filter-label">Semester:</span>
                <select
                  className="fss-select"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  aria-label="Filter by Semester"
                >
                  {SEMESTER_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s === 'All' ? 'All Semesters' : `Sem ${s}`}</option>
                  ))}
                </select>
              </div>

              <label className="fss-checkbox-label">
                <input
                  type="checkbox"
                  checked={myClassesOnly}
                  onChange={(e) => setMyClassesOnly(e.target.checked)}
                />
                <span>My Teaching Sections Only</span>
              </label>

              {(searchQuery || selectedBranch !== 'All' || selectedSemester !== 'All' || myClassesOnly) && (
                <button
                  type="button"
                  className="ds-btn outline sm"
                  onClick={handleClear}
                  style={{ marginLeft: 'auto' }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="fss-scope-hint">
              <span>Instant search powered by MongoDB indexes. Exact roll numbers rank first. Results support disambiguation by contact & class details.</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="fss-error-banner">
              <AlertCircle size={20} className="fss-error-icon" />
              <div className="fss-error-content">
                <span className="fss-error-title">Unable to Load Students</span>
                <span className="fss-error-desc">{error}</span>
              </div>
              <button className="ds-btn outline sm" onClick={() => fetchStudents(pagination.page)}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Results Container */}
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-section-title">
                {debouncedQuery ? `Search Results for "${debouncedQuery}"` : 'Enrolled Students'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--cs-text-muted)' }}>
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
            </div>

            {loading ? (
              <div className="fss-loading-container">
                <div className="ds-spinner" />
                <span className="ds-loading-text">Searching student records…</span>
              </div>
            ) : students.length === 0 ? (
              <div className="cs-empty-state">
                <div className="cs-empty-icon">
                  <Users size={28} />
                </div>
                <div className="cs-empty-title">
                  {debouncedQuery ? 'No Matching Students Found' : 'No Students Available'}
                </div>
                <div className="cs-empty-desc">
                  {debouncedQuery
                    ? `No students matching "${debouncedQuery}" were found with the selected filter criteria.`
                    : 'No student records match the active department, semester, or teaching scope filters.'}
                </div>
                {(debouncedQuery || selectedBranch !== 'All' || selectedSemester !== 'All' || myClassesOnly) && (
                  <button className="ds-btn outline sm" onClick={handleClear}>
                    Clear Search & Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Student Name & Disambiguation</th>
                        <th>Contact</th>
                        <th>Programme & Branch</th>
                        <th>Class / Section</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student._id}>
                          <td>
                            <span className="ds-code-badge">{student.rollNumber}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <Link
                                to={`/faculty/students/${student._id}`}
                                className="fss-student-link"
                                title="Open Student 360 Profile"
                              >
                                {student.fullName}
                              </Link>
                              {student.email && (
                                <span style={{ fontSize: 11, color: 'var(--cs-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <Mail size={11} /> {student.email}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {student.phone ? (
                              <span style={{ fontSize: 13, color: 'var(--cs-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Phone size={12} color="#64748B" /> {student.phone}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--cs-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: 13, color: 'var(--cs-text-secondary)' }}>
                              {student.program || 'B.Tech'} {student.branch}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: 13, color: 'var(--cs-text-secondary)' }}>
                              Semester {student.semester} — Sec {student.section || 'A'}
                            </span>
                          </td>
                          <td>
                            <span className={`ds-pill ${student.status === 'active' ? 'green' : 'gray'}`}>
                              {student.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link
                              to={`/faculty/students/${student._id}`}
                              className="ds-btn primary sm"
                              style={{ textDecoration: 'none' }}
                            >
                              View 360 <ChevronRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="fss-pagination">
                    <button
                      className="ds-btn outline sm"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="fss-page-indicator">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      className="ds-btn outline sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyStudentSearch;

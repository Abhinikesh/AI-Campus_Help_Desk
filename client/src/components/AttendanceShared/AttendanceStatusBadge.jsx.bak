import React from 'react';
import '../../styles/dashboard-shared.css';

/**
 * AttendanceStatusBadge
 * Formats status badges using existing ERP dashboard tokens:
 * present (green), absent (red), pending (amber), review (blue), good (green), warning (amber), critical (red)
 */
export const AttendanceStatusBadge = ({ status = 'pending', className = '' }) => {
  const norm = String(status).toLowerCase();

  let color = 'gray';
  let label = status;

  if (norm === 'present' || norm === 'good' || norm === 'open' || norm === 'enrolled') {
    color = 'green';
    label = norm === 'present' ? 'Present' : norm === 'good' ? 'Good' : norm === 'open' ? 'Live / Open' : 'Enrolled';
  } else if (norm === 'absent' || norm === 'critical' || norm === 'revoked') {
    color = 'red';
    label = norm === 'absent' ? 'Absent' : norm === 'critical' ? 'Critical' : 'Revoked';
  } else if (norm === 'pending' || norm === 'warning' || norm === 'needs review' || norm === 'review') {
    color = 'amber';
    label = norm === 'pending' ? 'Pending' : norm === 'warning' ? 'Warning' : 'Needs Review';
  } else if (norm === 'closed' || norm === 'finalized') {
    color = 'blue';
    label = norm === 'finalized' ? 'Finalized' : 'Closed';
  } else if (norm === 'face') {
    color = 'blue';
    label = 'Face Verified';
  } else if (norm === 'qr') {
    color = 'blue';
    label = 'QR Check-in';
  } else if (norm === 'manual') {
    color = 'gray';
    label = 'Manual';
  }

  return (
    <span className={`ds-pill ${color} ${className}`}>
      {label}
    </span>
  );
};

export default AttendanceStatusBadge;

import React from 'react';
import { CalendarX } from 'lucide-react';
import '../../styles/dashboard-shared.css';

/**
 * EmptyState
 * Professional empty state for when no records or sessions are found.
 * Never shows false 0% alarms or misleading states.
 */
export const EmptyState = ({
  icon: Icon = CalendarX,
  title = 'No Records Found',
  description = 'There are no active attendance records or sessions scheduled at this moment.',
  action = null,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#EFF6FF',
          color: '#1A56DB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon size={26} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 8px 0' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', maxWidth: 440, margin: '0 0 20px 0', lineHeight: 1.5 }}>
        {description}
      </p>
      {action && action}
    </div>
  );
};

export default EmptyState;

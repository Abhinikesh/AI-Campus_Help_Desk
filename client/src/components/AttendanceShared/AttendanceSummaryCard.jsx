import React from 'react';
import '../../styles/dashboard-shared.css';

/**
 * AttendanceSummaryCard
 * Displays primary attendance metric with icon, sub-label, and trend.
 */
export const AttendanceSummaryCard = ({
  label,
  value,
  trend = null,
  trendType = 'neu', // 'up' | 'down' | 'neu'
  icon: Icon = null,
  badge = null,
  color = null,
}) => {
  return (
    <div className="ds-stat-card" style={color ? { borderTop: `3px solid ${color}` } : {}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="ds-stat-label" style={{ margin: 0 }}>{label}</div>
        {Icon && <Icon size={18} style={{ color: color || '#6B7280' }} />}
      </div>
      <div className="ds-stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span>{value}</span>
        {badge && (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>
            {badge}
          </span>
        )}
      </div>
      {trend && (
        <div className={`ds-stat-trend ${trendType}`}>
          {trend}
        </div>
      )}
    </div>
  );
};

export default AttendanceSummaryCard;

import React from 'react';

const gradients = {
  hero: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1a1a2e 100%)',
  student: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
  faculty: 'linear-gradient(135deg, #2d1b69 0%, #1e293b 100%)',
  parent: 'linear-gradient(135deg, #052e16 0%, #1e293b 100%)',
  admission: 'linear-gradient(135deg, #0c4a6e 0%, #1e293b 100%)',
  admin: 'linear-gradient(135deg, #450a0a 0%, #1e293b 100%)',
  campus: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
  library: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 100%)',
  default: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
};

const icons = {
  hero: '🏛',
  student: '🎓',
  faculty: '👨🏫',
  parent: '👨👧',
  admission: '📋',
  admin: '🛡️',
  campus: '🏫',
  library: '📚',
  default: '🖼',
};

export default function ImagePlaceholder({
  type = 'default',
  width = '100%',
  height = '240px',
  borderRadius = '16px',
  label = '',
  style = {}
}) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: gradients[type] || gradients.default,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative',
      overflow: 'hidden',
      ...style
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 30% 40%, rgba(59,130,246,0.08) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />
      <span style={{ fontSize: '48px' }}>
        {icons[type] || icons.default}
      </span>
      {label && (
        <span style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '13px',
          fontFamily: 'Inter',
          textAlign: 'center',
          padding: '0 16px'
        }}>
          {label}
        </span>
      )}
      <span style={{
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.2)',
        fontFamily: 'Inter'
      }}>
        📷 Add image here
      </span>
    </div>
  );
}

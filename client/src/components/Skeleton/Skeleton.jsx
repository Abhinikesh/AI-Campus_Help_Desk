import React from 'react';
import './Skeleton.css';

const Skeleton = ({ variant = 'line', style }) => {
  return (
    <div className={`skeleton skeleton-${variant}`} style={style}></div>
  );
};

export default Skeleton;

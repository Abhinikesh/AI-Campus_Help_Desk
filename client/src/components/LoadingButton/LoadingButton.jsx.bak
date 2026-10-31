import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingButton = ({ loading, onClick, children, className = '', disabled, ...props }) => {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`btn btn-primary ${className} ${loading ? 'opacity-70 cursor-wait' : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" size={16} /> 
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;

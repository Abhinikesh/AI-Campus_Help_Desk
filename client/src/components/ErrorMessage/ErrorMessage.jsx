import React from 'react';
import { AlertCircle } from 'lucide-react';

const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-900/20 border border-red-500/30 rounded-xl my-4 text-center">
      <AlertCircle className="text-red-400 mb-3" size={32} />
      <h3 className="text-white font-poppins font-medium text-lg mb-2">Error Loading Data</h3>
      <p className="text-slate-300 text-sm mb-4 max-w-md">
        {message || 'Something went wrong while communicating with the server. Please check your connection.'}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline text-red-400 border-red-400 hover:bg-red-900/30">
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;

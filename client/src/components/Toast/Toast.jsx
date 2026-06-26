import React from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import './Toast.css';

const Toast = ({ message, type = 'info', onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={20} className="text-green-500" />;
      case 'error': return <AlertTriangle size={20} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={20} className="text-yellow-500" />;
      default: return <Info size={20} className="text-blue-500" />;
    }
  };

  return (
    <div className={`toast-container toast-enter glass-card flex items-center gap-3 p-4 border-l-4 ${
      type === 'success' ? 'border-green-500' : 
      type === 'error' ? 'border-red-500' : 
      type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
    }`}>
      {getIcon()}
      <p className="text-sm text-slate-200 font-inter font-medium flex-1 m-0">{message}</p>
      <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;

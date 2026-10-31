import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast/Toast';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 3.5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Provide both addToast and showToast so any component works cleanly
  return (
    <ToastContext.Provider value={{ addToast, showToast: addToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast 
              message={t.message} 
              type={t.type} 
              onClose={() => removeToast(t.id)} 
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      addToast: (msg) => console.log('[Toast fallback]:', msg),
      showToast: (msg) => console.log('[Toast fallback]:', msg),
    };
  }
  return ctx;
};

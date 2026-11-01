import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  isChunkLoadError(error) {
    if (!error) return false;
    const msg = error.message || error.toString();
    return (
      error.name === 'ChunkLoadError' ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module')
    );
  }

  handleReload = () => {
    try {
      window.sessionStorage.removeItem('campussphere_chunk_retry');
    } catch (_) {}
    window.location.reload();
  };

  handleHome = () => {
    try {
      window.sessionStorage.removeItem('campussphere_chunk_retry');
    } catch (_) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.isChunkLoadError(this.state.error);

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
          color: '#F8FAFC',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          padding: '24px',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: '#1E293B',
            borderRadius: '16px',
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            border: '1px solid #334155',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isChunkError ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isChunkError ? '#3B82F6' : '#EF4444',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}>
              {isChunkError ? <RefreshCw size={36} /> : <AlertCircle size={36} />}
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
              {isChunkError ? 'New Version Available' : 'Oops! Something went wrong'}
            </h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', margin: '0 0 24px', lineHeight: 1.6 }}>
              {isChunkError
                ? 'A newer application bundle has been deployed or network connectivity was refreshed. Reload to fetch the latest assets.'
                : 'A technical error occurred while displaying this page. Your academic data is secure.'}
            </p>

            {this.state.error && (
              <div style={{
                background: '#0F172A',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                color: isChunkError ? '#93C5FD' : '#EF4444',
                fontFamily: 'monospace',
                textAlign: 'left',
                marginBottom: '24px',
                overflowX: 'auto',
                border: '1px solid #334155',
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <RefreshCw size={16} /> {isChunkError ? 'Update & Reload' : 'Reload Page'}
              </button>
              <button
                type="button"
                onClick={this.handleHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#334155',
                  color: '#F8FAFC',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <Home size={16} /> Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


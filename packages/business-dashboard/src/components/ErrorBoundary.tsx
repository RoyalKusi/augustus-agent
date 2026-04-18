import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#f7fafc', fontFamily: 'sans-serif', padding: 24,
        }}>
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a202c' }}>Something went wrong</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#718096', lineHeight: 1.6 }}>
              The page encountered an unexpected error. This is usually temporary — try refreshing.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: '10px 24px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Refresh page
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                style={{ padding: '10px 24px', background: 'transparent', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              >
                Go to dashboard
              </button>
            </div>
            {process.env.NODE_ENV !== 'production' && (
              <details style={{ marginTop: 24, textAlign: 'left' }}>
                <summary style={{ fontSize: 12, color: '#a0aec0', cursor: 'pointer' }}>Error details (dev only)</summary>
                <pre style={{ background: '#fff5f5', padding: 12, borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 8, color: '#c53030', overflow: 'auto' }}>
                  {this.state.error.message}{'\n\n'}{this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

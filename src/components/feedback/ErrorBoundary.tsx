import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  correlationId: string;
}

/// <summary>
/// Catches child component crashes, logging metadata and presenting a safe recovery screen (Rule 07 / UI3).
/// </summary>
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    correlationId: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    // Generate correlation ID for reporting purposes
    const correlationId = Math.random().toString(36).substring(2, 10).toUpperCase();
    return { hasError: true, error, correlationId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ padding: '40px', maxWidth: '500px', margin: '80px auto', textAlign: 'center' }} className="card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--danger)', marginBottom: '16px' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            An unexpected client-side crash occurred. Please reload the page or contact support.
          </p>
          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'left', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            <strong>Correlation ID:</strong> FE-{this.state.correlationId}
            <br />
            <strong>Message:</strong> {this.state.error?.message}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ marginTop: '24px', width: '100%' }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

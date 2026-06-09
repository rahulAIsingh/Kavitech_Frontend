import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="alert alert-success" style={{ marginBottom: '24px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
        </svg>
        <span>
          Welcome back, <strong>{user?.firstName} {user?.lastName}</strong>! You have successfully signed in.
        </span>
      </div>

      {/* Grid containing custom stat cards (Rule 07 Layout) */}
      <div className="grid grid-cols-3">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Users</span>
            <span style={{ color: 'var(--success)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </span>
          </div>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>128</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>+12% from last week</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>API Invocations</span>
            <span style={{ color: 'var(--primary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
          </div>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>14.2k</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>System metrics healthy</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Security Lockouts</span>
            <span style={{ color: 'var(--danger)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
          </div>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: 700 }}>2</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>No active security alerts</p>
        </div>
      </div>
    </div>
  );
};

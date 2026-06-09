import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Show simple loader skeleton during session validation
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center' }}>
        <div className="user-avatar" style={{ animation: 'pulse 1.5s infinite' }}>...</div>
      </div>
    );
  }

  // Redirect to login page if unauthenticated
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

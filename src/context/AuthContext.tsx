import React, { createContext, useState, useEffect, useContext } from 'react';
import { authApi } from '../api/authApi';
import { UserInfo, LoginRequest } from '../types/auth';

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Recover session from localStorage on application reload
    const storedUser = localStorage.getItem('user_info');
    const token = localStorage.getItem('access_token');
    
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);

    // 2. Listen to token refresh expiration events triggered by Axios interceptor
    const handleSessionExpired = () => {
      setUser(null);
      localStorage.clear();
    };

    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpired);
    };
  }, []);

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const result = await authApi.login(data);
      
      // Store in localStorage for persistence
      localStorage.setItem('access_token', result.accessToken);
      localStorage.setItem('refresh_token', result.refreshToken);
      localStorage.setItem('user_info', JSON.stringify(result.user));

      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Clean up local session even if API logout fails
    } finally {
      localStorage.clear();
      setUser(null);
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // SuperAdmin bypass/wildcard permission check (Rule 03 / RBAC Rules)
    if (user.roles.includes('SuperAdmin')) return true;

    return user.permissions.includes(permission);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

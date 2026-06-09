import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface HasPermissionProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/// <summary>
/// React element wrapper to conditionally render UI components based on permission keys (Rule 03 / RBAC Rules).
/// Replaces role-based rendering (if role == "Admin" is a VIOLATION).
/// </summary>
export const HasPermission: React.FC<HasPermissionProps> = ({ permission, fallback = null, children }) => {
  const { hasPermission } = useAuth();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

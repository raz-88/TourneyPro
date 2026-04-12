// src/components/auth/ProtectedRoute.jsx
// Redirect unauthenticated users to login.

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner } from '../ui';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (adminOnly && profile?.role !== 'main') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

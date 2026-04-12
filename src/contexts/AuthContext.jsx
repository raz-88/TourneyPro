// src/contexts/AuthContext.jsx
// ─────────────────────────────────────────────────────────────
// Provides current user + Firestore profile to the entire app.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange, getUserProfile } from '../firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // Firebase Auth user
  const [profile, setProfile] = useState(null);   // Firestore user doc
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const prof = await getUserProfile(firebaseUser.uid);
        setProfile(prof);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Helper — which "owner" uid to use for data queries
  // Sub-users share their mainUserId for data isolation
  const dataUserId = profile?.mainUserId ?? user?.uid;

  const value = {
    user,
    profile,
    loading,
    dataUserId,
    isAdmin: profile?.role === 'main',
    canEdit: profile?.permissions === 'admin' || profile?.permissions === 'edit',
    refreshProfile: async () => {
      if (user) {
        const prof = await getUserProfile(user.uid);
        setProfile(prof);
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

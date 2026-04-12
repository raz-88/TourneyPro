// src/components/settings/SettingsPage.jsx
// ─────────────────────────────────────────────────────────────
// User profile settings & account management.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Settings, User, Shield, Bell, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateDoc, doc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../../firebase/config';
import { Card, Button, Input, Badge } from '../ui';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name,    setName]    = useState(profile?.name ?? '');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { name });
      await updateProfile(auth.currentUser, { displayName: name });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Settings</h1>
        <p className="text-[var(--text-3)] text-sm mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Profile card */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <User size={18} className="text-[var(--accent)]" />
          <h2 className="font-display font-semibold text-[var(--text-1)]">Profile</h2>
        </div>

        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-[var(--surface-2)]">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{ background: 'var(--accent)' }}>
            {(profile?.name ?? user?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[var(--text-1)]">{profile?.name ?? '—'}</p>
            <p className="text-sm text-[var(--text-3)]">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={profile?.role === 'main' ? 'admin' : 'view'}>
                {profile?.role === 'main' ? 'Admin' : 'Sub-User'}
              </Badge>
              {profile?.role === 'sub' && (
                <Badge variant={profile?.permissions}>{profile?.permissions}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Display Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
          />
          <Input label="Email Address" value={user?.email ?? ''} disabled />

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            <Save size={15} />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      {/* Account info */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <Shield size={18} className="text-[var(--accent)]" />
          <h2 className="font-display font-semibold text-[var(--text-1)]">Account Info</h2>
        </div>

        <div className="space-y-3 text-sm">
          {[
            ['Account Type', profile?.role === 'main' ? 'Main Admin' : 'Sub-User'],
            ['User ID',      user?.uid?.slice(0, 16) + '…'],
            ['Email Verified', user?.emailVerified ? 'Yes' : 'No'],
            ['Created',      user?.metadata?.creationTime
              ? new Date(user.metadata.creationTime).toLocaleDateString()
              : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-[var(--text-3)]">{label}</span>
              <span className="text-[var(--text-1)] font-medium">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* App info */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Settings size={18} className="text-[var(--accent)]" />
          <h2 className="font-display font-semibold text-[var(--text-1)]">About TourneyPro</h2>
        </div>
        <p className="text-sm text-[var(--text-3)] leading-relaxed">
          TourneyPro is a professional tournament management platform supporting Pool (Round Robin) and Knockout formats with real-time leaderboards, fixture generation, and multi-user access control.
        </p>
        <p className="text-xs text-[var(--text-3)] mt-3">Version 1.0.0 · Built with React + Firebase</p>
      </Card>
    </div>
  );
}

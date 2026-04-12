// src/components/subusers/SubUsersPage.jsx
// ─────────────────────────────────────────────────────────────
// Main user can create, edit permission level, and delete sub-users.
// Sub-users are Firebase Auth accounts linked to the main user.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit2, ShieldCheck, Eye, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSubUsers, updateSubUser, deleteSubUser, createSubUser } from '../../firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { Card, Badge, Button, Input, Select, Modal, Spinner, EmptyState } from '../ui';

export default function SubUsersPage() {
  const { dataUserId, user } = useAuth();

  const [subUsers, setSubUsers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState('');

  // Edit permission inline
  const [editingId,   setEditingId]   = useState(null);
  const [editPerm,    setEditPerm]    = useState('view');

  // New sub-user form
  const [form, setForm] = useState({ name: '', email: '', password: '', permissions: 'view' });
  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!dataUserId) return;
    getSubUsers(dataUserId).then(data => {
      setSubUsers(data);
      setLoading(false);
    });
  }, [dataUserId]);

  // ── Create sub-user ────────────────────────────────────────
  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      // Create Firebase Auth account for the sub-user
      const { user: newUser } = await createUserWithEmailAndPassword(
        auth, form.email, form.password
      );

      // Save Firestore profile
      await createSubUser(dataUserId, newUser.uid, {
        name: form.name,
        email: form.email,
        permissions: form.permissions,
      });

      setSubUsers(prev => [...prev, {
        uid: newUser.uid,
        name: form.name,
        email: form.email,
        permissions: form.permissions,
        role: 'sub',
      }]);

      setForm({ name: '', email: '', password: '', permissions: 'view' });
      setShowModal(false);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setSaving(false);
    }
  }

  // ── Update permission ──────────────────────────────────────
  async function handleSavePerm(uid) {
    await updateSubUser(uid, { permissions: editPerm });
    setSubUsers(prev => prev.map(u => u.uid === uid ? { ...u, permissions: editPerm } : u));
    setEditingId(null);
  }

  // ── Delete sub-user ────────────────────────────────────────
  async function handleDelete(uid) {
    if (!confirm('Remove this sub-user? They will lose access immediately.')) return;
    await deleteSubUser(uid);
    setSubUsers(prev => prev.filter(u => u.uid !== uid));
  }

  const permIcon = { view: Eye, edit: Edit2, admin: ShieldCheck };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Sub-Users</h1>
          <p className="text-[var(--text-3)] text-sm mt-0.5">
            Delegate access to team members with specific permissions.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Sub-User
        </Button>
      </div>

      {/* Permission legend */}
      <div className="flex gap-3 flex-wrap">
        {[
          { key: 'view', icon: Eye,        label: 'View Only — Read access to all data' },
          { key: 'edit', icon: Edit2,      label: 'Edit Access — Can update scores & matches' },
        ].map(({ key, icon: Icon, label }) => (
          <div key={key} className="flex items-center gap-2 text-xs text-[var(--text-3)] bg-[var(--surface-1)] border border-[var(--border)] px-3 py-2 rounded-lg">
            <Icon size={12} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : subUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No sub-users yet"
          description="Invite team members to collaborate with view-only or edit access."
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} /> Add First Sub-User
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {subUsers.map(u => {
            const PermIcon = permIcon[u.permissions] ?? Eye;
            const isEditing = editingId === u.uid;

            return (
              <Card key={u.uid} className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: `hsl(${u.email.charCodeAt(0) * 5}, 60%, 45%)` }}>
                  {(u.name ?? u.email)[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-1)] truncate">{u.name ?? '—'}</p>
                  <p className="text-xs text-[var(--text-3)] truncate">{u.email}</p>
                </div>

                {/* Permission */}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="px-2 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--accent)] text-[var(--text-1)] text-sm focus:outline-none"
                      value={editPerm}
                      onChange={e => setEditPerm(e.target.value)}
                    >
                      <option value="view">View Only</option>
                      <option value="edit">Edit Access</option>
                    </select>
                    <button onClick={() => handleSavePerm(u.uid)}
                      className="p-1.5 rounded text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="p-1.5 rounded text-[var(--text-3)] hover:bg-[var(--surface-2)] transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={u.permissions}>
                      <PermIcon size={11} className="mr-1" />
                      {u.permissions === 'view' ? 'View Only' : 'Edit Access'}
                    </Badge>
                    <button
                      onClick={() => { setEditingId(u.uid); setEditPerm(u.permissions); }}
                      className="p-1.5 rounded text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors"
                      title="Change permissions"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.uid)}
                      className="p-1.5 rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove sub-user"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add Sub-User Modal ── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setError(''); }} title="Add Sub-User">
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Jane Smith"
            value={form.name}
            onChange={setF('name')}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={setF('email')}
          />
          <Input
            label="Temporary Password"
            type="password"
            placeholder="Min. 6 characters"
            value={form.password}
            onChange={setF('password')}
          />
          <Select
            label="Permission Level"
            value={form.permissions}
            onChange={setF('permissions')}
          >
            <option value="view">View Only</option>
            <option value="edit">Edit Access</option>
          </Select>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setError(''); }}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={saving || !form.name || !form.email || !form.password}
              onClick={handleCreate}
            >
              {saving ? 'Creating…' : 'Create Sub-User'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already in use.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
  };
  return map[code] ?? 'An error occurred. Please try again.';
}

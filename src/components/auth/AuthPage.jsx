// src/components/auth/AuthPage.jsx
// ─────────────────────────────────────────────────────────────
// Login + Register screens with a split-panel layout.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Mail, Lock, User, ArrowRight, Zap } from 'lucide-react';
import { registerMainUser, loginUser } from '../../firebase/auth';
import { Button, Input } from '../ui';

export default function AuthPage() {
  const [mode, setMode]     = useState('login'); // 'login' | 'register'
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await registerMainUser(form);
      } else {
        await loginUser(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* ── Left decorative panel ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}
      >
        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20"
          style={{ background: 'var(--accent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full blur-3xl opacity-15"
          style={{ background: '#f59e0b' }} />

        <div className="relative z-10 text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-8 border border-white/20">
            <Trophy size={36} className="text-white" />
          </div>
          <h1 className="font-display text-4xl font-bold text-white mb-4 leading-tight">
            TourneyPro
          </h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Professional tournament management for every sport. Fixtures, standings, and knockout brackets — all in one place.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { icon: Zap, label: 'Auto Fixtures',  desc: 'Smart pool & bracket generation' },
              { icon: Trophy, label: 'Live Standings', desc: 'Real-time leaderboards' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <Icon size={18} className="text-[var(--accent)] mb-2" />
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-white/50 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Trophy size={20} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl text-[var(--text-1)]">TourneyPro</span>
          </div>

          <h2 className="font-display text-3xl font-bold text-[var(--text-1)] mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-[var(--text-3)] text-sm mb-8">
            {mode === 'login'
              ? 'Sign in to manage your tournaments'
              : 'Set up your admin account to get started'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                <input
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={set('name')}
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-3)] mt-6">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[var(--accent)] font-medium hover:underline"
            >
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return map[code] ?? 'An error occurred. Please try again.';
}

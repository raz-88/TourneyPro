// src/components/ui/index.jsx
// ─────────────────────────────────────────────────────────────
// Shared design-system primitives used throughout the app.
// ─────────────────────────────────────────────────────────────

import React from 'react';

// ── Button ────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-200 cursor-pointer border-0';

  const variants = {
    primary:  'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm hover:shadow-md',
    secondary:'bg-[var(--surface-2)] text-[var(--text-1)] hover:bg-[var(--surface-3)]',
    danger:   'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
    ghost:    'bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
    success:  'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full px-3 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider">{label}</label>}
      <select
        className={`w-full px-3 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '', onClick, ...props }) {
  return (
    <div
      className={`bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-[var(--accent)]/50 hover:shadow-lg transition-all duration-200' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
const badgeColors = {
  upcoming:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ongoing:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  draft:     'bg-gray-500/10 text-gray-400 border-gray-500/20',
  active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  view:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  edit:      'bg-violet-500/10 text-violet-400 border-violet-500/20',
  admin:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  pool:      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  knockout:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export function Badge({ children, variant = 'draft', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badgeColors[variant] ?? badgeColors.draft} ${className}`}>
      {children}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${sizes[size]} bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-2xl`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h2 className="font-display text-lg font-semibold text-[var(--text-1)]">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-all"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div className={`${s} border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin`} />
  );
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <Icon size={28} className="text-[var(--text-3)]" />
        </div>
      )}
      <h3 className="text-[var(--text-1)] font-semibold mb-1">{title}</h3>
      <p className="text-[var(--text-3)] text-sm mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, color = 'accent', trend }) {
  const colors = {
    accent:  'text-[var(--accent)] bg-[var(--accent)]/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    amber:   'text-amber-400 bg-amber-400/10',
    rose:    'text-rose-400 bg-rose-400/10',
    cyan:    'text-cyan-400 bg-cyan-400/10',
  };

  return (
    <Card className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-[var(--text-3)] uppercase tracking-wider font-medium">{label}</p>
        <p className="text-2xl font-display font-bold text-[var(--text-1)] leading-tight">{value}</p>
        {trend && <p className="text-xs text-[var(--text-3)] mt-0.5">{trend}</p>}
      </div>
    </Card>
  );
}

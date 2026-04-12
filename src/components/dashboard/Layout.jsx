// src/components/dashboard/Layout.jsx
// ─────────────────────────────────────────────────────────────
// App shell: collapsible sidebar + top header + content area.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Trophy, Swords, Calendar, BarChart3,
  Users, Settings, LogOut, ChevronLeft, ChevronRight, Menu, Bell, Sun, Moon, Layers
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logoutUser } from '../../firebase/auth';

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tournaments',  icon: Trophy,           label: 'My Tournaments' },
  { to: '/matches',      icon: Swords,           label: 'Matches' },
  { to: '/fixtures',     icon: Calendar,         label: 'Fixtures' },
  { to: '/leaderboard',  icon: BarChart3,        label: 'Leaderboard' },
  { to: '/pool-management', icon: Layers,        label: 'Pool Management' },
  { to: '/sub-users',    icon: Users,            label: 'Sub-Users', adminOnly: true },
  { to: '/settings',     icon: Settings,         label: 'Settings' },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutUser();
    navigate('/');
  }

  const navItems = NAV.filter(n => !n.adminOnly || isAdmin);

  return (
    <div className="flex h-screen overflow-hidden" style={{ 
      background: 'var(--gradient-bg)',
      backgroundAttachment: 'fixed'
    }}>
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed lg:relative z-50 lg:z-auto h-full flex flex-col
          bg-[var(--surface-1)] border-r border-[var(--border)]
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <Trophy size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-[var(--text-1)] text-lg leading-none">
              TourneyPro
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User strip */}
        <div className="border-t border-[var(--border)] p-3">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-[var(--surface-2)]">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'var(--accent)' }}>
                {(profile?.name ?? user?.email ?? 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-1)] truncate">
                  {profile?.name ?? 'User'}
                </p>
                <p className="text-xs text-[var(--text-3)] truncate">
                  {profile?.role === 'main' ? 'Admin' : `Sub · ${profile?.permissions}`}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-all`}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-3)] hover:text-[var(--text-1)] transition-all z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-1)] flex-shrink-0">
          <button
            className="lg:hidden p-1 rounded text-[var(--text-2)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-2)] transition-all"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-2)] transition-all relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--accent)' }}>
            {(profile?.name ?? 'U')[0].toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

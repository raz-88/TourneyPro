// src/App.jsx
// ─────────────────────────────────────────────────────────────
// Root component: sets up routing and global providers.
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TournamentProvider } from './contexts/TournamentContext';
import { ThemeProvider } from './contexts/ThemeContext';

import ProtectedRoute    from './components/auth/ProtectedRoute';
import AuthPage          from './components/auth/AuthPage';
import Layout            from './components/dashboard/Layout';
import DashboardPage     from './components/dashboard/DashboardPage';
import TournamentsPage   from './components/tournament/TournamentsPage';
import CreateTournamentPage from './components/tournament/CreateTournamentPage';
import TournamentDetailPage from './components/tournament/TournamentDetailPage';
import MatchesPage       from './components/matches/MatchesPage';
import FixturesPage      from './components/fixtures/FixturesPage';
import LeaderboardPage   from './components/leaderboard/LeaderboardPage';
import PoolManagementPage from './components/pools/PoolManagementPage';
import SubUsersPage      from './components/subusers/SubUsersPage';
import SettingsPage      from './components/settings/SettingsPage';

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<AuthPage />} />

      {/* Protected — all wrapped in Layout */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout><DashboardPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/tournaments" element={
        <ProtectedRoute>
          <Layout><TournamentsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/tournaments/new" element={
        <ProtectedRoute>
          <Layout><CreateTournamentPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/tournaments/:id" element={
        <ProtectedRoute>
          <Layout><TournamentDetailPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/matches" element={
        <ProtectedRoute>
          <Layout><MatchesPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/fixtures" element={
        <ProtectedRoute>
          <Layout><FixturesPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/leaderboard" element={
        <ProtectedRoute>
          <Layout><LeaderboardPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/pool-management" element={
        <ProtectedRoute>
          <Layout><PoolManagementPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/sub-users" element={
        <ProtectedRoute adminOnly>
          <Layout><SubUsersPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout><SettingsPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <TournamentProvider>
            <AppRoutes />
          </TournamentProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

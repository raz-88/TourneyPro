// src/components/dashboard/DashboardPage.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords, Users, CheckCircle, Clock, TrendingUp, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getSubUsers } from '../../firebase/firestore';
import { StatCard, Card, Badge, Button, Spinner } from '../ui';

export default function DashboardPage() {
  const { dataUserId, profile } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [subUsers,    setSubUsers]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!dataUserId) return;
    Promise.all([
      getTournaments(dataUserId),
      getSubUsers(dataUserId),
    ]).then(([t, s]) => {
      setTournaments(t);
      setSubUsers(s);
    }).finally(() => setLoading(false));
  }, [dataUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const active    = tournaments.filter(t => t.status === 'active').length;
  const completed = tournaments.filter(t => t.status === 'completed').length;
  const recent    = tournaments.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--text-1)]">
            Welcome back, {profile?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-[var(--text-3)] mt-1">
            Here's what's happening with your tournaments.
          </p>
        </div>
        <Button onClick={() => navigate('/tournaments/new')}>
          <Plus size={16} />
          New Tournament
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Trophy}      label="Total Tournaments" value={tournaments.length} color="accent" />
        <StatCard icon={TrendingUp}  label="Active"           value={active}             color="emerald" />
        <StatCard icon={CheckCircle} label="Completed"        value={completed}          color="cyan" />
        <StatCard icon={Users}       label="Sub-Users"        value={subUsers.length}    color="amber" />
      </div>

      {/* Recent tournaments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-[var(--text-1)]">Recent Tournaments</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tournaments')}>
            View all →
          </Button>
        </div>

        {recent.length === 0 ? (
          <Card className="text-center py-12">
            <Trophy size={40} className="mx-auto text-[var(--text-3)] mb-3" />
            <p className="text-[var(--text-2)] font-medium">No tournaments yet</p>
            <p className="text-[var(--text-3)] text-sm mb-4">Create your first tournament to get started</p>
            <Button onClick={() => navigate('/tournaments/new')}>
              <Plus size={16} /> Create Tournament
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map(t => (
              <Card
                key={t.id}
                onClick={() => navigate(`/tournaments/${t.id}`)}
                className="flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--accent)', opacity: 0.15 }}>
                  <Trophy size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-1)] truncate">{t.name}</p>
                  <p className="text-xs text-[var(--text-3)]">{t.sport} · {t.numTeams} teams</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.tournamentType === 'pool' ? 'pool' : 'knockout'}>
                    {t.tournamentType === 'pool' ? 'Pool' : 'Knockout'}
                  </Badge>
                  <Badge variant={t.status}>{t.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Trophy,   label: 'Create Tournament', desc: 'Set up pools & fixtures',    to: '/tournaments/new' },
          { icon: Swords,   label: 'Update Scores',     desc: 'Enter match results',         to: '/matches' },
          { icon: Users,    label: 'Add Sub-User',      desc: 'Delegate access to a member', to: '/sub-users' },
        ].map(({ icon: Icon, label, desc, to }) => (
          <Card key={label} onClick={() => navigate(to)} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-[var(--accent)]" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[var(--text-1)]">{label}</p>
              <p className="text-xs text-[var(--text-3)]">{desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

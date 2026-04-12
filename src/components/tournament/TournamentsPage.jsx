// src/components/tournament/TournamentsPage.jsx
// ─────────────────────────────────────────────────────────────
// Lists all tournaments; links to detail page.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trophy, Trash2, Eye, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, deleteTournament } from '../../firebase/firestore';
import { Card, Badge, Button, Spinner, EmptyState, Input } from '../ui';

export default function TournamentsPage() {
  const { dataUserId, canEdit } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const data = await getTournaments(dataUserId);
    setTournaments(data);
    setLoading(false);
  };

  useEffect(() => { if (dataUserId) load(); }, [dataUserId]);

  const filtered = tournaments.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this tournament? This cannot be undone.')) return;
    await deleteTournament(id);
    setTournaments(ts => ts.filter(t => t.id !== id));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">My Tournaments</h1>
          <p className="text-[var(--text-3)] text-sm mt-0.5">{tournaments.length} total</p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate('/tournaments/new')}>
            <Plus size={16} /> New Tournament
          </Button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
          placeholder="Search tournaments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments found"
          description={search ? 'Try a different search term.' : 'Create your first tournament to get started.'}
          action={canEdit && !search && (
            <Button onClick={() => navigate('/tournaments/new')}>
              <Plus size={16} /> Create Tournament
            </Button>
          )}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map(t => (
            <Card
              key={t.id}
              onClick={() => navigate(`/tournaments/${t.id}`)}
              className="flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent)' }}>
                <Trophy size={20} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[var(--text-1)]">{t.name}</p>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  {t.sport} · {t.numTeams} teams · {t.fixtureMode} mode
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={t.tournamentType === 'pool' ? 'pool' : 'knockout'}>
                  {t.tournamentType === 'pool' ? 'Pool' : 'Knockout'}
                </Badge>
                <Badge variant={t.status}>{t.status}</Badge>

                <button
                  onClick={e => { e.stopPropagation(); navigate(`/tournaments/${t.id}`); }}
                  className="p-2 rounded-lg text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-all"
                >
                  <Eye size={16} />
                </button>

                {canEdit && (
                  <button
                    onClick={e => handleDelete(e, t.id)}
                    className="p-2 rounded-lg text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

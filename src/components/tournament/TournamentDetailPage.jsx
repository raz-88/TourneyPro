// src/components/tournament/TournamentDetailPage.jsx
// ─────────────────────────────────────────────────────────────
// Shows a single tournament: teams tab + generate fixtures CTA.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy, Users, Calendar, BarChart3, Zap, ArrowLeft,
  Plus, Trash2, Edit2, Check, X
} from 'lucide-react';
import {
  getTournament, getTeams, addTeam, updateTeam, deleteTeam,
  saveMatches, getMatches, updateTournament,
} from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  autoPoolConfig, buildPoolMatches, buildKnockoutMatches,
} from '../../utils/fixtureGenerator';
import { Card, Badge, Button, Spinner, Input, Modal } from '../ui';

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { dataUserId, canEdit } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams]           = useState([]);
  const [matches, setMatches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('teams');
  const [genLoading, setGenLoading] = useState(false);

  // Inline team editing
  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getTournament(id), getTeams(id), getMatches(id)]).then(([t, ts, ms]) => {
      setTournament(t);
      setTeams(ts);
      setMatches(ms);
      setLoading(false);
    });
  }, [id]);

  // ── Team CRUD ──────────────────────────────────────────────
  async function handleAddTeam() {
    if (!newTeamName.trim()) return;
    const tid = await addTeam(id, dataUserId, { name: newTeamName.trim() });
    setTeams(ts => [...ts, { id: tid, name: newTeamName.trim() }]);
    setNewTeamName('');
    setAddingTeam(false);
  }

  async function handleEditTeam(teamId) {
    await updateTeam(teamId, { name: editName });
    setTeams(ts => ts.map(t => t.id === teamId ? { ...t, name: editName } : t));
    setEditingId(null);
  }

  async function handleDeleteTeam(teamId) {
    await deleteTeam(teamId);
    setTeams(ts => ts.filter(t => t.id !== teamId));
  }

  // ── Fixture Generation ─────────────────────────────────────
  async function generateFixtures() {
    if (!tournament) return;
    if (!confirm('Generate fixtures? Existing matches will not be deleted.')) return;
    setGenLoading(true);

    try {
      const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
      const teamIds = teams.map(t => t.id);
      let newMatches = [];

      if (tournament.tournamentType === 'pool') {
        // Determine pool config
        let config;
        if (tournament.fixtureMode === 'auto') {
          config = autoPoolConfig(teamIds.length);
        } else {
          const nPools = tournament.numPools || 2;
          const base   = Math.floor(teamIds.length / nPools);
          const rem    = teamIds.length % nPools;
          const sizes  = Array(nPools).fill(base).map((v, i) => i < rem ? v + 1 : v);
          config = { pools: nPools, teamsPerPool: sizes };
        }

        // Distribute teams into pools
        let cursor = 0;
        for (let p = 0; p < config.pools; p++) {
          const size     = config.teamsPerPool[p];
          const poolTeams = teamIds.slice(cursor, cursor + size);
          cursor += size;
          const poolId   = `Pool ${String.fromCharCode(65 + p)}`; // Pool A, B, C…
          const ms       = buildPoolMatches(id, dataUserId, poolId, poolTeams, teamMap);
          newMatches      = newMatches.concat(ms);
        }
      } else {
        // Knockout
        newMatches = buildKnockoutMatches(id, dataUserId, teamIds, {
          includeQF:    tournament.includeQF,
          includeSF:    tournament.includeSF,
          includeFinal: tournament.includeFinal,
        });
      }

      await saveMatches(newMatches);
      await updateTournament(id, { status: 'active' });

      // Reload matches
      const fresh = await getMatches(id);
      setMatches(fresh);
      setTournament(t => ({ ...t, status: 'active' }));
      setTab('fixtures');
    } finally {
      setGenLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  }

  if (!tournament) {
    return <p className="text-center text-[var(--text-3)] py-16">Tournament not found.</p>;
  }

  const pools = [...new Set(matches.map(m => m.poolId).filter(Boolean))].sort();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/tournaments')}
          className="mt-1 p-2 rounded-lg text-[var(--text-3)] hover:bg-[var(--surface-2)] transition-all">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">{tournament.name}</h1>
            <Badge variant={tournament.status}>{tournament.status}</Badge>
            <Badge variant={tournament.tournamentType === 'pool' ? 'pool' : 'knockout'}>
              {tournament.tournamentType === 'pool' ? 'Pool System' : 'Knockout'}
            </Badge>
          </div>
          <p className="text-[var(--text-3)] text-sm mt-1">
            {tournament.sport} · {teams.length} teams · {matches.length} matches generated
          </p>
        </div>
        {canEdit && matches.length === 0 && (
          <Button onClick={generateFixtures} disabled={genLoading || teams.length < 2}>
            <Zap size={16} />
            {genLoading ? 'Generating…' : 'Generate Fixtures'}
          </Button>
        )}
        {canEdit && matches.length > 0 && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/matches?t=${id}`)}>
              <Calendar size={14} /> Matches
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/leaderboard?t=${id}`)}>
              <BarChart3 size={14} /> Leaderboard
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {[
          { key: 'teams',    icon: Users,    label: 'Teams' },
          { key: 'fixtures', icon: Calendar, label: 'Fixtures' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ─ TEAMS TAB ─ */}
      {tab === 'teams' && (
        <div className="space-y-3">
          {teams.map((team, idx) => (
            <Card key={team.id} className="flex items-center gap-4 py-3">
              <span className="text-sm font-bold text-[var(--text-3)] w-6 text-center flex-shrink-0">
                {idx + 1}
              </span>
              {editingId === team.id ? (
                <>
                  <input
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--accent)] text-[var(--text-1)] text-sm focus:outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEditTeam(team.id)}
                    autoFocus
                  />
                  <button onClick={() => handleEditTeam(team.id)}
                    className="p-1.5 rounded text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                    <Check size={15} />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="p-1.5 rounded text-[var(--text-3)] hover:bg-[var(--surface-2)] transition-colors">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[var(--text-1)] font-medium">{team.name}</span>
                  {canEdit && (
                    <>
                      <button onClick={() => { setEditingId(team.id); setEditName(team.name); }}
                        className="p-1.5 rounded text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteTeam(team.id)}
                        className="p-1.5 rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </>
              )}
            </Card>
          ))}

          {/* Add team */}
          {canEdit && (
            addingTeam ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                  placeholder="Team name"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
                  autoFocus
                />
                <Button onClick={handleAddTeam}><Check size={15} /></Button>
                <Button variant="secondary" onClick={() => setAddingTeam(false)}><X size={15} /></Button>
              </div>
            ) : (
              <button
                onClick={() => setAddingTeam(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-3)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Plus size={16} /> Add Team
              </button>
            )
          )}
        </div>
      )}

      {/* ─ FIXTURES TAB ─ */}
      {tab === 'fixtures' && (
        <div className="space-y-6">
          {matches.length === 0 ? (
            <Card className="text-center py-12">
              <Calendar size={40} className="mx-auto text-[var(--text-3)] mb-3" />
              <p className="text-[var(--text-2)] font-medium">No fixtures generated yet</p>
              <p className="text-[var(--text-3)] text-sm mb-4">
                Add at least 2 teams, then click "Generate Fixtures".
              </p>
              {canEdit && teams.length >= 2 && (
                <Button onClick={generateFixtures} disabled={genLoading}>
                  <Zap size={16} /> {genLoading ? 'Generating…' : 'Generate Now'}
                </Button>
              )}
            </Card>
          ) : (
            <>
              {/* Pool matches */}
              {pools.map(pool => (
                <div key={pool}>
                  <h3 className="font-display font-semibold text-[var(--text-1)] mb-3 flex items-center gap-2">
                    <Badge variant="pool">{pool}</Badge>
                    <span className="text-sm text-[var(--text-3)] font-normal">
                      {matches.filter(m => m.poolId === pool).length} matches
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {matches.filter(m => m.poolId === pool).map(m => (
                      <MatchRow key={m.id} match={m} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Knockout matches */}
              {['QF', 'SF', 'Final'].map(stage => {
                const stagematches = matches.filter(m => m.stage === stage);
                if (!stagematches.length) return null;
                return (
                  <div key={stage}>
                    <h3 className="font-display font-semibold text-[var(--text-1)] mb-3">
                      <Badge variant="knockout">{stage === 'QF' ? 'Quarter Finals' : stage === 'SF' ? 'Semi Finals' : 'Final'}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {stagematches.map(m => <MatchRow key={m.id} match={m} />)}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRow({ match }) {
  return (
    <Card className="flex items-center gap-4 py-3">
      <div className="flex-1 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-[var(--text-1)] text-right flex-1">{match.teamAName}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {match.status === 'completed' ? (
            <span className="font-display font-bold text-lg text-[var(--text-1)]">
              {match.scoreA} – {match.scoreB}
            </span>
          ) : (
            <span className="text-xs font-medium text-[var(--text-3)] px-3 py-1 rounded-full bg-[var(--surface-2)]">VS</span>
          )}
        </div>
        <span className="text-sm font-medium text-[var(--text-1)] flex-1">{match.teamBName}</span>
      </div>
      <Badge variant={match.status}>{match.status}</Badge>
      {match.round && (
        <span className="text-xs text-[var(--text-3)]">Round {match.round}</span>
      )}
    </Card>
  );
}

// src/components/tournament/TournamentDetailPage.jsx
// ─────────────────────────────────────────────────────────────
// Shows a single tournament: teams tab with team management.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy, Users, Calendar, BarChart3, Zap, ArrowLeft,
  Plus, Trash2, Edit2, Check, X
} from 'lucide-react';
import {
  getTournament, getTeams, addTeam, updateTeam, deleteTeam,
  saveMatches, getMatches, updateTournament, upsertLeaderboardEntry,
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
    if (!confirm('Generate fixtures? This will create all matches for this tournament.')) return;
    setGenLoading(true);

    try {
      const teamIds = teams.map(t => t.id);
      let newMatches = [];

      if (tournament.tournamentType === 'pool') {
        // Determine pool config and assign teams to pools
        let config;
        const nPools = tournament.numPools || 2;
        const base = Math.floor(teamIds.length / nPools);
        const rem = teamIds.length % nPools;
        const poolSizes = Array(nPools).fill(base).map((v, i) => i < rem ? v + 1 : v);
        config = { pools: nPools, sizes: poolSizes };

        // Create team=>pool mapping and update database
        const teamPoolMap = {};
        let teamIndex = 0;
        for (let poolIdx = 0; poolIdx < config.pools; poolIdx++) {
          const poolLetter = String.fromCharCode(65 + poolIdx);
          const poolSize = config.sizes[poolIdx];
          
          for (let j = 0; j < poolSize && teamIndex < teamIds.length; j++) {
            const teamId = teamIds[teamIndex];
            teamPoolMap[teamId] = poolLetter;
            await updateTeam(teamId, { pool: poolLetter });
            setTeams(ts => ts.map(t => 
              t.id === teamId ? { ...t, pool: poolLetter } : t
            ));
            teamIndex++;
          }
        }

        // Generate round-robin matches for each pool (separate lists)
        const allPoolMatches = []; // [{ poolLetter, matches: [...] }, ...]
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
        
        for (let poolIdx = 0; poolIdx < config.pools; poolIdx++) {
          const poolLetter = String.fromCharCode(65 + poolIdx);
          // Get teams in this pool from our mapping
          const poolTeamIds = Object.entries(teamPoolMap)
            .filter(([_, pool]) => pool === poolLetter)
            .map(([teamId, _]) => teamId);
          
          if (poolTeamIds.length < 2) continue;
          
          const ms = buildPoolMatches(id, dataUserId, `Pool ${poolLetter}`, poolTeamIds, teamMap);
          
          // Add stage and poolId info (but not matchNumber yet)
          ms.forEach(m => {
            m.stage = 'pool';
            m.poolId = `Pool ${poolLetter}`;
          });
          
          allPoolMatches.push({ poolLetter, matches: ms });
        }

        // Interleave matches: 1st match from Pool A, 1st match from Pool B, 1st match from Pool C, 1st match from Pool D, 2nd match from Pool A, etc.
        let matchNo = 1;
        
        if (allPoolMatches.length > 0) {
          // Find max matches in any pool
          const maxMatches = Math.max(...allPoolMatches.map(p => p.matches.length));
          
          // Iterate by match index, then by pool
          for (let matchIdx = 0; matchIdx < maxMatches; matchIdx++) {
            for (const poolData of allPoolMatches) {
              if (poolData.matches[matchIdx]) {
                const match = poolData.matches[matchIdx];
                match.matchNumber = matchNo++;
                newMatches.push(match);
              }
            }
          }
        }

        // Generate knockout matches if applicable
        // NOTE: Knockout matches are only generated after pool matches are completed
        // and based on actual leaderboard standings, not pre-generated with placeholders
      } else {
        // Knockout from start
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
        const koMatches = buildKnockoutMatches(id, dataUserId, teamIds, {
          includeQF: tournament.includeQF,
          includeSF: tournament.includeSF,
          includeFinal: tournament.includeFinal,
        });
        
        // Add match numbers
        let matchNo = 1;
        koMatches.forEach(m => {
          m.matchNumber = matchNo++;
        });
        
        newMatches = koMatches;
      }

      if (newMatches.length > 0) {
        await saveMatches(newMatches);
      }

      // Initialize leaderboard entries for all teams with their pool assignments
      if (tournament.tournamentType === 'pool') {
        const poolMatches = newMatches.filter(m => m.type === 'pool');
        const pools = [...new Set(poolMatches.map(m => m.poolId).filter(Boolean))];
        
        for (const pool of pools) {
          const poolTeamIds = [...new Set(
            poolMatches
              .filter(m => m.poolId === pool)
              .flatMap(m => [m.teamAId, m.teamBId])
          )];

          // Initialize leaderboard entry for each team in the pool
          for (const teamId of poolTeamIds) {
            await upsertLeaderboardEntry(id, teamId, {
              teamId,
              poolId: pool,
              played: 0,
              won: 0,
              lost: 0,
              drawn: 0,
              gf: 0,
              ga: 0,
              gd: 0,
              points: 0,
              mainUserId: dataUserId,
            });
          }
        }
      }
      
      await updateTournament(id, { status: 'active', fixturesGenerated: true });

      // Reload
      const freshMatches = await getMatches(id);
      setMatches(freshMatches);
      setTournament(t => ({ ...t, status: 'active', fixturesGenerated: true }));
    } catch (err) {
      console.error('Error generating fixtures:', err);
      alert('Error generating fixtures: ' + err.message);
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
        <div className="space-y-6">
          {/* Pool Display */}
          {tournament.tournamentType === 'pool' && tournament.numPools && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-1)] mb-4">Teams by Pool</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: tournament.numPools }).map((_, poolIdx) => {
                  const poolLetter = String.fromCharCode(65 + poolIdx);
                  const poolTeams = teams.filter(t => t.pool === poolLetter).length > 0 
                    ? teams.filter(t => t.pool === poolLetter)
                    : []; // Show empty pools too
                  
                  return (
                    <Card key={poolIdx} className="p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="pool">Pool {poolLetter}</Badge>
                        <span className="text-xs text-[var(--text-3)]">{poolTeams.length} teams</span>
                      </div>
                      
                      {poolTeams.length > 0 ? (
                        <div className="space-y-2">
                          {poolTeams.map((team, idx) => (
                            <div key={team.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-1)]">
                              <span className="text-xs font-medium text-[var(--text-3)] w-4">{idx + 1}.</span>
                              <span className="flex-1 text-sm text-[var(--text-1)] font-medium">{team.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--text-3)] italic">No teams assigned yet</p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Teams List */}
          {tournament.tournamentType === 'knockout' && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-1)] mb-4">Teams ({teams.length})</h2>
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
              </div>
            </div>
          )}

          {/* Add Team Button */}
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
    </div>
  );
}
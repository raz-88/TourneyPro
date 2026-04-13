// src/components/matches/MatchesPage.jsx
// ─────────────────────────────────────────────────────────────
// Lists all matches across tournaments; allows score entry.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Swords, Filter, Clock, CheckCircle, Play, Save, X, FileDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getMatches, getTeams, updateMatch, upsertLeaderboardEntry } from '../../firebase/firestore';
import { calculateStandings } from '../../utils/fixtureGenerator';
import { exportMatchesToExcel, exportMatchesToPDF } from '../../utils/exportUtils';
import { Card, Badge, Button, Select, Spinner, EmptyState } from '../ui';

export default function MatchesPage() {
  const { dataUserId, canEdit } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedTournament = searchParams.get('t');

  const [tournaments, setTournaments]   = useState([]);
  const [matches,     setMatches]       = useState([]);
  const [teamMap,     setTeamMap]       = useState({});
  const [loading,     setLoading]       = useState(true);

  // Filters
  const [filterTournament, setFilterTournament] = useState(preselectedTournament ?? 'all');
  const [filterStatus,     setFilterStatus]     = useState('all');

  // Score editing state
  const [editingMatch, setEditingMatch] = useState(null);
  const [scoreA, setScoreA]             = useState('');
  const [scoreB, setScoreB]             = useState('');
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    if (!dataUserId) return;
    async function load() {
      const ts = await getTournaments(dataUserId);
      setTournaments(ts);

      // Load matches for all tournaments
      const allMatches = await Promise.all(ts.map(t => getMatches(t.id)));
      setMatches(allMatches.flat());

      // Load teams for all tournaments for name lookups
      const allTeams = await Promise.all(ts.map(t => getTeams(t.id)));
      const teamMapObj = {};
      allTeams.forEach(teams => {
        teams.forEach(team => {
          teamMapObj[team.id] = team;
        });
      });
      setTeamMap(teamMapObj);

      setLoading(false);
    }
    load();
  }, [dataUserId]);

  const filtered = matches
    .filter(m => {
      if (filterTournament !== 'all' && m.tournamentId !== filterTournament) return false;
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  // ── Save match result ─────────────────────────────────────
  async function handleSaveScore() {
    if (!editingMatch) return;
    setSaving(true);
    try {
      const sA = Number(scoreA);
      const sB = Number(scoreB);
      const winnerId = sA > sB ? editingMatch.teamAId : sB > sA ? editingMatch.teamBId : null;

      await updateMatch(editingMatch.id, {
        scoreA: sA, scoreB: sB,
        status: 'completed',
        winnerId,
      });

      // Recalculate leaderboard for this pool/tournament
      const tournament = tournaments.find(t => t.id === editingMatch.tournamentId);
      if (tournament && editingMatch.poolId) {
        const poolMatches = matches
          .filter(m => m.tournamentId === editingMatch.tournamentId && m.poolId === editingMatch.poolId)
          .map(m => m.id === editingMatch.id ? { ...m, scoreA: sA, scoreB: sB, status: 'completed' } : m);

        const poolTeamIds = [...new Set(poolMatches.flatMap(m => [m.teamAId, m.teamBId]))];
        const standings = calculateStandings(poolTeamIds, poolMatches, {
          win: tournament.scoringWin ?? 3,
          draw: tournament.scoringDraw ?? 1,
          loss: tournament.scoringLoss ?? 0,
        });

        await Promise.all(standings.map(s =>
          upsertLeaderboardEntry(editingMatch.tournamentId, s.teamId, {
            ...s,
            poolId: editingMatch.poolId,
            mainUserId: dataUserId,
          })
        ));
      }

      // Update local state
      setMatches(ms => ms.map(m =>
        m.id === editingMatch.id ? { ...m, scoreA: sA, scoreB: sB, status: 'completed', winnerId } : m
      ));
      setEditingMatch(null);
    } finally {
      setSaving(false);
    }
  }

  const statusIcon = { upcoming: Clock, ongoing: Play, completed: CheckCircle };

  // Export handlers
  async function handleExportExcel() {
    try {
      await exportMatchesToExcel(matches, Object.values(teamMap), 'Tournament');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export to Excel: ' + err.message);
    }
  }

  async function handleExportPDF() {
    try {
      await exportMatchesToPDF('Tournament');
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Matches</h1>
          <p className="text-[var(--text-3)] text-sm mt-0.5">{filtered.length} matches shown</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-sm font-medium transition-all flex items-center gap-2"
            title="Export matches to Excel"
          >
            <FileDown size={16} />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 text-sm font-medium transition-all flex items-center gap-2"
            title="Export matches to PDF"
          >
            <FileDown size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-[var(--text-3)]" />
        <select
          className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
          value={filterTournament}
          onChange={e => setFilterTournament(e.target.value)}
        >
          <option value="all">All Tournaments</option>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select
          className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Swords} title="No matches found" description="Generate fixtures from a tournament to see matches here." />
      ) : (
        <div className="space-y-3">
          {filtered.map(match => {
            const StatusIcon = statusIcon[match.status] ?? Clock;
            const isEditing  = editingMatch?.id === match.id;

            return (
              <Card key={match.id}>
                <div className="flex items-center gap-4">
                  {/* Match Number */}
                  {match.matchNumber && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-[var(--accent)]">M{match.matchNumber}</span>
                    </div>
                  )}

                  {/* Status icon */}
                  <StatusIcon size={16} className={
                    match.status === 'completed' ? 'text-emerald-400' :
                    match.status === 'ongoing'   ? 'text-amber-400' : 'text-blue-400'
                  } />

                  {/* Teams & score */}
                  <div className="flex-1 flex items-center gap-3">
                    <span className="font-medium text-[var(--text-1)] text-sm text-right flex-1">
                      {match.teamAName ?? teamMap[match.teamAId]?.name ?? '—'}
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number" min="0"
                          className="w-14 px-2 py-1 rounded text-center bg-[var(--surface-2)] border border-[var(--accent)] text-[var(--text-1)] text-sm focus:outline-none"
                          value={scoreA}
                          onChange={e => setScoreA(e.target.value)}
                        />
                        <span className="text-[var(--text-3)] font-bold">–</span>
                        <input
                          type="number" min="0"
                          className="w-14 px-2 py-1 rounded text-center bg-[var(--surface-2)] border border-[var(--accent)] text-[var(--text-1)] text-sm focus:outline-none"
                          value={scoreB}
                          onChange={e => setScoreB(e.target.value)}
                        />
                      </div>
                    ) : match.status === 'completed' ? (
                      <span className="font-display font-bold text-xl text-[var(--text-1)] flex-shrink-0">
                        {match.scoreA} – {match.scoreB}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--text-3)] bg-[var(--surface-2)] px-3 py-1 rounded-full flex-shrink-0">VS</span>
                    )}

                    <span className="font-medium text-[var(--text-1)] text-sm flex-1">
                      {match.teamBName ?? teamMap[match.teamBId]?.name ?? '—'}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {/* Pool match info */}
                    {match.poolId && (
                      <div className="flex items-center gap-2">
                        <Badge variant="pool">{match.poolId}</Badge>
                        {match.round && <span className="text-xs text-[var(--text-3)]">R{match.round}</span>}
                      </div>
                    )}
                    {/* Knockout match info */}
                    {match.stage && (
                      <Badge variant="knockout">
                        {match.stage === 'QF' ? 'Quarter Final' : match.stage === 'SF' ? 'Semi Final' : match.stage}
                      </Badge>
                    )}
                    <Badge variant={match.status}>{match.status}</Badge>

                    {/* Edit / save / cancel */}
                    {canEdit && (
                      isEditing ? (
                        <>
                          <Button size="sm" onClick={handleSaveScore} disabled={saving}>
                            <Save size={13} /> {saving ? '…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingMatch(null)}>
                            <X size={13} />
                          </Button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingMatch(match);
                            setScoreA(match.scoreA ?? '');
                            setScoreB(match.scoreB ?? '');
                          }}
                          className="p-1.5 rounded text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-all"
                          title="Enter score"
                        >
                          <Swords size={14} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Hidden section for PDF export */}
      <div id="matches-export-section" style={{ display: 'none' }} className="p-8 bg-white text-black">
        <h1 className="text-3xl font-bold mb-6">All Matches Report</h1>
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="border border-gray-300 px-3 py-2 text-left">Type</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Match #</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Stage/Pool</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Round</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Team A</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Score</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Team B</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id}>
                <td className="border border-gray-300 px-3 py-2">{m.type === 'pool' ? 'Pool' : 'Knockout'}</td>
                <td className="border border-gray-300 px-3 py-2 font-bold">M{m.matchNumber || '-'}</td>
                <td className="border border-gray-300 px-3 py-2">{m.stage || m.poolId || '-'}</td>
                <td className="border border-gray-300 px-3 py-2">{m.round || '-'}</td>
                <td className="border border-gray-300 px-3 py-2">{m.teamAName || teamMap[m.teamAId]?.name || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                  {m.scoreA !== null ? m.scoreA : '-'} - {m.scoreB !== null ? m.scoreB : '-'}
                </td>
                <td className="border border-gray-300 px-3 py-2">{m.teamBName || teamMap[m.teamBId]?.name || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 capitalize">{m.status || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

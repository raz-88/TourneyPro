// src/components/fixtures/FixturesPage.jsx
// ─────────────────────────────────────────────────────────────
// Visual fixture browser — pool rounds or knockout bracket.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Calendar, Filter, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getMatches, getTeams } from '../../firebase/firestore';
import { Card, Badge, Spinner, EmptyState } from '../ui';

export default function FixturesPage() {
  const { dataUserId } = useAuth();

  const [tournaments,  setTournaments]  = useState([]);
  const [selected,     setSelected]     = useState('');
  const [matches,      setMatches]      = useState([]);
  const [teamMap,      setTeamMap]      = useState({});
  const [loading,      setLoading]      = useState(true);
  const [filterPool,   setFilterPool]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (!dataUserId) return;
    getTournaments(dataUserId).then(ts => {
      setTournaments(ts);
      if (ts.length) setSelected(ts[0].id);
      setLoading(false);
    });
  }, [dataUserId]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setFilterPool('all');
    Promise.all([getMatches(selected), getTeams(selected)]).then(([ms, teams]) => {
      setMatches(ms);
      setTeamMap(Object.fromEntries(teams.map(t => [t.id, t])));
      setLoading(false);
    });
  }, [selected]);

  const pools   = [...new Set(matches.map(m => m.poolId).filter(Boolean))].sort();
  const stages  = [...new Set(matches.map(m => m.stage).filter(Boolean))];
  const isKnock = stages.length > 0;

  const filtered = matches.filter(m => {
    if (filterPool !== 'all' && m.poolId !== filterPool && m.stage !== filterPool) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  // Group pool matches by round
  const rounds = {};
  filtered.filter(m => m.type === 'pool').forEach(m => {
    const key = `Round ${m.round}`;
    if (!rounds[key]) rounds[key] = [];
    rounds[key].push(m);
  });

  // Group knockout by stage
  const knockoutGroups = {};
  filtered.filter(m => m.type === 'knockout').forEach(m => {
    if (!knockoutGroups[m.stage]) knockoutGroups[m.stage] = [];
    knockoutGroups[m.stage].push(m);
  });

  const stageOrder = { QF: 1, SF: 2, Final: 3 };
  const sortedStages = Object.keys(knockoutGroups).sort((a, b) => (stageOrder[a] ?? 9) - (stageOrder[b] ?? 9));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Fixtures</h1>
          <p className="text-[var(--text-3)] text-sm mt-0.5">
            {filtered.length} of {matches.length} matches displayed
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={15} className="text-[var(--text-3)]" />

        {/* Tournament selector */}
        <select
          className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">Select tournament</option>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Pool / Stage filter */}
        {(pools.length > 0 || stages.length > 0) && (
          <select
            className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
            value={filterPool}
            onChange={e => setFilterPool(e.target.value)}
          >
            <option value="all">All Groups</option>
            {pools.map(p  => <option key={p} value={p}>{p}</option>)}
            {stages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Status filter */}
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
      ) : matches.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No fixtures yet"
          description="Generate fixtures from a tournament to view them here."
        />
      ) : (
        <>
          {/* ── Pool Rounds ── */}
          {Object.keys(rounds).sort().map(round => (
            <section key={round}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-display font-semibold text-[var(--text-1)]">{round}</h2>
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--text-3)]">{rounds[round].length} matches</span>
              </div>
              <div className="grid gap-2">
                {rounds[round].map(m => (
                  <FixtureCard key={m.id} match={m} teamMap={teamMap} />
                ))}
              </div>
            </section>
          ))}

          {/* ── Knockout Stages ── */}
          {sortedStages.map(stage => (
            <section key={stage}>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="knockout">
                  {stage === 'QF' ? 'Quarter Finals' : stage === 'SF' ? 'Semi Finals' : 'Final'}
                </Badge>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className={`grid gap-3 ${stage === 'QF' ? 'grid-cols-1 md:grid-cols-2' : ''}`}>
                {knockoutGroups[stage].map(m => (
                  <FixtureCard key={m.id} match={m} teamMap={teamMap} knockout />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

// ── Fixture Card Component ─────────────────────────────────────
function FixtureCard({ match, teamMap, knockout }) {
  const nameA = match.teamAName ?? teamMap[match.teamAId]?.name ?? '—';
  const nameB = match.teamBName ?? teamMap[match.teamBId]?.name ?? '—';

  const winnerA = match.status === 'completed' && Number(match.scoreA) > Number(match.scoreB);
  const winnerB = match.status === 'completed' && Number(match.scoreB) > Number(match.scoreA);

  return (
    <Card className={`p-4 ${knockout ? 'border-l-2 border-l-rose-500/40' : ''}`}>
      <div className="flex items-center gap-4">
        {/* Pool badge */}
        {match.poolId && <Badge variant="pool" className="flex-shrink-0">{match.poolId}</Badge>}

        {/* Match */}
        <div className="flex-1 flex items-center gap-3">
          <span className={`flex-1 text-right text-sm font-medium ${winnerA ? 'text-emerald-400' : 'text-[var(--text-1)]'}`}>
            {nameA}
          </span>

          {match.status === 'completed' ? (
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className={`text-lg font-display font-bold ${winnerA ? 'text-emerald-400' : 'text-[var(--text-2)]'}`}>
                {match.scoreA}
              </span>
              <span className="text-[var(--text-3)] text-sm">–</span>
              <span className={`text-lg font-display font-bold ${winnerB ? 'text-emerald-400' : 'text-[var(--text-2)]'}`}>
                {match.scoreB}
              </span>
            </div>
          ) : (
            <span className="flex-shrink-0 text-xs font-bold text-[var(--text-3)] bg-[var(--surface-2)] px-3 py-1.5 rounded-full">
              VS
            </span>
          )}

          <span className={`flex-1 text-sm font-medium ${winnerB ? 'text-emerald-400' : 'text-[var(--text-1)]'}`}>
            {nameB}
          </span>
        </div>

        {/* Status */}
        <Badge variant={match.status} className="flex-shrink-0">{match.status}</Badge>

        {/* Scheduled time */}
        {match.scheduledAt && (
          <span className="text-xs text-[var(--text-3)] flex-shrink-0">
            {new Date(match.scheduledAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </Card>
  );
}

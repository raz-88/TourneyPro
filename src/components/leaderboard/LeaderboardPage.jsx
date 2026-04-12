// src/components/leaderboard/LeaderboardPage.jsx

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Trophy, Medal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getLeaderboard, getTeams } from '../../firebase/firestore';
import { Card, Badge, Spinner, EmptyState } from '../ui';

export default function LeaderboardPage() {
  const { dataUserId } = useAuth();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('t');

  const [tournaments, setTournaments] = useState([]);
  const [selected,    setSelected]    = useState(preselected ?? '');
  const [entries,     setEntries]     = useState([]);
  const [teamMap,     setTeamMap]     = useState({});
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!dataUserId) return;
    getTournaments(dataUserId).then(ts => {
      setTournaments(ts);
      if (!selected && ts.length) setSelected(ts[0].id);
      setLoading(false);
    });
  }, [dataUserId]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([getLeaderboard(selected), getTeams(selected)]).then(([lb, teams]) => {
      const map = Object.fromEntries(teams.map(t => [t.id, t]));
      setTeamMap(map);
      setEntries(lb.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf));
      setLoading(false);
    });
  }, [selected]);

  // Group by pool
  const pools = [...new Set(entries.map(e => e.poolId).filter(Boolean))].sort();
  const grouped = pools.length
    ? Object.fromEntries(pools.map(p => [p, entries.filter(e => e.poolId === p)]))
    : { Overall: entries };

  const rankIcon = [
    <Trophy size={14} className="text-amber-400" />,
    <Medal  size={14} className="text-gray-400" />,
    <Medal  size={14} className="text-amber-700" />,
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Leaderboard</h1>
          <p className="text-[var(--text-3)] text-sm">Real-time standings based on match results.</p>
        </div>
        <select
          className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">Select tournament</option>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No standings yet"
          description="Complete some matches to see the leaderboard update automatically."
        />
      ) : (
        Object.entries(grouped).map(([pool, poolEntries]) => (
          <div key={pool}>
            {pools.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="pool">{pool}</Badge>
                <span className="text-sm text-[var(--text-3)]">{poolEntries.length} teams</span>
              </div>
            )}
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      {['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] ${h === 'Team' ? 'text-left' : 'text-center'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poolEntries.map((entry, idx) => {
                      const team = teamMap[entry.teamId];
                      return (
                        <tr key={entry.id} className={`border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-2)] ${idx === 0 ? 'bg-[var(--accent)]/5' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center">
                              {idx < 3 ? rankIcon[idx] : <span className="text-[var(--text-3)] font-medium">{idx + 1}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${idx === 0 ? 'text-[var(--accent)]' : 'text-[var(--text-1)]'}`}>
                              {team?.name ?? entry.teamId}
                            </span>
                          </td>
                          {[entry.played, entry.won, entry.drawn, entry.lost, entry.gf, entry.ga, entry.gd].map((v, i) => (
                            <td key={i} className="px-4 py-3 text-center text-[var(--text-2)]">{v ?? 0}</td>
                          ))}
                          <td className="px-4 py-3 text-center">
                            <span className="font-display font-bold text-[var(--text-1)]">{entry.points ?? 0}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

// src/components/leaderboard/LeaderboardPage.jsx

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Trophy, Medal, FileDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getLeaderboard, getTeams, getMatches } from '../../firebase/firestore';
import { exportLeaderboardToExcel, exportLeaderboardToPDF } from '../../utils/exportUtils';
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
  const [viewMode,    setViewMode]    = useState('pools'); // 'pools' or knockout stage name
  const [matches,     setMatches]     = useState([]);

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
    Promise.all([getLeaderboard(selected), getTeams(selected), getMatches(selected)]).then(([lb, teams, allMatches]) => {
      const map = Object.fromEntries(teams.map(t => [t.id, t]));
      setTeamMap(map);
      setEntries(lb.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf));
      setMatches(allMatches);
      setLoading(false);
    });
  }, [selected]);

  // Group by pool
  const pools = [...new Set(entries.map(e => e.poolId).filter(Boolean))].sort();
  const grouped = pools.length
    ? Object.fromEntries(pools.map(p => [p, entries.filter(e => e.poolId === p)]))
    : { Overall: entries };

  // Get knockout stage matches
  const koMatches = matches.filter(m => m.type === 'knockout');
  const hasQF = koMatches.some(m => m.stage === 'QF');
  const hasSF = koMatches.some(m => m.stage === 'SF');
  const hasFinal = koMatches.some(m => m.stage === 'Final');
  const hasThirdFourth = koMatches.some(m => m.stage === 'ThirdFourth');

  // Calculate knockout standings
  function getKnockoutStandings(stage) {
    const stageMatches = koMatches.filter(m => m.stage === stage);
    const standings = [];
    
    stageMatches.forEach(match => {
      if (match.status !== 'completed') return;
      
      // Determine winner
      let winnerId = null;
      if (Number(match.scoreA) > Number(match.scoreB)) {
        winnerId = match.teamAId;
      } else if (Number(match.scoreB) > Number(match.scoreA)) {
        winnerId = match.teamBId;
      }
      
      if (winnerId) {
        const teamName = teamMap[winnerId]?.name || '';
        const teamAName = teamMap[match.teamAId]?.name || match.teamAName || 'Unknown';
        const teamBName = teamMap[match.teamBId]?.name || match.teamBName || 'Unknown';
        
        let entry = standings.find(s => s.teamId === winnerId);
        if (!entry) {
          entry = {
            teamId: winnerId,
            matchNumber: match.matchNumber,
            matchResult: `${teamAName} ${match.scoreA} - ${match.scoreB} ${teamBName}`
          };
          standings.push(entry);
        }
      }
    });
    
    return standings.sort((a, b) => a.matchNumber - b.matchNumber);
  }

  // Get Final standings with runner-up
  function getFinalStandings() {
    const finalMatches = koMatches.filter(m => m.stage === 'Final' && m.status === 'completed');
    const standings = [];
    
    finalMatches.forEach(match => {
      const teamAName = teamMap[match.teamAId]?.name || match.teamAName || 'Unknown';
      const teamBName = teamMap[match.teamBId]?.name || match.teamBName || 'Unknown';
      
      let winnerId = null;
      let runnerId = null;
      
      if (Number(match.scoreA) > Number(match.scoreB)) {
        winnerId = match.teamAId;
        runnerId = match.teamBId;
      } else if (Number(match.scoreB) > Number(match.scoreA)) {
        winnerId = match.teamBId;
        runnerId = match.teamAId;
      }
      
      if (winnerId) {
        standings.push({
          teamId: winnerId,
          position: 'Winner',
          matchResult: `${teamAName} ${match.scoreA} - ${match.scoreB} ${teamBName}`
        });
      }
      if (runnerId) {
        standings.push({
          teamId: runnerId,
          position: 'Runner',
          matchResult: `${teamAName} ${match.scoreA} - ${match.scoreB} ${teamBName}`
        });
      }
    });
    
    return standings;
  }

  // Get Third & Fourth standings
  function getThirdFourthStandings() {
    const t3f4Matches = koMatches.filter(m => m.stage === 'ThirdFourth');
    const standings = [];
    
    t3f4Matches.forEach(match => {
      if (match.status !== 'completed') return;
      
      let winnerId = null;
      let runnerId = null;
      
      if (Number(match.scoreA) > Number(match.scoreB)) {
        winnerId = match.teamAId;
        runnerId = match.teamBId;
      } else if (Number(match.scoreB) > Number(match.scoreA)) {
        winnerId = match.teamBId;
        runnerId = match.teamAId;
      }
      
      const teamAName = teamMap[match.teamAId]?.name || match.teamAName || 'Unknown';
      const teamBName = teamMap[match.teamBId]?.name || match.teamBName || 'Unknown';
      
      if (winnerId) {
        standings.push({
          teamId: winnerId,
          position: 'Third',
          matchResult: `${teamAName} ${match.scoreA} - ${match.scoreB} ${teamBName}`
        });
      }
      if (runnerId) {
        standings.push({
          teamId: runnerId,
          position: 'Fourth',
          matchResult: `${teamAName} ${match.scoreA} - ${match.scoreB} ${teamBName}`
        });
      }
    });
    
    return standings;
  }

  // Export handlers
  async function handleExportExcel() {
    try {
      const tournament = tournaments.find(t => t.id === selected);
      await exportLeaderboardToExcel(entries, Object.values(teamMap), pools, tournament?.name || 'Tournament');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export to Excel: ' + err.message);
    }
  }

  async function handleExportPDF() {
    try {
      const tournament = tournaments.find(t => t.id === selected);
      await exportLeaderboardToPDF(tournament?.name || 'Tournament');
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Leaderboard</h1>
          <p className="text-[var(--text-3)] text-sm">Real-time standings based on match results.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-sm font-medium transition-all flex items-center gap-2"
            title="Export leaderboard to Excel"
          >
            <FileDown size={16} />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 text-sm font-medium transition-all flex items-center gap-2"
            title="Export leaderboard to PDF"
          >
            <FileDown size={16} />
            Export PDF
          </button>
          <select
            className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
            value={selected}
            onChange={e => setSelected(e.target.value)}
          >
            <option value="">Select tournament</option>
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* View Mode Tabs */}
      {(pools.length > 0 || koMatches.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('pools')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'pools' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}`}
          >
            Pool Standings
          </button>
          {hasQF && (
            <button
              onClick={() => setViewMode('QF')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'QF' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}`}
            >
              Quarter Finals
            </button>
          )}
          {hasSF && (
            <button
              onClick={() => setViewMode('SF')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'SF' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}`}
            >
              Semi Finals
            </button>
          )}
          {hasFinal && (
            <button
              onClick={() => setViewMode('Final')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'Final' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}`}
            >
              Final
            </button>
          )}
          {hasThirdFourth && (
            <button
              onClick={() => setViewMode('ThirdFourth')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'ThirdFourth' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}`}
            >
              Third & Fourth
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No standings yet"
          description="Complete some matches to see the leaderboard update automatically."
        />
      ) : viewMode === 'pools' ? (
        // Pool Standings View
        Object.entries(grouped).map(([pool, poolEntries]) => {
          const rankIcon = [
            <Trophy size={14} className="text-amber-400" />,
            <Medal  size={14} className="text-gray-400" />,
            <Medal  size={14} className="text-amber-700" />,
          ];
          return (
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
          );
        })
      ) : (
        // Knockout Stage View
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="knockout">
              {viewMode === 'QF' ? 'Quarter Finals' : viewMode === 'SF' ? 'Semi Finals' : viewMode === 'Final' ? 'Final' : 'Third & Fourth'}
            </Badge>
          </div>
          {(() => {
            let koStandings = [];
            if (viewMode === 'Final') {
              koStandings = getFinalStandings();
            } else if (viewMode === 'ThirdFourth') {
              koStandings = getThirdFourthStandings();
            } else {
              koStandings = getKnockoutStandings(viewMode);
            }

            const rankIcon = [
              <Trophy size={20} className="text-amber-400" />,
              <Medal  size={20} className="text-gray-400" />,
              <Medal  size={20} className="text-amber-700" />,
            ];

            return koStandings.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No matches completed yet"
                description={`Complete ${viewMode === 'Final' ? 'Final' : viewMode === 'ThirdFourth' ? 'Third & Fourth' : viewMode} matches to see the results.`}
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="space-y-3 p-4">
                  {koStandings.map((entry, idx) => {
                    const team = teamMap[entry.teamId];
                    const getBadgeText = () => {
                      if (viewMode === 'Final') return entry.position;
                      if (viewMode === 'ThirdFourth') return entry.position;
                      return `Q${idx + 1}`;
                    };
                    const getBadgeVariant = () => {
                      if (entry.position === 'Winner') return 'success';
                      if (entry.position === 'Runner') return 'secondary';
                      if (entry.position === 'Third') return 'info';
                      if (entry.position === 'Fourth') return 'secondary';
                      return 'success';
                    };

                    return (
                      <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition">
                        <div className="flex items-center justify-center flex-shrink-0">
                          {(viewMode !== 'Final' && viewMode !== 'ThirdFourth' && idx < 3) ? rankIcon[idx] : (
                            entry.position === 'Winner' ? rankIcon[0] :
                            entry.position === 'Runner' ? rankIcon[1] :
                            entry.position === 'Third' ? rankIcon[2] :
                            <span className="text-[var(--text-3)] font-medium">{entry.position}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[var(--text-1)]">
                            {team?.name ?? entry.teamId}
                          </p>
                          <p className="text-xs text-[var(--text-3)]">{entry.matchResult}</p>
                        </div>
                        <Badge variant={getBadgeVariant()}>{getBadgeText()}</Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Hidden section for PDF export */}
      <div id="leaderboard-export-section" style={{ display: 'none' }} className="p-8 bg-white text-black">
        <h1 className="text-3xl font-bold mb-6">{tournaments.find(t => t.id === selected)?.name} - Leaderboard Report</h1>
        
        {/* Pool Standings */}
        {pools.length > 0 && viewMode === 'pools' && (
          <div className="space-y-8">
            {pools.map(pool => {
              const poolData = grouped[pool] || [];
              return (
                <div key={pool} className="mb-8 page-break">
                  <h2 className="text-2xl font-bold mb-4">Pool {pool}</h2>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left">Rank</th>
                        <th className="border border-gray-300 px-3 py-2 text-left">Team</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">P</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">W</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">D</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">L</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">GF</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">GA</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">GD</th>
                        <th className="border border-gray-300 px-3 py-2 text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolData.map((entry, idx) => (
                        <tr key={entry.teamId}>
                          <td className="border border-gray-300 px-3 py-2 font-bold">{idx + 1}</td>
                          <td className="border border-gray-300 px-3 py-2">{teamMap[entry.teamId]?.name || '-'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{entry.played || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{entry.won || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{entry.drawn || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{entry.lost || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{entry.gf || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{entry.ga || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center font-semibold">{entry.gd || 0}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center font-bold">{entry.points || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Knockout Standings */}
        {viewMode !== 'pools' && (
          <div className="page-break">
            <h2 className="text-2xl font-bold mb-4">
              {viewMode === 'QF' && 'Quarter Finals'}{viewMode === 'SF' && 'Semi Finals'}{viewMode === 'Final' && 'Final'}{viewMode === 'ThirdFourth' && 'Third & Fourth Place'}
              Standings
            </h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left">Position</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Team</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Match Result</th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'Final' ? getFinalStandings().map((entry, idx) => (
                  <tr key={entry.teamId}>
                    <td className="border border-gray-300 px-3 py-2 font-bold">{entry.position}</td>
                    <td className="border border-gray-300 px-3 py-2">{teamMap[entry.teamId]?.name || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{entry.matchResult}</td>
                  </tr>
                )) : viewMode === 'ThirdFourth' ? getThirdFourthStandings().map((entry, idx) => (
                  <tr key={entry.teamId}>
                    <td className="border border-gray-300 px-3 py-2 font-bold">{entry.position}</td>
                    <td className="border border-gray-300 px-3 py-2">{teamMap[entry.teamId]?.name || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{entry.matchResult}</td>
                  </tr>
                )) : getKnockoutStandings(viewMode).map((entry, idx) => (
                  <tr key={entry.teamId}>
                    <td className="border border-gray-300 px-3 py-2 font-bold">Q{idx + 1}</td>
                    <td className="border border-gray-300 px-3 py-2">{teamMap[entry.teamId]?.name || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{entry.matchResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// src/components/fixtures/FixturesPage.jsx
// ─────────────────────────────────────────────────────────────
// Visual fixture browser — pool rounds with match numbers
// and knockout bracket qualified from leaderboard standings.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Filter, ChevronDown, Trash2, Zap, FileDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getMatches, getTeams, getLeaderboard, saveMatches, deleteMatch, updateTeam } from '../../firebase/firestore';
import { buildPoolMatches, buildKnockoutMatches } from '../../utils/fixtureGenerator';
import { exportFixturesToExcel, exportFixturesToPDF } from '../../utils/exportUtils';
import { Card, Badge, Spinner, EmptyState, Button } from '../ui';

export default function FixturesPage() {
  const { dataUserId } = useAuth();
  const navigate = useNavigate();

  const [tournaments,  setTournaments]  = useState([]);
  const [selected,     setSelected]     = useState('');
  const [matches,      setMatches]      = useState([]);
  const [teamMap,      setTeamMap]      = useState({});
  const [leaderboard,  setLeaderboard]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterPool,   setFilterPool]   = useState('all');
  const [filterRound,  setFilterRound]  = useState('all');
  const [tournament,   setTournament]   = useState(null);
  const [knockoutsGenerated, setKnockoutsGenerated] = useState(false);
  
  // Knockout generation state
  const [generationStage, setGenerationStage] = useState(null); // QF, SF, Final, ThirdFourth
  const [generationMode, setGenerationMode] = useState(null); // auto, manual
  const [selectedTeams, setSelectedTeams] = useState({}); // {match1: [teamA, teamB], ...}
  const [enableThirdFourth, setEnableThirdFourth] = useState(false); // Checkbox for optional T3F4
  const [genLoading, setGenLoading] = useState(false); // Loading state for fixture generation

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
    setFilterRound('all');
    setKnockoutsGenerated(false);
    Promise.all([
      getTournaments(dataUserId).then(ts => ts.find(t => t.id === selected)),
      getMatches(selected),
      getTeams(selected),
      getLeaderboard(selected),
    ]).then(([t, ms, teams, lb]) => {
      setTournament(t);
      setMatches(ms);
      setTeamMap(Object.fromEntries(teams.map(tm => [tm.id, tm])));
      setLeaderboard(lb);
      setLoading(false);
    });
  }, [selected, dataUserId]);

  // Generate pool fixtures from teams
  async function generateFixtures() {
    if (!tournament) return;
    if (!confirm('Generate fixtures? This will create all matches for this tournament.')) return;
    setGenLoading(true);

    try {
      const teamIds = Object.keys(teamMap);
      let newMatches = [];

      if (tournament.tournamentType === 'pool') {
        // Use existing pool assignments instead of recalculating
        const teamPoolMap = {};
        
        // First, map teams that already have pool assignments
        Object.values(teamMap).forEach(team => {
          if (team.pool) {
            teamPoolMap[team.id] = team.pool;
          }
        });

        // Get all pools that have teams
        const assignedPools = [...new Set(Object.values(teamPoolMap))];
        
        // If no pools are assigned, calculate and assign
        if (assignedPools.length === 0) {
          const nPools = tournament.numPools || 2;
          const base = Math.floor(teamIds.length / nPools);
          const rem = teamIds.length % nPools;
          const poolSizes = Array(nPools).fill(base).map((v, i) => i < rem ? v + 1 : v);

          let teamIndex = 0;
          for (let poolIdx = 0; poolIdx < nPools; poolIdx++) {
            const poolLetter = String.fromCharCode(65 + poolIdx);
            const poolSize = poolSizes[poolIdx];
            
            for (let j = 0; j < poolSize && teamIndex < teamIds.length; j++) {
              const teamId = teamIds[teamIndex];
              teamPoolMap[teamId] = poolLetter;
              await updateTeam(teamId, { pool: poolLetter });
              teamIndex++;
            }
          }
        }

        // Generate round-robin matches for each pool
        const allPoolMatches = [];
        
        // Get unique pool letters from assigned pools
        const uniquePools = [...new Set(Object.values(teamPoolMap))].sort();
        
        for (const poolLetter of uniquePools) {
          // Get teams in this pool from our mapping
          const poolTeamIds = Object.entries(teamPoolMap)
            .filter(([_, pool]) => pool === poolLetter)
            .map(([teamId, _]) => teamId);
          
          if (poolTeamIds.length < 2) continue;
          
          const ms = buildPoolMatches(selected, dataUserId, `Pool ${poolLetter}`, poolTeamIds, teamMap);
          
          // Add stage and poolId info
          ms.forEach(m => {
            m.stage = 'pool';
            m.poolId = `Pool ${poolLetter}`;
          });
          
          allPoolMatches.push({ poolLetter, matches: ms });
        }

        // Interleave matches: 1st match from Pool A, 1st match from Pool B, etc.
        let matchNo = 1;
        
        if (allPoolMatches.length > 0) {
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
      } else {
        // Knockout from start
        const koMatches = buildKnockoutMatches(selected, dataUserId, teamIds, {
          includeQF: tournament.includeQF,
          includeSF: tournament.includeSF,
          includeFinal: tournament.includeFinal,
        });
        
        let matchNo = 1;
        koMatches.forEach(m => {
          m.matchNumber = matchNo++;
        });
        
        newMatches = koMatches;
      }

      if (newMatches.length > 0) {
        await saveMatches(newMatches);
      }

      // Refresh matches
      const freshMatches = await getMatches(selected);
      setMatches(freshMatches);
      setGenLoading(false);
      alert('Fixtures generated successfully!');
    } catch (err) {
      console.error('Error generating fixtures:', err);
      alert('Failed to generate fixtures: ' + err.message);
      setGenLoading(false);
    }
  }

  // Auto-generate knockout matches based on leaderboard standings (only if they don't exist yet)
  // REMOVED - Now using individual buttons for QF, SF, Final generation

  // Helper function to get qualified teams from current leaderboard
  function getQualifiedTeams() {
    const poolMatches = matches.filter(m => m.type === 'pool');
    if (poolMatches.length === 0 || leaderboard.length === 0) return [];

    const pools = [...new Set(poolMatches.map(m => m.poolId).filter(Boolean))].sort();
    const qualifiedTeams = [];

    pools.forEach(pool => {
      const poolMatches_ = poolMatches.filter(m => m.poolId === pool);
      const poolTeamIds = poolMatches_
        .map(m => [m.teamAId, m.teamBId])
        .flat()
        .filter((v, i, a) => a.indexOf(v) === i);

      if (poolTeamIds.length < 1) return;

      const poolStandings = poolTeamIds
        .map(teamId => {
          const entry = leaderboard.find(lb => lb.teamId === teamId);
          return { teamId, ...entry };
        })
        .filter(v => v && v.teamId)
        .sort((a, b) => {
          const pointsA = (a.points || 0);
          const pointsB = (b.points || 0);
          if (pointsA !== pointsB) return pointsB - pointsA;
          const gdA = (a.gd || 0);
          const gdB = (b.gd || 0);
          if (gdA !== gdB) return gdB - gdA;
          return (b.gf || 0) - (a.gf || 0);
        });

      if (poolStandings[0]) qualifiedTeams.push(poolStandings[0].teamId);
      if (poolStandings[1]) qualifiedTeams.push(poolStandings[1].teamId);
    });

    return qualifiedTeams;
  }

  // Check if all pool matches are completed
  function arePoolMatchesCompleted() {
    const poolMatches = matches.filter(m => m.type === 'pool');
    if (poolMatches.length === 0) return false;
    return poolMatches.every(m => m.status === 'completed');
  }

  // Generate Quarter Finals
  function openQFGenerationModal() {
    setGenerationStage('QF');
    setGenerationMode(null);
    setSelectedTeams({});
  }

  // Generate Semi-Finals
  function openSFGenerationModal() {
    setGenerationStage('SF');
    setGenerationMode(null);
    setSelectedTeams({});
  }

  // Generate Final
  function openFinalGenerationModal() {
    setGenerationStage('Final');
    setGenerationMode(null);
    setSelectedTeams({});
  }

  // Generate Third & Fourth
  function openThirdFourthGenerationModal() {
    setGenerationStage('ThirdFourth');
    setGenerationMode(null);
    setSelectedTeams({});
  }

  // Auto generation logic
  async function executeAutoGeneration() {
    // Check if required stage is completed
    let stageCompleted = true;
    let messagePrefix = '';

    if (generationStage === 'QF') {
      stageCompleted = arePoolMatchesCompleted();
      messagePrefix = 'pool matches';
    } else if (generationStage === 'SF') {
      const qfMatches = matches.filter(m => m.type === 'knockout' && m.stage === 'QF');
      stageCompleted = qfMatches.length > 0 && qfMatches.every(m => m.status === 'completed');
      messagePrefix = 'Quarter Final matches';
    } else if (generationStage === 'Final') {
      const sfMatches = matches.filter(m => m.type === 'knockout' && m.stage === 'SF');
      stageCompleted = sfMatches.length > 0 && sfMatches.every(m => m.status === 'completed');
      messagePrefix = 'Semi Final matches';
    } else if (generationStage === 'ThirdFourth') {
      const sfMatches = matches.filter(m => m.type === 'knockout' && m.stage === 'SF');
      stageCompleted = sfMatches.length > 0 && sfMatches.every(m => m.status === 'completed');
      messagePrefix = 'Semi Final matches';
    }

    if (!stageCompleted) {
      if (!confirm(`Not all ${messagePrefix} are completed. Are you sure you want to generate?`)) return;
    }

    try {
      // Get teams based on stage
      let qualifiedTeams;
      if (generationStage === 'QF') {
        qualifiedTeams = getQualifiedTeams();
      } else if (generationStage === 'SF') {
        qualifiedTeams = getKnockoutWinners('QF');
      } else if (generationStage === 'Final') {
        qualifiedTeams = getKnockoutWinners('SF');
      } else {
        qualifiedTeams = [];
      }

      let requiredTeams = 0;
      if (generationStage === 'QF') {
        requiredTeams = 8;
      } else if (generationStage === 'SF') {
        requiredTeams = 4;
      } else if (generationStage === 'Final') {
        requiredTeams = 2;
      }

      if (qualifiedTeams.length < requiredTeams) {
        alert(`Need at least ${requiredTeams} qualified teams. Currently have ${qualifiedTeams.length} teams.`);
        return;
      }

      const poolMatches = matches.filter(m => m.type === 'pool');
      const maxMatchNo = Math.max(...poolMatches.map(m => m.matchNumber || 0), 0);

      let koMatches;
      if (generationStage === 'QF') {
        koMatches = buildKnockoutMatches(selected, dataUserId, qualifiedTeams, {
          includeQF: true,
          includeSF: false,
          includeFinal: false,
        });
      } else if (generationStage === 'SF') {
        koMatches = buildKnockoutMatches(selected, dataUserId, qualifiedTeams, {
          includeQF: false,
          includeSF: true,
          includeFinal: false,
        });
      } else if (generationStage === 'Final') {
        koMatches = buildKnockoutMatches(selected, dataUserId, qualifiedTeams, {
          includeQF: false,
          includeSF: false,
          includeFinal: true,
        });
      } else if (generationStage === 'ThirdFourth') {
        // Auto pair SF losers
        const sfLosers = getSFLosers();
        koMatches = [];
        if (sfLosers.length === 2) {
          koMatches.push({
            tournamentId: selected,
            mainUserId: dataUserId,
            type: 'knockout',
            stage: 'ThirdFourth',
            teamAId: sfLosers[0],
            teamBId: sfLosers[1],
            teamAName: teamMap[sfLosers[0]]?.name || '',
            teamBName: teamMap[sfLosers[1]]?.name || '',
            scoreA: null,
            scoreB: null,
            status: 'upcoming',
            scheduledAt: null,
            winnerId: null,
          });
        }
      }

      let matchNo = maxMatchNo + 1;
      koMatches.forEach(m => {
        m.matchNumber = matchNo++;
      });

      await saveMatches(koMatches);
      const freshMatches = await getMatches(selected);
      setMatches(freshMatches);
      closeGenerationModal();
    } catch (err) {
      console.error('Error generating:', err);
      alert('Failed to generate: ' + err.message);
    }
  }

  // Manual generation logic
  async function executeManualGeneration() {
    try {
      const poolMatches = matches.filter(m => m.type === 'pool');
      const maxMatchNo = Math.max(...poolMatches.map(m => m.matchNumber || 0), 0);

      // Create matches from selected teams
      const koMatches = [];
      let matchNo = maxMatchNo + 1;

      if (generationStage === 'QF') {
        for (let i = 0; i < 4; i++) {
          const [teamAId, teamBId] = selectedTeams[`qf_${i}`] || [null, null];
          koMatches.push({
            tournamentId: selected,
            mainUserId: dataUserId,
            type: 'knockout',
            stage: 'QF',
            matchNumber: matchNo++,
            teamAId,
            teamBId,
            teamAName: teamMap[teamAId]?.name || '',
            teamBName: teamMap[teamBId]?.name || '',
            scoreA: null,
            scoreB: null,
            status: 'upcoming',
            scheduledAt: null,
            winnerId: null,
          });
        }
      } else if (generationStage === 'SF') {
        for (let i = 0; i < 2; i++) {
          const [teamAId, teamBId] = selectedTeams[`sf_${i}`] || [null, null];
          koMatches.push({
            tournamentId: selected,
            mainUserId: dataUserId,
            type: 'knockout',
            stage: 'SF',
            matchNumber: matchNo++,
            teamAId,
            teamBId,
            teamAName: teamMap[teamAId]?.name || '',
            teamBName: teamMap[teamBId]?.name || '',
            scoreA: null,
            scoreB: null,
            status: 'upcoming',
            scheduledAt: null,
            winnerId: null,
          });
        }
      } else if (generationStage === 'Final') {
        const [teamAId, teamBId] = selectedTeams['final_0'] || [null, null];
        koMatches.push({
          tournamentId: selected,
          mainUserId: dataUserId,
          type: 'knockout',
          stage: 'Final',
          matchNumber: matchNo++,
          teamAId,
          teamBId,
          teamAName: teamMap[teamAId]?.name || '',
          teamBName: teamMap[teamBId]?.name || '',
          scoreA: null,
          scoreB: null,
          status: 'upcoming',
          scheduledAt: null,
          winnerId: null,
        });
      } else if (generationStage === 'ThirdFourth') {
        const [teamAId, teamBId] = selectedTeams['t3f4_0'] || [null, null];
        koMatches.push({
          tournamentId: selected,
          mainUserId: dataUserId,
          type: 'knockout',
          stage: 'ThirdFourth',
          matchNumber: matchNo++,
          teamAId,
          teamBId,
          teamAName: teamMap[teamAId]?.name || '',
          teamBName: teamMap[teamBId]?.name || '',
          scoreA: null,
          scoreB: null,
          status: 'upcoming',
          scheduledAt: null,
          winnerId: null,
        });
      }

      await saveMatches(koMatches);
      const freshMatches = await getMatches(selected);
      setMatches(freshMatches);
      closeGenerationModal();
    } catch (err) {
      console.error('Error generating:', err);
      alert('Failed to generate: ' + err.message);
    }
  }

  function closeGenerationModal() {
    setGenerationStage(null);
    setGenerationMode(null);
    setSelectedTeams({});
  }

  // Get available teams (qualified teams from leaderboard)
  function getAvailableTeamsForSelection() {
    if (generationStage === 'QF') {
      // QF: Get top 2 teams from each pool
      return getQualifiedTeams();
    } else if (generationStage === 'SF') {
      // SF: Get all winners from QF matches
      return getKnockoutWinners('QF');
    } else if (generationStage === 'Final') {
      // Final: Get all winners from SF matches
      return getKnockoutWinners('SF');
    } else if (generationStage === 'ThirdFourth') {
      // Third & Fourth: Get all losers from SF matches
      return getSFLosers();
    }
    return [];
  }

  // Get winners from a specific knockout stage
  function getKnockoutWinners(stage) {
    const stageMatches = matches.filter(m => m.type === 'knockout' && m.stage === stage && m.status === 'completed');
    const winners = [];
    
    stageMatches.forEach(match => {
      let winnerId = null;
      if (Number(match.scoreA) > Number(match.scoreB)) {
        winnerId = match.teamAId;
      } else if (Number(match.scoreB) > Number(match.scoreA)) {
        winnerId = match.teamBId;
      }
      if (winnerId && !winners.includes(winnerId)) {
        winners.push(winnerId);
      }
    });
    
    return winners.sort((a, b) => {
      const matchA = stageMatches.find(m => m.teamAId === a || m.teamBId === a);
      const matchB = stageMatches.find(m => m.teamAId === b || m.teamBId === b);
      return (matchA?.matchNumber || 0) - (matchB?.matchNumber || 0);
    });
  }

  // Get losers from Semi-Finals
  function getSFLosers() {
    const sfMatches = matches.filter(m => m.type === 'knockout' && m.stage === 'SF' && m.status === 'completed');
    const losers = [];
    
    sfMatches.forEach(match => {
      let loserId = null;
      if (Number(match.scoreA) > Number(match.scoreB)) {
        loserId = match.teamBId;
      } else if (Number(match.scoreB) > Number(match.scoreA)) {
        loserId = match.teamAId;
      }
      if (loserId && !losers.includes(loserId)) {
        losers.push(loserId);
      }
    });
    
    return losers.sort((a, b) => {
      const matchA = sfMatches.find(m => m.teamAId === a || m.teamBId === a);
      const matchB = sfMatches.find(m => m.teamAId === b || m.teamBId === b);
      return (matchA?.matchNumber || 0) - (matchB?.matchNumber || 0);
    });
  }

  const pools   = [...new Set(matches.filter(m => m.type === 'pool').map(m => m.poolId).filter(Boolean))].sort();
  const rounds  = [...new Set(matches.filter(m => m.type === 'pool').map(m => m.round).filter(Boolean))].sort((a, b) => a - b);

  // Filter matches
  const poolMatches = matches.filter(m => m.type === 'pool').filter(m => {
    if (filterPool !== 'all' && m.poolId !== filterPool) return false;
    if (filterRound !== 'all' && m.round !== parseInt(filterRound)) return false;
    return true;
  }).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  const knockoutMatches = matches.filter(m => m.type === 'knockout').sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  // Handle fixture deletion
  async function handleDeleteMatch(matchId) {
    if (!confirm('Remove this fixture? This action cannot be undone.')) return;
    
    try {
      await deleteMatch(matchId);
      setMatches(prev => prev.filter(m => m.id !== matchId));
    } catch (err) {
      console.error('Error deleting match:', err);
      alert('Failed to delete fixture: ' + err.message);
    }
  }

  // Handle delete all fixtures
  async function handleDeleteAllFixtures() {
    if (!confirm('Delete ALL fixtures for this tournament? This action cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? This will permanently remove all matches.')) return;
    
    try {
      // Delete all matches for this tournament
      await Promise.all(matches.map(m => deleteMatch(m.id)));
      setMatches([]);
      setKnockoutsGenerated(false);
    } catch (err) {
      console.error('Error deleting all fixtures:', err);
      alert('Failed to delete fixtures: ' + err.message);
    }
  }

  // Handle export to Excel
  async function handleExportExcel() {
    try {
      await exportFixturesToExcel(matches, Object.values(teamMap), tournament?.name || 'Tournament');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export to Excel: ' + err.message);
    }
  }

  // Handle export to PDF
  async function handleExportPDF() {
    try {
      await exportFixturesToPDF(tournament?.name || 'Tournament');
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      alert('Failed to export to PDF: ' + err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Fixtures</h1>
          <p className="text-[var(--text-3)] text-sm mt-0.5">
            {tournament?.name} · {matches.length} total matches
          </p>
        </div>
        {matches.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-sm font-medium transition-all flex items-center gap-2"
              title="Export fixtures to Excel"
            >
              <FileDown size={16} />
              Export Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 text-sm font-medium transition-all flex items-center gap-2"
              title="Export fixtures to PDF"
            >
              <FileDown size={16} />
              Export PDF
            </button>
            <button
              onClick={handleDeleteAllFixtures}
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 text-sm font-medium transition-all"
            >
              <Trash2 size={16} className="inline mr-2" />
              Delete All Fixtures
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Filters</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tournament selector */}
          <div>
            <label className="text-xs text-[var(--text-3)] mb-1 block">Tournament</label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              <option value="">Select tournament</option>
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Pool filter */}
          {pools.length > 0 && (
            <div>
              <label className="text-xs text-[var(--text-3)] mb-1 block">Pool</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
                value={filterPool}
                onChange={e => setFilterPool(e.target.value)}
              >
                <option value="all">All Pools</option>
                {pools.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* Round filter */}
          {rounds.length > 0 && (
            <div>
              <label className="text-xs text-[var(--text-3)] mb-1 block">Round</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)]"
                value={filterRound}
                onChange={e => setFilterRound(e.target.value)}
              >
                <option value="all">All Rounds</option>
                {rounds.map(r => <option key={r} value={r}>Round {r}</option>)}
              </select>
            </div>
          )}

          {/* Reset button */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterPool('all');
                setFilterRound('all');
              }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--accent)] text-sm font-medium transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : matches.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <Calendar size={40} className="mx-auto text-[var(--text-3)]" />
          <div>
            <p className="text-[var(--text-2)] font-medium">No fixtures yet</p>
            <p className="text-[var(--text-3)] text-sm">Generate fixtures from a tournament to view them here.</p>
          </div>
          {selected && (
            <Button onClick={() => generateFixtures()} disabled={genLoading}>
              <Zap size={16} /> {genLoading ? 'Generating...' : 'Generate Fixtures'}
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Pool Matches */}
          {pools.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-[var(--text-1)]">Pool Matches</h2>
              {pools.map(pool => (
                <div key={pool}>
                  <h3 className="font-display font-semibold text-[var(--text-1)] mb-4 flex items-center gap-2">
                    <Badge variant="pool">{pool}</Badge>
                    <span className="text-sm text-[var(--text-3)] font-normal">
                      {matches.filter(m => m.poolId === pool && m.type === 'pool').length} matches
                    </span>
                  </h3>

                  {/* Rounds within pool */}
                  <div className="space-y-4">
                    {rounds.map(round => {
                      const roundMatches = poolMatches
                        .filter(m => m.poolId === pool && m.round === round)
                        .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
                      
                      if (roundMatches.length === 0) return null;
                      
                      return (
                        <div key={`${pool}-R${round}`}>
                          <p className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider mb-2">
                            Round {round}
                          </p>
                          <div className="space-y-2">
                            {roundMatches.map(m => (
                              <FixtureCard key={m.id} match={m} teamMap={teamMap} onDelete={handleDeleteMatch} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Knockout Generation Buttons */}
          {pools.length > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-display font-semibold text-[var(--text-1)] mb-2">Generate Knockout Stages</h3>
                <p className="text-xs text-[var(--text-3)] mb-4">
                  Based on <strong>current leaderboard standings</strong>, generate knockout matches individually.
                </p>
              </div>

              {/* Conditional checkbox for Third & Fourth */}
              {knockoutMatches.some(m => m.stage === 'SF') && !knockoutMatches.some(m => m.stage === 'ThirdFourth') && (
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                  <input
                    type="checkbox"
                    id="enableThirdFourth"
                    checked={enableThirdFourth}
                    onChange={(e) => setEnableThirdFourth(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="enableThirdFourth" className="text-sm font-medium text-[var(--text-1)] cursor-pointer flex-1">
                    Optional: Generate Third & Fourth Place Match
                  </label>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* QF Button - Always show unless QF already exists */}
                {!knockoutMatches.some(m => m.stage === 'QF') && (
                  <button
                    onClick={openQFGenerationModal}
                    className="px-4 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white text-sm font-medium transition-all"
                  >
                    Generate QF
                  </button>
                )}
                
                {/* SF Button - Show if QF exists but SF doesn't */}
                {knockoutMatches.some(m => m.stage === 'QF') && !knockoutMatches.some(m => m.stage === 'SF') && (
                  <button
                    onClick={openSFGenerationModal}
                    className="px-4 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white text-sm font-medium transition-all"
                  >
                    Generate SF
                  </button>
                )}
                
                {/* Final Button - Show if SF exists but Final doesn't */}
                {knockoutMatches.some(m => m.stage === 'SF') && !knockoutMatches.some(m => m.stage === 'Final') && (
                  <button
                    onClick={openFinalGenerationModal}
                    className="px-4 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white text-sm font-medium transition-all"
                  >
                    Generate Final
                  </button>
                )}

                {/* Third & Fourth Button - Show if checkbox enabled, SF completed, and T3F4 doesn't exist */}
                {enableThirdFourth && knockoutMatches.some(m => m.stage === 'SF') && !knockoutMatches.some(m => m.stage === 'ThirdFourth') && (
                  <button
                    onClick={openThirdFourthGenerationModal}
                    className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-all"
                  >
                    Generate 3rd & 4th
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Knockout Matches */}
          {knockoutMatches.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-[var(--text-1)]">Knockout Stage</h2>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-4">
                <p className="text-xs text-[var(--text-3)]">
                  ℹ️ Qualified teams determined by <strong>Leaderboard standings</strong> — Top 2 teams per pool advance to Quarter Finals
                </p>
              </div>

              {['QF', 'SF', 'Final'].map(stage => {
                const stageMatches = knockoutMatches
                  .filter(m => m.stage === stage)
                  .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
                
                if (stageMatches.length === 0) return null;
                
                const stageLabel = stage === 'QF' ? 'Quarter Finals' : stage === 'SF' ? 'Semi Finals' : 'Final';
                
                return (
                  <div key={stage}>
                    <h3 className="font-display font-semibold text-[var(--text-1)] mb-4">
                      <Badge variant="knockout">{stageLabel}</Badge>
                    </h3>
                    <div className={`space-y-2 ${stage === 'QF' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : ''}`}>
                      {stageMatches.map(m => (
                        <FixtureCard key={m.id} match={m} teamMap={teamMap} knockout onDelete={handleDeleteMatch} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Generation Mode Selection Modal */}
      {generationStage && generationMode === null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-1)]">
              Generate {generationStage === 'QF' ? 'Quarter Finals' : generationStage === 'SF' ? 'Semi-Finals' : generationStage === 'Final' ? 'Final' : 'Third & Fourth Place'}
            </h2>
            <div className="text-sm text-[var(--text-3)] space-y-1">
              <p>Choose how to generate knockout matches:</p>
              {generationStage === 'QF' && <p className="text-xs text-[var(--text-2)]">📋 Using: Pool leaderboard (Top 2 teams per pool)</p>}
              {generationStage === 'SF' && <p className="text-xs text-[var(--text-2)]">📊 Using: Quarter Final winners</p>}
              {generationStage === 'Final' && <p className="text-xs text-[var(--text-2)]">🏆 Using: Semi Final winners</p>}
              {generationStage === 'ThirdFourth' && <p className="text-xs text-[var(--text-2)]">🥉 Using: Semi Final losers</p>}
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setGenerationMode('auto');
                  executeAutoGeneration();
                }}
                className="w-full px-4 py-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 transition text-sm font-medium"
              >
                <span className="font-semibold">Auto</span>
                <p className="text-xs text-blue-400 mt-1">Automatic seeding</p>
              </button>
              
              <button
                onClick={() => setGenerationMode('manual')}
                className="w-full px-4 py-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 transition text-sm font-medium"
              >
                <span className="font-semibold">Manual</span>
                <p className="text-xs text-emerald-400 mt-1">Choose teams for each match</p>
              </button>
            </div>
            
            <button
              onClick={closeGenerationModal}
              className="w-full px-4 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-2)] transition text-sm"
            >
              Cancel
            </button>
          </Card>
        </div>
      )}

      {/* Manual Team Selection Modal */}
      {generationStage && generationMode === 'manual' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--text-1)]">
                Manually Select Teams — {generationStage === 'QF' ? 'Quarter Finals' : generationStage === 'SF' ? 'Semi-Finals' : generationStage === 'Final' ? 'Final' : 'Third & Fourth Place'}
              </h2>
              <p className="text-xs text-[var(--text-3)]">
                {generationStage === 'QF' && '📋 Selecting from: Pool leaderboard (Top 2 teams per pool)'}
                {generationStage === 'SF' && '📊 Selecting from: Quarter Final winners'}
                {generationStage === 'Final' && '🏆 Selecting from: Semi Final winners'}
                {generationStage === 'ThirdFourth' && '🥉 Selecting from: Semi Final losers'}
              </p>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {generationStage === 'QF' && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg bg-[var(--surface-2)] space-y-2">
                  <label className="text-sm font-medium text-[var(--text-2)]">Match {i + 1}</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTeams[`qf_${i}`]?.[0] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams[`qf_${i}`] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          [`qf_${i}`]: [e.target.value, oldB]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team A</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                    <div className="flex items-center text-[var(--text-3)] px-2">VS</div>
                    <select
                      value={selectedTeams[`qf_${i}`]?.[1] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams[`qf_${i}`] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          [`qf_${i}`]: [oldA, e.target.value]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team B</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {generationStage === 'SF' && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg bg-[var(--surface-2)] space-y-2">
                  <label className="text-sm font-medium text-[var(--text-2)]">Match {i + 1}</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTeams[`sf_${i}`]?.[0] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams[`sf_${i}`] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          [`sf_${i}`]: [e.target.value, oldB]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team A</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                    <div className="flex items-center text-[var(--text-3)] px-2">VS</div>
                    <select
                      value={selectedTeams[`sf_${i}`]?.[1] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams[`sf_${i}`] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          [`sf_${i}`]: [oldA, e.target.value]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team B</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {generationStage === 'Final' && (
                <div className="p-4 rounded-lg bg-[var(--surface-2)] space-y-2">
                  <label className="text-sm font-medium text-[var(--text-2)]">Final Match</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTeams['final_0']?.[0] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams['final_0'] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          ['final_0']: [e.target.value, oldB]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team A</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                    <div className="flex items-center text-[var(--text-3)] px-2">VS</div>
                    <select
                      value={selectedTeams['final_0']?.[1] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams['final_0'] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          ['final_0']: [oldA, e.target.value]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team B</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {generationStage === 'ThirdFourth' && (
                <div className="p-4 rounded-lg bg-[var(--surface-2)] space-y-2">
                  <label className="text-sm font-medium text-[var(--text-2)]">Third & Fourth Place Match</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTeams['t3f4_0']?.[0] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams['t3f4_0'] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          ['t3f4_0']: [e.target.value, oldB]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team A</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                    <div className="flex items-center text-[var(--text-3)] px-2">VS</div>
                    <select
                      value={selectedTeams['t3f4_0']?.[1] || ''}
                      onChange={(e) => {
                        const [oldA, oldB] = selectedTeams['t3f4_0'] || [null, null];
                        setSelectedTeams(prev => ({
                          ...prev,
                          ['t3f4_0']: [oldA, e.target.value]
                        }));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-3)] border border-[var(--surface-4)] text-[var(--text-1)] text-sm"
                    >
                      <option value="">Select Team B</option>
                      {getAvailableTeamsForSelection().map(teamId => (
                        <option key={teamId} value={teamId}>{teamMap[teamId]?.name || teamId}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={executeManualGeneration}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition font-medium text-sm"
              >
                Generate
              </button>
              <button
                onClick={closeGenerationModal}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-2)] transition text-sm"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Hidden section for PDF export */}
      <div id="fixtures-export-section" style={{ display: 'none' }} className="p-8 bg-white text-black">
        <h1 className="text-3xl font-bold mb-6">{tournament?.name} - Fixtures Report</h1>
        
        {/* Pool Fixtures */}
        {poolMatches.length > 0 && (
          <div className="mb-8 page-break">
            <h2 className="text-2xl font-bold mb-4">Pool Fixtures</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left">Pool</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Round</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Match #</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Team A</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Score</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Team B</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {poolMatches.map(m => (
                  <tr key={m.id}>
                    <td className="border border-gray-300 px-3 py-2">{m.poolId || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{m.round || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2 font-bold">M{m.matchNumber || '-'}</td>
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
        )}

        {/* Knockout Fixtures */}
        {knockoutMatches.length > 0 && (
          <div className="page-break">
            <h2 className="text-2xl font-bold mb-4">Knockout Fixtures</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left">Stage</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Match #</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Team A</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Score</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Team B</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {knockoutMatches.map(m => (
                  <tr key={m.id}>
                    <td className="border border-gray-300 px-3 py-2 font-semibold">{m.stage || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2 font-bold">M{m.matchNumber || '-'}</td>
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
        )}
      </div>
    </div>
  );
}

// ── Fixture Card Component ─────────────────────────────────────
function FixtureCard({ match, teamMap, knockout, onDelete }) {
  const nameA = match.teamAName ?? teamMap[match.teamAId]?.name ?? '—';
  const nameB = match.teamBName ?? teamMap[match.teamBId]?.name ?? '—';

  const winnerA = match.status === 'completed' && Number(match.scoreA) > Number(match.scoreB);
  const winnerB = match.status === 'completed' && Number(match.scoreB) > Number(match.scoreA);

  return (
    <Card className={`p-4 ${knockout ? 'border-l-4 border-l-rose-500/40' : ''}`}>
      <div className="flex items-center gap-4">
        {/* Match Number */}
        {match.matchNumber && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--accent)]">M{match.matchNumber}</span>
          </div>
        )}

        {/* Pool/Round info */}
        <div className="flex-shrink-0 flex flex-col gap-1">
          {match.poolId && (
            <Badge variant="pool" className="text-xs">{match.poolId}</Badge>
          )}
          {match.round && (
            <span className="text-xs text-[var(--text-3)]">R{match.round}</span>
          )}
        </div>

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

        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={() => onDelete(match.id)}
            className="p-2 rounded-lg text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            title="Remove fixture"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </Card>
  );
}


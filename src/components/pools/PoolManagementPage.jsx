// src/components/pools/PoolManagementPage.jsx
// ─────────────────────────────────────────────────────────────
// Pool Management: manage tournament pools and groups.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Trophy, Users, Trash2, Plus, ArrowRight, X, Check, Download, FileText, Sheet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getTeams, updateTeam, addTeam, deleteTeam, getMatches } from '../../firebase/firestore';
import { Card, Badge, Button, Spinner, Input, Modal } from '../ui';

export default function PoolManagementPage() {
  const { dataUserId, canEdit } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [pools, setPools] = useState([]);
  const [matches, setMatches] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [movingTeam, setMovingTeam] = useState(null);
  const [moveTeamModal, setMoveTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolForTeam, setSelectedPoolForTeam] = useState('A');
  const [addingTeam, setAddingTeam] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const data = await getTournaments(dataUserId);
    setTournaments(data.filter(t => t.tournamentType === 'pool'));
    setLoading(false);
  };

  const handleTournamentSelect = async (tournament) => {
    setSelectedTournament(tournament);
    await loadPoolsData(tournament);
    const tourMatches = await getMatches(tournament.id);
    setMatches(tourMatches);
  };

  const loadPoolsData = async (tournament) => {
    setPoolsLoading(true);
    try {
      const teams = await getTeams(tournament.id);
      
      // Organize teams into pools
      const poolsMap = {};
      teams.forEach(team => {
        const poolName = team.pool || `Pool ${Math.floor((teams.indexOf(team)) / (tournament.teamsPerPool || 4)) + 1}`;
        if (!poolsMap[poolName]) {
          poolsMap[poolName] = [];
        }
        poolsMap[poolName].push(team);
      });

      const poolsArray = Object.entries(poolsMap).map(([name, teamsInPool], index) => ({
        id: index,
        name,
        teams: teamsInPool,
        teamCount: teamsInPool.length,
      }));

      setPools(poolsArray);
    } catch (error) {
      console.error('Error loading pools:', error);
      setPools([]);
    }
    setPoolsLoading(false);
  };

  const handleEditTeam = (team) => {
    setMovingTeam(team);
    setMoveTeamModal(true);
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim() || !selectedTournament) return;
    const tid = await addTeam(selectedTournament.id, dataUserId, { name: newTeamName.trim(), pool: selectedPoolForTeam });
    setNewTeamName('');
    setSelectedPoolForTeam('A');
    setAddingTeam(false);
    await loadPoolsData(selectedTournament);
  };

  const handleDeleteTeam = async (teamId) => {
    if (confirm('Are you sure you want to delete this team?')) {
      await deleteTeam(teamId);
      await loadPoolsData(selectedTournament);
    }
  };

  const handleMoveTeam = (team) => {
    setMovingTeam(team);
    setMoveTeamModal(true);
  };

  const handleMoveTeamToPool = async (targetPoolName) => {
    if (movingTeam) {
      await updateTeam(movingTeam.id, { pool: targetPoolName });
      await loadPoolsData(selectedTournament);
      setMoveTeamModal(false);
      setMovingTeam(null);
    }
  };

  // ── Export Functions ────────────────────────────────────────
  const downloadExcel = () => {
    if (!selectedTournament || pools.length === 0) return;

    // Create proper CSV data for Excel
    let csvContent = [];
    csvContent.push(['Tournament: ' + selectedTournament.name]);
    csvContent.push(['Sport: ' + selectedTournament.sport]);
    csvContent.push(['Total Teams: ' + selectedTournament.numTeams]);
    csvContent.push(['Status: ' + selectedTournament.status]);
    csvContent.push(['Generated: ' + new Date().toLocaleDateString()]);
    csvContent.push([]); // Empty row

    pools.forEach(pool => {
      csvContent.push([pool.name + ' (' + pool.teamCount + ' teams)']);
      csvContent.push(['#', 'Team Name']);
      pool.teams.forEach((team, idx) => {
        csvContent.push([idx + 1, team.name]);
      });
      csvContent.push([]); // Empty row between pools
    });

    // Convert to CSV string
    const csvString = csvContent.map(row => 
      row.map(cell => {
        // Escape cells that contain commas
        if (typeof cell === 'string' && cell.includes(',')) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      }).join(',')
    ).join('\n');

    // Create blob and download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTournament.name}-pools-${new Date().toISOString().split('T')[0]}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!selectedTournament || pools.length === 0) return;

    // Create styled HTML for PDF print
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${selectedTournament.name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 40px 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
          }
          .header-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
            text-align: left;
          }
          .info-item {
            background: rgba(255,255,255,0.15);
            padding: 10px;
            border-radius: 5px;
          }
          .info-label {
            font-size: 11px;
            text-transform: uppercase;
            opacity: 0.85;
            font-weight: 600;
          }
          .info-value {
            font-size: 16px;
            font-weight: bold;
            margin-top: 5px;
          }
          .pools {
            display: grid;
            gap: 25px;
          }
          .pool {
            page-break-inside: avoid;
          }
          .pool-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-left: 4px solid #667eea;
            margin-bottom: 10px;
            border-radius: 4px;
          }
          .pool-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin: 0;
          }
          .pool-count {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          table thead {
            background: #667eea;
            color: white;
          }
          table th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
          }
          table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
          }
          table tbody tr:nth-child(even) {
            background: #f8f9fa;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 11px;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            .container {
              box-shadow: none;
            }
          }
          @page {
            size: A4;
            margin: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 ${selectedTournament.name}</h1>
            <div class="header-info">
              <div class="info-item">
                <div class="info-label">Sport</div>
                <div class="info-value">${selectedTournament.sport}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Total Teams</div>
                <div class="info-value">${selectedTournament.numTeams}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Pools</div>
                <div class="info-value">${selectedTournament.numPools}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">${selectedTournament.status}</div>
              </div>
            </div>
          </div>
          <div class="pools">
            ${pools.map(pool => `
              <div class="pool">
                <div class="pool-header">
                  <p class="pool-title">${pool.name}</p>
                  <p class="pool-count">${pool.teamCount} teams</p>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 50px;">#</th>
                      <th>Team Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pool.teams.map((team, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${team.name || 'N/A'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')}
          </div>
          <div class="footer">
            <p>Generated by TourneyPro - Pool Management System</p>
            <p>Date: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create and print PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  useEffect(() => {
    if (dataUserId) load();
  }, [dataUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--text-1)]">
            Pool Management
          </h1>
          <p className="text-[var(--text-3)] mt-1">
            Manage pools and groups across your tournaments.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate('/tournaments/new')}>
            <Plus size={16} />
            New Tournament
          </Button>
        )}
      </div>

      {/* Tournament Selection */}
      {tournaments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map(t => (
            <Card
              key={t.id}
              onClick={() => handleTournamentSelect(t)}
              className={`cursor-pointer transition-all p-6 ${
                selectedTournament?.id === t.id ? 'ring-2 ring-[var(--accent)]' : ''
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--accent)', opacity: 0.15 }}>
                  <Trophy size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-1)] truncate">{t.name}</p>
                  <p className="text-xs text-[var(--text-3)]">{t.sport}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.status}>{t.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pool Details */}
      {selectedTournament && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--text-1)] mb-4">
              Pools in {selectedTournament.name}
            </h2>

            {/* Tournament Stats */}
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider">Number of Pools</p>
                      <p className="text-2xl font-display font-bold text-[var(--accent)] mt-1">
                        {selectedTournament.numPools || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider">Teams per Pool</p>
                      <p className="text-2xl font-display font-bold text-[var(--accent)] mt-1">
                        {selectedTournament.teamsPerPool || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider">Total Teams</p>
                      <p className="text-2xl font-display font-bold text-[var(--accent)] mt-1">
                        {selectedTournament.numTeams || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider">Status</p>
                      <div className="mt-1">
                        <Badge variant={selectedTournament.status}>
                          {selectedTournament.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Download Buttons */}
              <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
                <button
                  onClick={downloadExcel}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Sheet size={18} />
                  Download Excel
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <FileText size={18} />
                  Download PDF
                </button>
              </div>
            </Card>
          </div>

          {/* Pools List - Horizontal Layout */}
          {poolsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : pools.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pools.map(pool => (
                <Card key={pool.id} className="p-6">
                  {/* Pool Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--accent)', opacity: 0.15 }}>
                        <Layers size={18} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-1)]">{pool.name}</p>
                        <p className="text-xs text-[var(--text-3)]">{pool.teamCount} teams</p>
                      </div>
                    </div>
                    <Badge variant="pool">{pool.teamCount} Teams</Badge>
                  </div>

                  {/* Teams List */}
                  <div className="space-y-2">
                    {pool.teams.map((team, index) => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-[var(--surface-2)]/30 rounded-lg hover:bg-[var(--surface-2)]/50 transition-all">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: 'var(--accent)' }}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--text-1)] truncate">{team.name || `Team ${index + 1}`}</p>
                            <p className="text-xs text-[var(--text-3)] truncate">{team.sport || '-'}</p>
                          </div>
                        </div>

                        {/* Team Actions */}
                        {canEdit && matches.length === 0 && (
                          <div className="flex items-center gap-1 ml-2">
                            {/* Swap/Move Button */}
                            <button
                              onClick={() => handleEditTeam(team)}
                              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-all"
                              title="Move to another pool"
                            >
                              <ArrowRight size={16} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-red-400 transition-all"
                              title="Delete team"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <Users size={40} className="mx-auto text-[var(--text-3)] mb-3" />
              <p className="text-[var(--text-2)] font-medium">No teams added yet</p>
              <p className="text-[var(--text-3)] text-sm">
                Add teams to this tournament to organize them into pools.
              </p>
            </Card>
          )}

          {canEdit && selectedTournament.status === 'active' && matches.length === 0 && (
            <div className="space-y-4">
              {/* Add Team Form */}
              {addingTeam ? (
                <Card className="p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-1)]">Add Team to Pool</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider block mb-1">
                        Team Name
                      </label>
                      <input
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                        placeholder="Enter team name"
                        value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider block mb-1">
                        Select Pool
                      </label>
                      <select
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-1)] text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                        value={selectedPoolForTeam}
                        onChange={e => setSelectedPoolForTeam(e.target.value)}
                      >
                        {pools.map(pool => {
                          const poolLetter = pool.name.replace('Pool ', '');
                          return <option key={poolLetter} value={poolLetter}>{pool.name}</option>;
                        })}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleAddTeam} className="flex-1"><Check size={15} /> Add Team</Button>
                      <Button variant="secondary" onClick={() => { setAddingTeam(false); setNewTeamName(''); setSelectedPoolForTeam('A'); }} className="flex-1"><X size={15} /> Cancel</Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <button
                  onClick={() => setAddingTeam(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-3)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={16} /> Add Team to Pool
                </button>
              )}
              
              <div className="flex gap-3">
                <Button variant="secondary" size="md" onClick={() => navigate(`/tournaments/${selectedTournament.id}`)}>
                  View Tournament
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {tournaments.length === 0 && (
        <Card className="text-center py-12">
          <Layers size={40} className="mx-auto text-[var(--text-3)] mb-3" />
          <p className="text-[var(--text-2)] font-medium">No pool tournaments yet</p>
          <p className="text-[var(--text-3)] text-sm mb-4">
            Create a tournament with pool format to manage pools here.
          </p>
          {canEdit && (
            <Button onClick={() => navigate('/tournaments/new')}>
              <Plus size={16} /> Create Tournament
            </Button>
          )}
        </Card>
      )}

      {/* Move Team Modal */}
      <Modal isOpen={moveTeamModal} onClose={() => setMoveTeamModal(false)} title="Move Team to Pool" size="sm">
        <div className="space-y-3">
          {movingTeam && (
            <>
              <div className="p-3 bg-[var(--surface-2)]/30 rounded-lg mb-4">
                <p className="text-sm text-[var(--text-3)]">Moving:</p>
                <p className="font-semibold text-[var(--text-1)]">{movingTeam.name || 'Team'}</p>
              </div>
              <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider mb-2">Select Target Pool:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pools.map(pool => (
                  <button
                    key={pool.id}
                    onClick={() => handleMoveTeamToPool(pool.name)}
                    className="w-full text-left p-3 rounded-lg hover:bg-[var(--accent)]/20 transition-all border border-[var(--border)] hover:border-[var(--accent)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--text-1)]">{pool.name}</span>
                      <span className="text-xs text-[var(--text-3)]">{pool.teamCount} teams</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

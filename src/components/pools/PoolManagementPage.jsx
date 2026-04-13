// src/components/pools/PoolManagementPage.jsx
// ─────────────────────────────────────────────────────────────
// Pool Management: manage tournament pools and groups.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Trophy, Users, Edit, Trash2, Plus, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments, getTeams, updateTeam } from '../../firebase/firestore';
import { Card, Badge, Button, Spinner, Input, Modal } from '../ui';

export default function PoolManagementPage() {
  const { dataUserId, canEdit } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [pools, setPools] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamModal, setEditTeamModal] = useState(false);
  const [movingTeam, setMovingTeam] = useState(null);
  const [moveTeamModal, setMoveTeamModal] = useState(false);
  const [teamFormData, setTeamFormData] = useState({});
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
    setEditingTeam(team);
    setTeamFormData({ name: team.name, sport: team.sport, status: team.status });
    setEditTeamModal(true);
  };

  const handleSaveTeam = async () => {
    if (editingTeam) {
      await updateTeam(editingTeam.id, teamFormData);
      await loadPoolsData(selectedTournament);
      setEditTeamModal(false);
      setEditingTeam(null);
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
                        {canEdit && (
                          <div className="flex items-center gap-1 ml-2">
                            {/* Move Button */}
                            <button
                              onClick={() => handleMoveTeam(team)}
                              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-all"
                              title="Move to another pool"
                            >
                              <ArrowRight size={16} />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleEditTeam(team)}
                              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-all"
                              title="Edit team"
                            >
                              <Edit size={16} />
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

          {canEdit && selectedTournament.status === 'active' && (
            <div className="flex gap-3">
              <Button variant="primary" size="md">
                <Edit size={16} /> Edit Pools
              </Button>
              <Button variant="secondary" size="md" onClick={() => navigate(`/tournaments/${selectedTournament.id}`)}>
                View Tournament
              </Button>
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

      {/* Edit Team Modal */}
      <Modal isOpen={editTeamModal} onClose={() => setEditTeamModal(false)} title="Edit Team" size="md">
        <div className="space-y-4">
          <Input
            label="Team Name"
            value={teamFormData.name || ''}
            onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
            placeholder="Enter team name"
          />
          <Input
            label="Sport"
            value={teamFormData.sport || ''}
            onChange={(e) => setTeamFormData({ ...teamFormData, sport: e.target.value })}
            placeholder="Enter sport"
          />
          <Input
            label="Status"
            value={teamFormData.status || ''}
            onChange={(e) => setTeamFormData({ ...teamFormData, status: e.target.value })}
            placeholder="Enter status"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setEditTeamModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveTeam}>Save Changes</Button>
          </div>
        </div>
      </Modal>

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

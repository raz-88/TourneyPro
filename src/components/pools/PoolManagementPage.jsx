// src/components/pools/PoolManagementPage.jsx
// ─────────────────────────────────────────────────────────────
// Pool Management: manage tournament pools and groups.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Trophy, Users, Edit, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTournaments } from '../../firebase/firestore';
import { Card, Badge, Button, Spinner, Input } from '../ui';

export default function PoolManagementPage() {
  const { dataUserId, canEdit } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const data = await getTournaments(dataUserId);
    setTournaments(data.filter(t => t.tournamentType === 'pool'));
    setLoading(false);
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
              onClick={() => setSelectedTournament(t)}
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
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-[var(--text-1)]">
            Pools in {selectedTournament.name}
          </h2>

          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider mb-2">
                  Number of Pools
                </p>
                <p className="text-3xl font-display font-bold text-[var(--accent)]">
                  {selectedTournament.numPools || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider mb-2">
                  Teams per Pool
                </p>
                <p className="text-3xl font-display font-bold text-[var(--accent)]">
                  {selectedTournament.teamsPerPool || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider mb-2">
                  Total Teams
                </p>
                <p className="text-3xl font-display font-bold text-[var(--accent)]">
                  {selectedTournament.numTeams || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider mb-2">
                  Status
                </p>
                <Badge variant={selectedTournament.status}>
                  {selectedTournament.status}
                </Badge>
              </div>
            </div>

            {canEdit && selectedTournament.status === 'active' && (
              <div className="mt-6 flex gap-3">
                <Button variant="primary" size="sm">
                  <Edit size={16} /> Edit Pools
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/tournaments/${selectedTournament.id}`)}>
                  View Tournament
                </Button>
              </div>
            )}
          </Card>
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
    </div>
  );
}

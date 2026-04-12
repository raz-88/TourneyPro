// src/components/tournament/CreateTournamentPage.jsx
// ─────────────────────────────────────────────────────────────
// Multi-step form: tournament details → teams → fixture config
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Trophy, Users, Settings2, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createTournament, addTeam } from '../../firebase/firestore';
import { Button, Input, Select, Card } from '../ui';

const SPORTS = ['Football','Cricket','Basketball','Volleyball','Tennis','Badminton','Hockey','Rugby','Baseball','Other'];
const STEPS  = ['Tournament Info', 'Add Teams', 'Fixture Config'];

export default function CreateTournamentPage() {
  const { dataUserId, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Step 0 – Tournament info
  const [info, setInfo] = useState({
    name: '', sport: 'Football', numTeams: 8,
    tournamentType: 'pool',   // 'pool' | 'knockout'
    fixtureMode: 'auto',      // 'auto' | 'manual'
    scoringWin: 3, scoringDraw: 1, scoringLoss: 0,
    includeQF: true, includeSF: true, includeFinal: true,
  });

  // Step 1 – Teams
  const [teams, setTeams]    = useState([{ name: '' }]);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState(false);

  // Step 2 – Manual fixture config (only if fixtureMode === 'manual')
  const [numPools, setNumPools] = useState(2);

  const setI = (k) => (e) => setInfo(i => ({ ...i, [k]: e.target.value }));
  const setIB = (k) => (e) => setInfo(i => ({ ...i, [k]: e.target.checked }));
  const setIN = (k) => (e) => setInfo(i => ({ ...i, [k]: Number(e.target.value) }));

  // ── Team helpers ──────────────────────────────────────────
  const addTeamRow   = () => setTeams(ts => [...ts, { name: '' }]);
  const removeTeam   = (i) => setTeams(ts => ts.filter((_, idx) => idx !== i));
  const setTeamName  = (i, v) => setTeams(ts => ts.map((t, idx) => idx === i ? { name: v } : t));

  function applyBulk() {
    const names = bulkText.split('\n').map(s => s.trim()).filter(Boolean);
    setTeams(names.map(n => ({ name: n })));
    setBulkMode(false);
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const validTeams = teams.filter(t => t.name.trim());
      if (validTeams.length < 2) throw new Error('Add at least 2 teams.');

      const tid = await createTournament(dataUserId, {
        ...info,
        numTeams: validTeams.length,
        numPools: info.fixtureMode === 'manual' ? numPools : null,
        mainUserId: dataUserId,
        createdBy: user.uid,
      });

      // Save teams
      await Promise.all(validTeams.map(t => addTeam(tid, dataUserId, { name: t.name.trim() })));

      navigate(`/tournaments/${tid}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step renderers ────────────────────────────────────────
  const canNext0 = info.name.trim().length > 0;
  const canNext1 = teams.filter(t => t.name.trim()).length >= 2;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--text-1)]">Create Tournament</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">Fill in the details to set up your tournament.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i === step ? 'text-white' : i < step ? 'text-white opacity-60' : 'bg-[var(--surface-2)] text-[var(--text-3)]'
              }`} style={i <= step ? { background: 'var(--accent)' } : {}}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card>
        {/* ─ Step 0: Tournament Info ─ */}
        {step === 0 && (
          <div className="space-y-4">
            <Input label="Tournament Name" placeholder="e.g. City Cup 2025" value={info.name} onChange={setI('name')} />

            <Select label="Sport" value={info.sport} onChange={setI('sport')}>
              {SPORTS.map(s => <option key={s}>{s}</option>)}
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider block mb-1">
                  Tournament Type
                </label>
                <div className="flex gap-2">
                  {['pool', 'knockout'].map(v => (
                    <button
                      key={v}
                      onClick={() => setInfo(i => ({ ...i, tournamentType: v }))}
                      className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                        info.tournamentType === v
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/40'
                      }`}
                    >
                      {v === 'pool' ? 'Pool System' : 'Knockout'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider block mb-1">
                  Fixture Mode
                </label>
                <div className="flex gap-2">
                  {['auto', 'manual'].map(v => (
                    <button
                      key={v}
                      onClick={() => setInfo(i => ({ ...i, fixtureMode: v }))}
                      className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                        info.fixtureMode === v
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]/40'
                      }`}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scoring rules */}
            <div>
              <p className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider mb-2">Scoring Rules</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Win"  type="number" min="0" value={info.scoringWin}  onChange={setIN('scoringWin')} />
                <Input label="Draw" type="number" min="0" value={info.scoringDraw} onChange={setIN('scoringDraw')} />
                <Input label="Loss" type="number" min="0" value={info.scoringLoss} onChange={setIN('scoringLoss')} />
              </div>
            </div>

            {/* Knockout options */}
            {info.tournamentType === 'knockout' && (
              <div>
                <p className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wider mb-2">Knockout Rounds</p>
                <div className="flex flex-col gap-2">
                  {[
                    { key: 'includeQF', label: 'Quarter Finals' },
                    { key: 'includeSF', label: 'Semi Finals' },
                    { key: 'includeFinal', label: 'Final' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={info[key]} onChange={setIB(key)}
                        className="w-4 h-4 rounded accent-[var(--accent)]" />
                      <span className="text-sm text-[var(--text-1)]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─ Step 1: Teams ─ */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--text-1)]">
                Teams — {teams.filter(t => t.name.trim()).length} added
              </p>
              <Button variant="ghost" size="sm" onClick={() => setBulkMode(b => !b)}>
                {bulkMode ? 'Single Entry' : 'Bulk Entry'}
              </Button>
            </div>

            {bulkMode ? (
              <div className="space-y-3">
                <textarea
                  className="w-full h-48 px-3 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="Enter one team name per line:&#10;Team Alpha&#10;Team Beta&#10;Team Gamma"
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                />
                <Button onClick={applyBulk} className="w-full">Apply Bulk Teams</Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {teams.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-3)] w-6 text-right flex-shrink-0">{i + 1}.</span>
                    <input
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                      placeholder={`Team ${i + 1} name`}
                      value={t.name}
                      onChange={e => setTeamName(i, e.target.value)}
                    />
                    {teams.length > 1 && (
                      <button onClick={() => removeTeam(i)}
                        className="p-1.5 rounded text-[var(--text-3)] hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!bulkMode && (
              <Button variant="secondary" size="sm" onClick={addTeamRow} className="w-full">
                <Plus size={14} /> Add Team
              </Button>
            )}
          </div>
        )}

        {/* ─ Step 2: Fixture Config ─ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text-3)] uppercase tracking-wider mb-3">Summary</p>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                {[
                  ['Tournament', info.name],
                  ['Sport', info.sport],
                  ['Teams', teams.filter(t => t.name.trim()).length],
                  ['Type', info.tournamentType === 'pool' ? 'Pool System' : 'Knockout'],
                  ['Fixture Mode', info.fixtureMode.charAt(0).toUpperCase() + info.fixtureMode.slice(1)],
                  ['Scoring', `W:${info.scoringWin} D:${info.scoringDraw} L:${info.scoringLoss}`],
                ].map(([k, v]) => (
                  <React.Fragment key={k}>
                    <span className="text-[var(--text-3)]">{k}</span>
                    <span className="text-[var(--text-1)] font-medium">{v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {info.fixtureMode === 'manual' && info.tournamentType === 'pool' && (
              <Input
                label="Number of Pools"
                type="number" min="1"
                max={teams.filter(t => t.name.trim()).length}
                value={numPools}
                onChange={e => setNumPools(Number(e.target.value))}
              />
            )}

            {info.fixtureMode === 'auto' && (
              <div className="text-sm text-[var(--text-3)] bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border)]">
                Auto mode will automatically distribute {teams.filter(t => t.name.trim()).length} teams into optimal pools.
                Fixtures will be generated using round-robin logic (n(n-1)/2 matches per pool).
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--border)]">
          <Button
            variant="secondary"
            onClick={() => step === 0 ? navigate('/tournaments') : setStep(s => s - 1)}
          >
            <ChevronLeft size={16} />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 ? !canNext0 : !canNext1}
            >
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create Tournament'}
              <Trophy size={16} />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

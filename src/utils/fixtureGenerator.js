// src/utils/fixtureGenerator.js
// ─────────────────────────────────────────────────────────────
// Core fixture-generation algorithms:
//   • Round-Robin (pool play) using the "circle method"
//   • Knockout bracket builder
//   • Auto pool-split logic
// ─────────────────────────────────────────────────────────────

// ── AUTO POOL SIZING ──────────────────────────────────────────
/**
 * Given a team count, decide how many pools and their sizes.
 * Strategy: prefer pools of 4; fall back to 3 or 5.
 *
 * @param {number} teamCount
 * @returns {{ pools: number, teamsPerPool: number[] }}
 */
export function autoPoolConfig(teamCount) {
  if (teamCount <= 4) return { pools: 1, teamsPerPool: [teamCount] };

  // Try dividing into pools of 4
  if (teamCount % 4 === 0) {
    const pools = teamCount / 4;
    return { pools, teamsPerPool: Array(pools).fill(4) };
  }
  // Try pools of 3
  if (teamCount % 3 === 0) {
    const pools = teamCount / 3;
    return { pools, teamsPerPool: Array(pools).fill(3) };
  }
  // Mix: fill as many pools of 4 as possible, remainder in one smaller pool
  const pools      = Math.ceil(teamCount / 4);
  const base       = Math.floor(teamCount / pools);
  const remainder  = teamCount % pools;
  const sizes      = Array(pools).fill(base);
  for (let i = 0; i < remainder; i++) sizes[i]++;
  return { pools, teamsPerPool: sizes };
}

// ── ROUND ROBIN (Circle Method) ───────────────────────────────
/**
 * Generate all pairings for n teams using the circle method.
 * Guarantees no team plays consecutively if possible.
 * Returns rounds array, where each round = array of [teamA, teamB] pairs.
 *
 * Total matches = n(n-1)/2
 *
 * @param {string[]} teamIds
 * @returns {Array<Array<[string, string]>>}
 */
export function generateRoundRobin(teamIds) {
  const teams = [...teamIds];
  const n     = teams.length;

  // If odd number, add a BYE placeholder
  if (n % 2 !== 0) teams.push('BYE');

  const total  = teams.length;
  const rounds = [];
  const pivot  = teams[0]; // fixed team at top-left
  const rest   = teams.slice(1);

  for (let round = 0; round < total - 1; round++) {
    const roundPairs = [];
    const rotated    = [rest[(round) % rest.length], ...rest.slice(0, round).reverse(), ...rest.slice(round + 1)];

    // pair pivot with first of rotated
    const pair0 = [pivot, rotated[0]];
    if (!pair0.includes('BYE')) roundPairs.push(pair0);

    // pair remaining
    for (let i = 1; i < total / 2; i++) {
      const a = rotated[i];
      const b = rotated[total - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') roundPairs.push([a, b]);
    }
    if (roundPairs.length) rounds.push(roundPairs);
  }
  return rounds;
}

/**
 * Flatten round-robin rounds into match objects ready for Firestore.
 *
 * @param {string} tournamentId
 * @param {string} mainUserId
 * @param {string} poolId    - e.g. "Pool A"
 * @param {string[]} teamIds
 * @param {Object} teamMap   - { [teamId]: { name } }
 * @returns {Object[]} match documents
 */
export function buildPoolMatches(tournamentId, mainUserId, poolId, teamIds, teamMap) {
  const rounds  = generateRoundRobin(teamIds);
  const matches = [];

  rounds.forEach((round, rIdx) => {
    round.forEach(([teamAId, teamBId]) => {
      matches.push({
        tournamentId,
        mainUserId,
        type: 'pool',
        poolId,
        round: rIdx + 1,
        teamAId,
        teamBId,
        teamAName: teamMap[teamAId]?.name ?? teamAId,
        teamBName: teamMap[teamBId]?.name ?? teamBId,
        scoreA: null,
        scoreB: null,
        status: 'upcoming',    // upcoming | ongoing | completed
        scheduledAt: null,
        winnerId: null,
      });
    });
  });

  return matches;
}

// ── KNOCKOUT BRACKET ──────────────────────────────────────────
/**
 * Build initial knockout matches from a list of qualifier team IDs.
 * Supports: QF, SF, Final configuration.
 *
 * @param {string} tournamentId
 * @param {string} mainUserId
 * @param {string[]} teamIds   - ordered list (1st seed vs last seed etc.)
 * @param {Object} options     - { includeQF, includeSF, includeFinal }
 * @returns {Object[]} match documents
 */
export function buildKnockoutMatches(tournamentId, mainUserId, teamIds, options = {}) {
  const { includeQF = true, includeSF = true, includeFinal = true } = options;
  const matches = [];

  let teams = [...teamIds];

  // Quarter Finals - Custom Championship Pairing
  // Expected order: [A_Winner, A_Runner, B_Winner, B_Runner, C_Winner, C_Runner, D_Winner, D_Runner]
  // Pairings:
  // QF1: A_Winner vs B_Runner
  // QF2: D_Winner vs C_Runner
  // QF3: C_Winner vs D_Runner
  // QF4: B_Winner vs A_Runner
  if (includeQF && teams.length >= 8) {
    // teams[0] = A Winner, teams[1] = A Runner
    // teams[2] = B Winner, teams[3] = B Runner
    // teams[4] = C Winner, teams[5] = C Runner
    // teams[6] = D Winner, teams[7] = D Runner
    
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'QF', 1, teams[0], teams[3])); // A_W vs B_R
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'QF', 2, teams[6], teams[5])); // D_W vs C_R
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'QF', 3, teams[4], teams[7])); // C_W vs D_R
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'QF', 4, teams[2], teams[1])); // B_W vs A_R
    
    teams = Array(4).fill(null).map((_, i) => `QF_W${i + 1}`); // placeholder winner refs
  }

  // Semi Finals - Custom Pairing
  // SF1: Winner of QF1 vs Winner of QF2
  // SF2: Winner of QF3 vs Winner of QF4
  if (includeSF) {
    const sf1TeamA = teams[0] ?? null; // QF1 Winner
    const sf1TeamB = teams[1] ?? null; // QF2 Winner
    const sf2TeamA = teams[2] ?? null; // QF3 Winner
    const sf2TeamB = teams[3] ?? null; // QF4 Winner
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'SF', 1, sf1TeamA, sf1TeamB));
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'SF', 2, sf2TeamA, sf2TeamB));
    teams = ['SF_W1', 'SF_W2'];
  }

  // Final
  if (includeFinal) {
    matches.push(makeKnockoutMatch(tournamentId, mainUserId, 'Final', 1, teams[0] ?? null, teams[1] ?? null));
  }

  return matches;
}

function makeKnockoutMatch(tournamentId, mainUserId, stage, matchNo, teamAId, teamBId) {
  return {
    tournamentId,
    mainUserId,
    type: 'knockout',
    stage,
    matchNo,
    teamAId,
    teamBId,
    teamAName: null,
    teamBName: null,
    scoreA: null,
    scoreB: null,
    status: 'upcoming',
    scheduledAt: null,
    winnerId: null,
  };
}

// ── LEADERBOARD CALCULATION ───────────────────────────────────
/**
 * Recalculate standings for all teams in a pool given completed matches.
 *
 * @param {string[]} teamIds
 * @param {Object[]} completedMatches
 * @param {Object} scoringRules - { win, loss, draw }
 * @returns {Object[]} sorted leaderboard entries
 */
export function calculateStandings(teamIds, completedMatches, scoringRules = { win: 3, loss: 0, draw: 1 }) {
  const table = {};

  teamIds.forEach(id => {
    table[id] = { teamId: id, played: 0, won: 0, lost: 0, drawn: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });

  completedMatches.forEach(match => {
    if (match.status !== 'completed') return;
    const { teamAId, teamBId, scoreA, scoreB } = match;
    if (!table[teamAId] || !table[teamBId]) return;

    const a = table[teamAId];
    const b = table[teamBId];
    const sA = Number(scoreA ?? 0);
    const sB = Number(scoreB ?? 0);

    a.played++; b.played++;
    a.gf += sA; a.ga += sB; a.gd += sA - sB;
    b.gf += sB; b.ga += sA; b.gd += sB - sA;

    if (sA > sB) {
      a.won++; a.points += scoringRules.win;
      b.lost++; b.points += scoringRules.loss;
    } else if (sB > sA) {
      b.won++; b.points += scoringRules.win;
      a.lost++; a.points += scoringRules.loss;
    } else {
      a.drawn++; a.points += scoringRules.draw;
      b.drawn++; b.points += scoringRules.draw;
    }
  });

  // Sort: points desc → gd desc → gf desc
  return Object.values(table).sort((x, y) =>
    y.points - x.points || y.gd - x.gd || y.gf - x.gf
  );
}

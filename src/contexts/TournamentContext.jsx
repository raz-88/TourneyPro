// src/contexts/TournamentContext.jsx
// ─────────────────────────────────────────────────────────────
// Holds the currently-selected tournament + its teams/matches
// so any child component can consume them without prop drilling.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback } from 'react';
import { getTournament, getTeams, getMatches, getLeaderboard } from '../firebase/firestore';

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams]           = useState([]);
  const [matches, setMatches]       = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingTournament, setLoadingTournament] = useState(false);

  const loadTournament = useCallback(async (id) => {
    setLoadingTournament(true);
    try {
      const [t, teamsData, matchesData, lbData] = await Promise.all([
        getTournament(id),
        getTeams(id),
        getMatches(id),
        getLeaderboard(id),
      ]);
      setTournament(t);
      setTeams(teamsData);
      setMatches(matchesData);
      setLeaderboard(lbData);
    } finally {
      setLoadingTournament(false);
    }
  }, []);

  const refreshMatches = async () => {
    if (tournament) {
      const data = await getMatches(tournament.id);
      setMatches(data);
    }
  };

  const refreshLeaderboard = async () => {
    if (tournament) {
      const data = await getLeaderboard(tournament.id);
      setLeaderboard(data);
    }
  };

  const refreshTeams = async () => {
    if (tournament) {
      const data = await getTeams(tournament.id);
      setTeams(data);
    }
  };

  return (
    <TournamentContext.Provider value={{
      tournament, teams, matches, leaderboard,
      loadingTournament,
      loadTournament,
      refreshMatches, refreshLeaderboard, refreshTeams,
      setTournament,
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);

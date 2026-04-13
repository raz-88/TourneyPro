// src/firebase/firestore.js
// ─────────────────────────────────────────────────────────────
// Centralised Firestore data-access layer.
// All reads/writes go through here — keeps components clean.
// ─────────────────────────────────────────────────────────────

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// ════════════════════════════════════════════════════════════
//  TOURNAMENTS
// ════════════════════════════════════════════════════════════

export async function createTournament(mainUserId, data) {
  const ref = await addDoc(collection(db, 'tournaments'), {
    ...data,
    mainUserId,
    status: 'draft',     // draft | active | completed
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTournaments(mainUserId) {
  const q = query(
    collection(db, 'tournaments'),
    where('mainUserId', '==', mainUserId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTournament(id) {
  const snap = await getDoc(doc(db, 'tournaments', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateTournament(id, data) {
  await updateDoc(doc(db, 'tournaments', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTournament(id) {
  await deleteDoc(doc(db, 'tournaments', id));
}

// ════════════════════════════════════════════════════════════
//  TEAMS
// ════════════════════════════════════════════════════════════

export async function addTeam(tournamentId, mainUserId, data) {
  const ref = await addDoc(collection(db, 'teams'), {
    ...data,
    tournamentId,
    mainUserId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTeams(tournamentId) {
  const q = query(
    collection(db, 'teams'),
    where('tournamentId', '==', tournamentId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateTeam(id, data) {
  await updateDoc(doc(db, 'teams', id), data);
}

export async function deleteTeam(id) {
  await deleteDoc(doc(db, 'teams', id));
}

// ════════════════════════════════════════════════════════════
//  MATCHES
// ════════════════════════════════════════════════════════════

/**
 * Batch-write an array of match objects (used by fixture generator).
 */
export async function saveMatches(matches) {
  const batch = writeBatch(db);
  matches.forEach(m => {
    const ref = doc(collection(db, 'matches'));
    batch.set(ref, { ...m, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function getMatches(tournamentId) {
  const q = query(
    collection(db, 'matches'),
    where('tournamentId', '==', tournamentId),
    orderBy('scheduledAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateMatch(id, data) {
  await updateDoc(doc(db, 'matches', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMatch(id) {
  await deleteDoc(doc(db, 'matches', id));
}

// ════════════════════════════════════════════════════════════
//  LEADERBOARD
// ════════════════════════════════════════════════════════════

/**
 * Recalculate and overwrite leaderboard entries for a pool/tournament.
 * Called after every match result update.
 */
export async function upsertLeaderboardEntry(tournamentId, teamId, data) {
  const id = `${tournamentId}_${teamId}`;
  await setDoc(doc(db, 'leaderboard', id), {
    tournamentId,
    teamId,
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getLeaderboard(tournamentId) {
  const q = query(
    collection(db, 'leaderboard'),
    where('tournamentId', '==', tournamentId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ════════════════════════════════════════════════════════════
//  SUB-USERS
// ════════════════════════════════════════════════════════════

export async function createSubUser(mainUserId, uid, data) {
  await setDoc(doc(db, 'users', uid), {
    uid,
    ...data,
    role: 'sub',
    mainUserId,
    createdAt: serverTimestamp(),
  });
}

export async function getSubUsers(mainUserId) {
  const q = query(
    collection(db, 'users'),
    where('mainUserId', '==', mainUserId),
    where('role', '==', 'sub')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateSubUser(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}

export async function deleteSubUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

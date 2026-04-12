// src/firebase/auth.js
// ─────────────────────────────────────────────────────────────
// Authentication service — wraps Firebase Auth calls and
// mirrors the result into Firestore user documents.
// ─────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config';

// ── Register a new MAIN user ──────────────────────────────────
export async function registerMainUser({ name, email, password }) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  // Update display name in Auth
  await updateProfile(user, { displayName: name });

  // Mirror into Firestore /users/{uid}
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    name,
    email,
    role: 'main',          // 'main' | 'sub'
    mainUserId: user.uid,  // self-reference for query consistency
    permissions: 'admin',  // 'admin' | 'edit' | 'view'
    createdAt: serverTimestamp(),
  });

  return user;
}

// ── Sign in ───────────────────────────────────────────────────
export async function loginUser(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

// ── Sign out ──────────────────────────────────────────────────
export async function logoutUser() {
  await signOut(auth);
}

// ── Get Firestore profile for current user ────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// ── Auth state observer (used in AuthContext) ─────────────────
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

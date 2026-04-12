// src/firebase/config.js
// ─────────────────────────────────────────────────────────────
// Firebase project configuration.
// Replace the placeholder values with your actual Firebase
// project credentials from the Firebase Console.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA8jUeGhGgwDlYJO57huqCjo5zjf55oQIc",
  authDomain: "tourney-pro-f3c97.firebaseapp.com",
  projectId: "tourney-pro-f3c97",
  storageBucket: "tourney-pro-f3c97.firebasestorage.app",
  messagingSenderId: "681519792639",
  appId: "1:681519792639:web:a155321d3aa4cd767327ca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth instance
export const auth = getAuth(app);

// Firestore instance
export const db = getFirestore(app);

export default app;

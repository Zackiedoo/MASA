// ─────────────────────────────────────────────────────────────────────────────
// Firebase configuration. Values come from Vite env vars (see .env.example):
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_URL,
//   VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
//   VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
// These are public identifiers (not secrets). Security comes from the Database/Storage Rules.
//
// If they are missing, MASA runs in clearly-labelled DEMO MODE (local browser storage, no Firebase).
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY, // VITE_FIREBASE_API_KEY
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, // VITE_FIREBASE_AUTH_DOMAIN
  databaseURL: env.VITE_FIREBASE_DATABASE_URL, // VITE_FIREBASE_DATABASE_URL
  projectId: env.VITE_FIREBASE_PROJECT_ID, // VITE_FIREBASE_PROJECT_ID
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, // VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, // VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: env.VITE_FIREBASE_APP_ID, // VITE_FIREBASE_APP_ID
};

const isSet = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && !/^(your|xxx|placeholder)/i.test(v.trim());

/** true only when every required value is present. */
export const isFirebaseConfigured = [
  firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.databaseURL,
  firebaseConfig.projectId, firebaseConfig.appId,
].every(isSet);

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseDb: Database | null = firebaseApp ? getDatabase(firebaseApp) : null;
export const firebaseStorage: FirebaseStorage | null = firebaseApp && isSet(firebaseConfig.storageBucket) ? getStorage(firebaseApp) : null;

export const isDemoMode = !isFirebaseConfigured;
export const LOGIN_EMAIL_DOMAIN = env.VITE_LOGIN_EMAIL_DOMAIN || 'masa-login.example.com';

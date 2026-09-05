import 'server-only';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function app() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !storageBucket) throw new Error('Firebase server configuration missing');
  const emulated = process.env.MEDLENS_EMULATORS === 'true';
  if (emulated && !projectId.startsWith('demo-')) throw new Error('Emulators require a demo project');
  if (emulated && (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST)) throw new Error('Configure all emulators');
  if (!emulated && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST)) throw new Error('Unexpected emulator configuration');
  return getApps()[0] || initializeApp({ projectId, storageBucket, ...(emulated ? {} : { credential: applicationDefault() }) });
}

export const adminAuth = () => getAuth(app());
export const database = () => getFirestore(app());
export const reportBucket = () => getStorage(app()).bucket();

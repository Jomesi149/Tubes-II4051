import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasRequiredConfig(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function isFirebaseConfigured(): boolean {
  return hasRequiredConfig();
}

// Inisialisasi Firebase App secara aman (Singleton Pattern untuk Next.js)
const app = getApps().length > 0 
  ? getApps()[0] 
  : (hasRequiredConfig() ? initializeApp(firebaseConfig) : null);

// Ekspor Firestore instance secara langsung agar mudah di-import di file storage
export const db = app ? getFirestore(app) : null;

export function getFirebaseDb() {
  return db;
}
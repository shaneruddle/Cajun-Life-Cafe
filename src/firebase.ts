import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
    : undefined;

console.log("Initializing Firebase App:", firebaseConfig.projectId);
console.log("Initializing Firestore with Database ID:", dbId || "(default)");
console.log("Initializing Storage with Bucket:", firebaseConfig.storageBucket);

export const db = getFirestore(app, dbId);

// Enable offline persistence
if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
          if (err.code === 'failed-precondition') {
                  console.warn('Firestore persistence failed: Multiple tabs open');
          } else if (err.code === 'unimplemented') {
                  console.warn('Firestore persistence failed: Browser not supported');
          }
    });
}

export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAJWxOldfga1VWGfi8-Z5cowgkDT0JnfSI",
  authDomain: "cajun-life-cafe.firebaseapp.com",
  projectId: "cajun-life-cafe",
  storageBucket: "cajun-life-cafe.firebasestorage.app",
  messagingSenderId: "1006330230181",
  appId: "1:1006330230181:web:bb9fa1db36a7ef61bd244c",
};

const app = initializeApp(firebaseConfig);

// Menu data lives in the AI Studio named database
export const db = getFirestore(app); // default database — supports security rules
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

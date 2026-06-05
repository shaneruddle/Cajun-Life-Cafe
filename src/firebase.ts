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

// menuDb — named Enterprise database where menu/categories/custom_meals live
// This is read-only for customers and managed by admin. No security rules needed
// (Enterprise DB uses IAM; admin SDK on server handles writes).
export const menuDb = getFirestore(app, "ai-studio-88dfc183-b7e7-45b8-b831-62b1a7bbdb29");

// db — default Firestore database for CRM, loyalty, finance, logs, users
// Supports Firebase security rules — cashiers and managers can access via Auth.
export const db = getFirestore(app);

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

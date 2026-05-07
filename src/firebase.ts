import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

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

// Test connection to Firestore and Storage
async function testConnection() {
  // Add a small delay to ensure Firebase is fully initialized
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    console.log("Testing Firestore connection to path: test/connection");
    const testDoc = await getDoc(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful. Document exists:", testDoc.exists());
  } catch (error: any) {
    console.error("Firestore connection test failed:", error?.code, error?.message);
  }

  try {
    console.log("Testing Storage connection to bucket:", firebaseConfig.storageBucket);
    // Try to get a non-existent file to test connection
    // If it returns 404 (object-not-found), it means we CAN talk to storage
    // If it returns 403 (unauthorized), it means rules are blocking us
    const testRef = ref(storage, 'test-connection-file');
    await getDownloadURL(testRef);
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found') {
      console.log("Storage connection successful (bucket exists and is reachable).");
    } else {
      console.error("Storage connection test failed:", error?.code, error?.message);
    }
  }
}
testConnection();

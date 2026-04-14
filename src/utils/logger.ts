import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { SystemLog, OperationType } from '../types';
import { handleFirestoreError } from './firestore';

export const logActivity = async (
  action: string, 
  details: string, 
  category: SystemLog['category']
) => {
  if (!auth.currentUser) return;

  const logEntry: Omit<SystemLog, 'id'> = {
    action,
    details,
    category,
    userEmail: auth.currentUser.email || 'unknown',
    userId: auth.currentUser.uid,
    timestamp: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'system_logs'), logEntry);
  } catch (error) {
    // We don't want to crash the app if logging fails, but we should report it
    console.error('Failed to log activity:', error);
    try {
      handleFirestoreError(error, 'write' as any, 'system_logs');
    } catch (e) {
      // Silent catch to prevent infinite loops or crashes
    }
  }
};

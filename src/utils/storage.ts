import { auth } from '../firebase';
import { OperationType } from '../types';

export interface StorageErrorInfo {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
  }
}

export function handleStorageError(error: unknown, operationType: string, path: string | null) {
  const errInfo: StorageErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Storage Error: ', JSON.stringify(errInfo));
  return errInfo;
}

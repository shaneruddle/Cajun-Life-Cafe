import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { syncStaffDirectory, removeStaffDirectoryEntry } from './staffDirectory';

/**
 * Looks for an admin-created "pending" profile (added from the Users
 * dashboard before the person ever logged in) matching this email, and if
 * found, "claims" it:
 *   1. Copies its fields into a real users/{uid} doc — Firestore rules and
 *      the rest of the app assume a user's doc ID equals their Firebase Auth
 *      uid, so the pending placeholder (keyed by a random doc ID) can't be
 *      used directly.
 *   2. Marks the original pending doc `superseded: true` so it drops out of
 *      the Users list (kept rather than deleted since a plain authenticated
 *      user only has permission to update — not delete — another doc).
 *
 * Returns the claimed profile (role, salary, position, etc. all carried
 * over), or null if no matching pending profile exists — callers should fall
 * back to their normal "unknown user" handling in that case.
 */
export async function claimPendingProfile(uid: string, email: string): Promise<UserProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', normalizedEmail),
      where('pending', '==', true)
    );
    const snap = await getDocs(q);
    const pendingDoc = snap.docs.find((d) => !d.data().superseded);
    if (!pendingDoc) return null;

    const data = pendingDoc.data() as UserProfile;
    const now = new Date().toISOString();
    const claimedProfile: UserProfile = {
      ...data,
      email: normalizedEmail,
      uid,
      pending: false,
      createdAt: data.createdAt || now,
      lastLogin: now,
    };
    delete (claimedProfile as any).id;
    delete (claimedProfile as any).superseded;
    delete (claimedProfile as any).claimedUid;

    await setDoc(doc(db, 'users', uid), claimedProfile, { merge: true });
    await updateDoc(doc(db, 'users', pendingDoc.id), { superseded: true, claimedUid: uid });
    // Move the staff_directory entry from the old placeholder doc ID over to
    // the real uid — write the new one first, then remove the stale
    // placeholder entry (which was already visible pre-claim, since pending
    // staff are included in the directory — see staffDirectory.ts).
    await syncStaffDirectory(claimedProfile).catch((err) => console.error('syncStaffDirectory (claim) failed:', err));
    if (pendingDoc.id !== uid) {
      await removeStaffDirectoryEntry(pendingDoc.id).catch((err) => console.error('removeStaffDirectoryEntry (claim) failed:', err));
    }

    return claimedProfile;
  } catch (err) {
    console.error('claimPendingProfile failed:', err);
    return null;
  }
}

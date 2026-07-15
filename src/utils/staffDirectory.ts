import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

const PAYROLL_ELIGIBLE_ROLES: string[] = ['cashier', 'manager', 'employee'];

export interface StaffDirectoryEntry {
  uid: string;
  name: string;
  role: string;
}

// Keeps the lightweight `staff_directory` collection (uid + name + role only
// — no salary/bank fields) in sync with a full `users` profile. Cashier-role
// staff can't read other people's full user documents (which contain salary
// and bank account info — see firestore.rules), but they DO need a name to
// pick from when tagging a "Salary & Staff Advances" expense to a specific
// employee. This collection is the safe, read-restricted source for that.
//
// Call this any time a users/{uid} doc is created, edited, disabled/
// reactivated, has its role changed, or gets claimed from a pending profile.
export async function syncStaffDirectory(profile: Partial<UserProfile> & { uid: string }) {
  const ref = doc(db, 'staff_directory', profile.uid);
  const eligible = !!profile.role && PAYROLL_ELIGIBLE_ROLES.includes(profile.role) && !profile.disabled && !profile.pending;
  if (eligible) {
    const name =
      profile.displayName ||
      [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
      profile.email ||
      'Unnamed';
    await setDoc(ref, { uid: profile.uid, name, role: profile.role });
  } else {
    // Not (or no longer) eligible — e.g. deactivated, still pending, or an
    // admin/marketing account. Remove any stale directory entry.
    await deleteDoc(ref).catch(() => {});
  }
}

// Live list of staff eligible to be tagged on payroll-related expenses,
// sourced from the read-restricted `staff_directory` collection (safe for
// cashier-role reads — see syncStaffDirectory above for what populates it).
export function useStaffOptions(): StaffDirectoryEntry[] {
  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'staff_directory'),
      snap => {
        const list = snap.docs
          .map(d => d.data() as StaffDirectoryEntry)
          .sort((a, b) => a.name.localeCompare(b.name));
        setStaff(list);
      },
      err => console.error('useStaffOptions error:', err)
    );
    return unsub;
  }, []);

  return staff;
}

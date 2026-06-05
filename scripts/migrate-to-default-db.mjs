/**
 * One-time migration: copy menu, categories, custom_meals
 * from the named AI Studio database to the default database.
 * Run via GitHub Actions — see .github/workflows/migrate.yml
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const NAMED_DB = 'ai-studio-88dfc183-b7e7-45b8-b831-62b1a7bbdb29';
const COLLECTIONS = ['menu', 'categories', 'custom_meals'];

const app = initializeApp({ projectId: 'cajun-life-cafe' });
const sourceDb = getFirestore(app, NAMED_DB);
const targetDb = getFirestore(app);

async function migrateCollection(name) {
  console.log(`\nMigrating: ${name}`);
  const snapshot = await sourceDb.collection(name).get();
  if (snapshot.empty) { console.log(`  Empty — skipping`); return 0; }

  // Write in batches of 500 (Firestore limit)
  const docs = snapshot.docs;
  let count = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = targetDb.batch();
    for (const doc of docs.slice(i, i + 500)) {
      batch.set(targetDb.collection(name).doc(doc.id), doc.data());
      console.log(`  Queued: ${doc.id} — ${doc.data().name || doc.data().firstName || ''}`);
      count++;
    }
    await batch.commit();
  }
  console.log(`  ✓ ${count} documents migrated`);
  return count;
}

let total = 0;
for (const col of COLLECTIONS) total += await migrateCollection(col);
console.log(`\n✓ Done. ${total} total documents copied to default database.`);

/**
 * Full migration: copy ALL collections from named Enterprise DB to default DB
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const NAMED_DB = 'ai-studio-88dfc183-b7e7-45b8-b831-62b1a7bbdb29';

// All collections to migrate
const COLLECTIONS = [
  'menu',
  'categories', 
  'custom_meals',
  'crm_customers',
  'loyalty_customers',
  'activation_tokens',
  'users',
  'finance_categories',
  'finance_entries',
  'finance_expenses',
  'finance_incomes',
  'finance_ingredients',
  'employees',
  'payroll_summaries',
  'system_logs',
  'settings',
  'otpCodes',
];

const app = initializeApp({ projectId: 'cajun-life-cafe' });
const sourceDb = getFirestore(app, NAMED_DB);
const targetDb = getFirestore(app);

async function migrateCollection(name) {
  console.log(`\nMigrating: ${name}`);
  const snapshot = await sourceDb.collection(name).get();
  if (snapshot.empty) { console.log(`  Empty — skipping`); return 0; }

  const docs = snapshot.docs;
  let count = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = targetDb.batch();
    for (const docSnap of docs.slice(i, i + 500)) {
      batch.set(targetDb.collection(name).doc(docSnap.id), docSnap.data());
      count++;
    }
    await batch.commit();
  }

  // Also migrate subcollections for crm_customers and loyalty_customers
  if (name === 'crm_customers' || name === 'loyalty_customers') {
    for (const docSnap of docs) {
      const subSnap = await sourceDb.collection(name).doc(docSnap.id).collection('transactions').get();
      if (!subSnap.empty) {
        const subBatch = targetDb.batch();
        for (const tx of subSnap.docs) {
          subBatch.set(
            targetDb.collection(name).doc(docSnap.id).collection('transactions').doc(tx.id),
            tx.data()
          );
        }
        await subBatch.commit();
        console.log(`  + ${subSnap.size} transactions for ${docSnap.id}`);
      }
    }
  }

  console.log(`  ✓ ${count} documents`);
  return count;
}

let total = 0;
for (const col of COLLECTIONS) {
  try {
    total += await migrateCollection(col);
  } catch (err) {
    console.log(`  SKIP (${err.code}): ${col}`);
  }
}
console.log(`\n✓ Complete. ${total} documents migrated to default database.`);

import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

const DB_NAME = 'finance-tracker';
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Расходы
        const expenses = db.createObjectStore('expenses', { keyPath: 'id' });
        expenses.createIndex('date', 'date');
        expenses.createIndex('category', 'category');
        expenses.createIndex('bank', 'bank');
        expenses.createIndex('createdAt', 'createdAt');
        expenses.createIndex('synced', 'synced');

        // Бюджеты по месяцам
        db.createObjectStore('budgets', { keyPath: 'id' });

        // Настройки
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// ==================== РАСХОДЫ ====================

export async function addExpense(expense) {
  const db = await getDb();
  await db.put('expenses', expense);
  return expense;
}

export async function getExpense(id) {
  const db = await getDb();
  return db.get('expenses', id);
}

export async function deleteExpense(id) {
  const db = await getDb();
  await db.delete('expenses', id);
}

export async function getAllExpenses() {
  const db = await getDb();
  return db.getAll('expenses');
}

export async function getExpensesByMonth(monthKey) {
  const db = await getDb();
  const all = await db.getAll('expenses');
  return all.filter(e => e.date.startsWith(monthKey));
}

export async function getExpensesByDateRange(from, to) {
  const db = await getDb();
  const all = await db.getAll('expenses');
  return all.filter(e => e.date >= from && e.date <= to);
}

export async function getUnsyncedExpenses() {
  const db = await getDb();
  const all = await db.getAll('expenses');
  return all.filter(e => !e.synced);
}

export async function markSynced(ids) {
  const db = await getDb();
  const tx = db.transaction('expenses', 'readwrite');
  for (const id of ids) {
    const exp = await tx.store.get(id);
    if (exp) {
      exp.synced = true;
      await tx.store.put(exp);
    }
  }
  await tx.done;
}

export async function importExpenses(expenses) {
  const db = await getDb();
  const tx = db.transaction('expenses', 'readwrite');
  const existing = await tx.store.getAll();
  const existingIds = new Set(existing.map(e => e.id));
  let added = 0;
  for (const exp of expenses) {
    if (!existingIds.has(exp.id)) {
      await tx.store.put({ ...exp, synced: true });
      added++;
    }
  }
  await tx.done;
  return added;
}

// ==================== БЮДЖЕТЫ ====================

export async function getBudget(monthKey) {
  const db = await getDb();
  return db.get('budgets', monthKey);
}

export async function saveBudget(budget) {
  const db = await getDb();
  await db.put('budgets', budget);
}

// ==================== НАСТРОЙКИ ====================

export async function getSetting(key) {
  const db = await getDb();
  const s = await db.get('settings', key);
  return s ? s.value : null;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.put('settings', { key, value });
}

// ==================== МЕСТА (автокомплит) ====================

export async function getRecentPlaces(limit = 20) {
  const db = await getDb();
  const all = await db.getAll('expenses');
  const places = {};
  all.forEach(e => {
    if (e.place) places[e.place] = (places[e.place] || 0) + 1;
  });
  return Object.entries(places)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([p]) => p);
}

// ==================== ОЧИСТКА ====================

export async function clearAllData() {
  const db = await getDb();
  const tx1 = db.transaction('expenses', 'readwrite');
  await tx1.store.clear();
  await tx1.done;
  const tx2 = db.transaction('budgets', 'readwrite');
  await tx2.store.clear();
  await tx2.done;
  const tx3 = db.transaction('settings', 'readwrite');
  await tx3.store.clear();
  await tx3.done;
}

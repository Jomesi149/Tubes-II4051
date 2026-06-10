import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from './firebase';
import {
  appendWasteRecord,
  appendSalesRecord,
  clearWasteLog,
  getIngredientPrices,
  getSalesHistory,
  getStockData,
  getWasteLog,
  initializeIfNeeded,
  saveIngredientPrices,
  saveStockData,
} from './storage';
import type { IngredientPrices, SalesRecord, StockData, WasteRecord } from './types';

const STATE_COLLECTION = 'appState';
const STATE_DOC = 'main';

// Fungsi helper untuk mengambil semua data sinkron (fallback)
async function getFallbackSnapshot() {
  return {
    salesHistory: await getSalesHistory(),
    stockData: await getStockData(),
    ingredientPrices: await getIngredientPrices(),
    wasteLog: await getWasteLog(),
  };
}

async function readSnapshot() {
  if (!isFirebaseConfigured()) return getFallbackSnapshot();

  const db = getFirebaseDb();
  if (!db) return getFallbackSnapshot();

  const ref = doc(db, STATE_COLLECTION, STATE_DOC);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const initial = await getFallbackSnapshot();
    await setDoc(ref, initial);
    return initial;
  }

  return snapshot.data() as any;
}

async function writeSnapshot(next: any): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const db = getFirebaseDb();
  if (!db) return;
  await setDoc(doc(db, STATE_COLLECTION, STATE_DOC), next);
}

export async function initializeBackendStore(): Promise<void> {
  await initializeIfNeeded();
}

export async function loadSalesHistory(): Promise<SalesRecord[]> {
  const snapshot = await readSnapshot();
  return snapshot.salesHistory || [];
}

export async function persistSalesRecord(record: SalesRecord): Promise<void> {
  const snapshot = await readSnapshot();
  const next = [...(snapshot.salesHistory || [])];
  const index = next.findIndex((item) => item.date === record.date);
  if (index >= 0) next[index] = record;
  else next.push(record);

  await writeSnapshot({ ...snapshot, salesHistory: next });
  await appendSalesRecord(record);
}

export async function loadStockData(): Promise<StockData> {
  const snapshot = await readSnapshot();
  return snapshot.stockData || {};
}

export async function persistStockData(data: StockData): Promise<void> {
  const snapshot = await readSnapshot();
  await writeSnapshot({ ...snapshot, stockData: data });
  await saveStockData(data);
}

export async function loadIngredientPricesBackend(): Promise<IngredientPrices> {
  const snapshot = await readSnapshot();
  return snapshot.ingredientPrices || {};
}

export async function persistIngredientPrices(prices: IngredientPrices): Promise<void> {
  const snapshot = await readSnapshot();
  await writeSnapshot({ ...snapshot, ingredientPrices: prices });
  await saveIngredientPrices(prices);
}

export async function loadWasteLog(): Promise<WasteRecord[]> {
  const snapshot = await readSnapshot();
  return snapshot.wasteLog || [];
}

export async function persistWasteRecord(record: WasteRecord): Promise<void> {
  const snapshot = await readSnapshot();
  const next = [...(snapshot.wasteLog || [])];
  const index = next.findIndex((item) => item.date === record.date);
  if (index >= 0) {
    next[index] = {
      ...next[index],
      items: [...next[index].items, ...record.items],
      total_daily_loss: next[index].total_daily_loss + record.total_daily_loss,
    };
  } else {
    next.push(record);
  }

  await writeSnapshot({ ...snapshot, wasteLog: next });
  await appendWasteRecord(record);
}

export async function clearWasteLogBackend(): Promise<void> {
  const snapshot = await readSnapshot();
  await writeSnapshot({ ...snapshot, wasteLog: [] });
  await clearWasteLog();
}
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

type BackendSnapshot = {
  salesHistory: SalesRecord[];
  stockData: StockData;
  ingredientPrices: IngredientPrices;
  wasteLog: WasteRecord[];
};

const STATE_COLLECTION = 'appState';
const STATE_DOC = 'main';

function getDefaultSnapshot(): BackendSnapshot {
  return {
    salesHistory: getSalesHistory(),
    stockData: getStockData(),
    ingredientPrices: getIngredientPrices(),
    wasteLog: getWasteLog(),
  };
}

async function readSnapshot(): Promise<BackendSnapshot> {
  if (!isFirebaseConfigured()) {
    return getDefaultSnapshot();
  }

  const db = getFirebaseDb();
  if (!db) {
    return getDefaultSnapshot();
  }

  const ref = doc(db, STATE_COLLECTION, STATE_DOC);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const initial = getDefaultSnapshot();
    await setDoc(ref, initial);
    return initial;
  }

  const data = snapshot.data() as Partial<BackendSnapshot>;
  return {
    salesHistory: Array.isArray(data.salesHistory) ? (data.salesHistory as SalesRecord[]) : [],
    stockData: data.stockData && typeof data.stockData === 'object' ? (data.stockData as StockData) : {},
    ingredientPrices:
      data.ingredientPrices && typeof data.ingredientPrices === 'object'
        ? (data.ingredientPrices as IngredientPrices)
        : {},
    wasteLog: Array.isArray(data.wasteLog) ? (data.wasteLog as WasteRecord[]) : [],
  };
}

async function writeSnapshot(next: BackendSnapshot): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  await setDoc(doc(db, STATE_COLLECTION, STATE_DOC), next);
}

export async function initializeBackendStore(): Promise<void> {
  initializeIfNeeded();
  if (!isFirebaseConfigured()) {
    return;
  }

  await readSnapshot();
}

export async function loadSalesHistory(): Promise<SalesRecord[]> {
  const snapshot = await readSnapshot();
  return snapshot.salesHistory;
}

export async function persistSalesRecord(record: SalesRecord): Promise<void> {
  const snapshot = await readSnapshot();
  const next = [...snapshot.salesHistory];
  const index = next.findIndex((item) => item.date === record.date);
  if (index >= 0) {
    next[index] = record;
  } else {
    next.push(record);
  }

  await writeSnapshot({ ...snapshot, salesHistory: next });
  appendSalesRecord(record);
}

export async function loadStockData(): Promise<StockData> {
  const snapshot = await readSnapshot();
  return snapshot.stockData;
}

export async function persistStockData(data: StockData): Promise<void> {
  const snapshot = await readSnapshot();
  await writeSnapshot({ ...snapshot, stockData: data });
  saveStockData(data);
}

export async function loadIngredientPricesBackend(): Promise<IngredientPrices> {
  const snapshot = await readSnapshot();
  return snapshot.ingredientPrices;
}

export async function persistIngredientPrices(prices: IngredientPrices): Promise<void> {
  const snapshot = await readSnapshot();
  await writeSnapshot({ ...snapshot, ingredientPrices: prices });
  saveIngredientPrices(prices);
}

export async function loadWasteLog(): Promise<WasteRecord[]> {
  const snapshot = await readSnapshot();
  return snapshot.wasteLog;
}

export async function persistWasteRecord(record: WasteRecord): Promise<void> {
  const snapshot = await readSnapshot();
  const next = [...snapshot.wasteLog];
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
  appendWasteRecord(record);
}

export async function clearWasteLogBackend(): Promise<void> {
  await writeSnapshot({ ...(await readSnapshot()), wasteLog: [] });
  clearWasteLog();
}

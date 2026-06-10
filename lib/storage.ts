'use client';

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type {
  MenuItem,
  SalesRecord,
  StockData,
  IngredientPrices,
  WasteRecord,
  DayCondition,
} from './types';

const KEYS = {
  menu: 'ventore_menu_list',
  sales: 'ventore_sales_history',
  stock: 'ventore_stock_data',
  prices: 'ventore_ingredient_prices',
  waste: 'ventore_waste_log',
  initialized: 'ventore_initialized',
  schemaVersion: 'ventore_schema_version',
};

const RECIPE_IMPORT_MARKER = 'ventore_recipe_imported';
const MODEL_STATUS_KEY = 'ventore_model_training_status';

const CURRENT_SCHEMA_VERSION = '5';

export type ModelTrainingStatus = 'idle' | 'training' | 'ready' | 'error';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const SEED_MENUS: MenuItem[] = [
  {
    id: 'nasi_goreng',
    name: 'Nasi Goreng',
    recipe: { beras: 200, telur: 1, minyak_goreng: 15, bawang_putih: 5, kecap_manis: 10, garam: 2 },
  },
  {
    id: 'mie_goreng',
    name: 'Mie Goreng Spesial',
    recipe: { mie_instan: 1, telur: 1, sawi: 30, kol: 20, bawang_putih: 5, cabai: 3 },
  },
  {
    id: 'soto_ayam',
    name: 'Soto Ayam',
    recipe: { ayam: 80, bawang_putih: 5, bawang_merah: 5, kol: 20, daun_bawang: 5, air: 300, garam: 2 },
  },
  {
    id: 'bakso_sapi',
    name: 'Bakso Sapi',
    recipe: { daging_sapi: 70, mie_bihun: 50, bawang_putih: 5, daun_bawang: 5, air: 300, garam: 2 },
  },
  {
    id: 'sate_ayam',
    name: 'Sate Ayam',
    recipe: { ayam: 100, tusuk_sate: 1, bumbu_kacang: 30, kecap_manis: 10, garam: 2 },
  },
  {
    id: 'ayam_geprek',
    name: 'Ayam Geprek',
    recipe: { ayam: 100, tepung_terigu: 30, cabai: 5, garam: 2, minyak_goreng: 15 },
  },
  {
    id: 'gorengan',
    name: 'Gorengan',
    recipe: { tepung_terigu: 50, minyak_goreng: 20, garam: 1, air: 30 },
  },
  {
    id: 'es_teh_manis',
    name: 'Es Teh Manis',
    recipe: { teh_celup: 1, gula: 15, air: 250, es_batu: 50 },
  },
  {
    id: 'es_jeruk',
    name: 'Es Jeruk',
    recipe: { jeruk: 1, gula: 10, air: 250, es_batu: 50 },
  },
  {
    id: 'kopi_susu',
    name: 'Kopi Susu',
    recipe: { kopi_bubuk: 10, susu: 50, gula: 10, air: 200, es_batu: 50 },
  },
];

const SEED_PRICES: IngredientPrices = {
  beras: 15, telur: 2500, minyak_goreng: 18, bawang_putih: 35, kecap_manis: 8, garam: 2,
  mie_instan: 3500, sawi: 8, kol: 6, cabai: 25, ayam: 35, bawang_merah: 30, daun_bawang: 15,
  air: 1, daging_sapi: 80, mie_bihun: 12, mie_basah: 10, tusuk_sate: 150, bumbu_kacang: 20,
  tepung_terigu: 14, teh_celup: 250, gula: 12, es_batu: 1, jeruk: 2000, kopi_bubuk: 90, susu: 18,
};

function getCurrentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('ventore-auth-user');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { user_id?: string };
    return parsed.user_id ?? '';
  } catch {
    return '';
  }
}

function notifyModelStatusChanged(status: ModelTrainingStatus): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ventore-model-status-changed', { detail: status }));
  }
}

function getScopedKey(key: string): string {
  const userId = getCurrentUserId();
  return userId ? `${key}:${userId}` : key;
}

// Handler Asinkron Pembacaan Lapisan Cloud Firestore & Local Fallback
async function readCloudField<T>(fieldKey: string, localStorageKey: string, fallback: T): Promise<T> {
  try {
    if (db) {
      const userId = getCurrentUserId();
      if (userId) {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data[fieldKey] !== undefined) return data[fieldKey] as T;
        }
      }
    }
  } catch (err) {
    console.warn("Firebase offline, menggunakan penyimpanan lokal.", err);
  }

  try {
    const scopedKey = getScopedKey(localStorageKey);
    const raw = localStorage.getItem(scopedKey);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Handler Asinkron Penulisan Lapisan Cloud Firestore & Local Fallback
async function writeCloudField<T>(fieldKey: string, localStorageKey: string, value: T): Promise<void> {
  try {
    if (db) {
      const userId = getCurrentUserId();
      if (userId) {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, { [fieldKey]: value }, { merge: true });
      }
    }
  } catch (err) {
    console.error("Gagal sinkronisasi data ke Firebase Cloud:", err);
  }

  try {
    const scopedKey = getScopedKey(localStorageKey);
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// --- CORE ASYNC EXPORT FUNCTIONS ---

export async function getModelTrainingStatus(): Promise<ModelTrainingStatus> {
  return readCloudField<ModelTrainingStatus>('modelTrainingStatus', MODEL_STATUS_KEY, 'idle');
}

export async function setModelTrainingStatus(status: ModelTrainingStatus): Promise<void> {
  await writeCloudField('modelTrainingStatus', MODEL_STATUS_KEY, status);
  notifyModelStatusChanged(status);
}

export async function isSalesUploadCompleted(): Promise<boolean> {
  return (await getModelTrainingStatus()) === 'ready';
}

export async function markModelTrainingInProgress(): Promise<void> {
  await setModelTrainingStatus('training');
}

export async function markSalesUploadCompleted(): Promise<void> {
  await setModelTrainingStatus('ready');
}

export async function markModelTrainingError(): Promise<void> {
  await setModelTrainingStatus('error');
}

export async function resetModelTrainingStatus(): Promise<void> {
  await setModelTrainingStatus('idle');
}

// KEMBALIKAN FUNGSI PEMBERSIH UNTUK FORM WASTE LOG OPERASIONAL
export async function clearHistoricalData(): Promise<void> {
  await writeCloudField('salesHistory', KEYS.sales, []);
  await writeCloudField('wasteLog', KEYS.waste, []);
}

// KEMBALIKAN FUNGSI INITIALIZATION DUMMY VALUE BIAR TIDAK CRASH SAAT BUILD NEXT.JS
export async function initializeIfNeeded(): Promise<void> {
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem(KEYS.initialized)) {
      localStorage.setItem(KEYS.initialized, '1');
    }
  }
}

export async function getMenuList(): Promise<MenuItem[]> {
  const current = await readCloudField<MenuItem[]>('menuList', KEYS.menu, []);
  if (!current || current.length === 0) return SEED_MENUS;
  return current;
}

export async function saveMenuList(menus: MenuItem[]): Promise<void> {
  await writeCloudField('menuList', KEYS.menu, menus);
  await writeCloudField('recipeImportedMarker', RECIPE_IMPORT_MARKER, '1');
}

export async function hasPersonalRecipeData(): Promise<boolean> {
  const marker = await readCloudField<string>('recipeImportedMarker', RECIPE_IMPORT_MARKER, '0');
  return marker === '1';
}

export async function getSalesHistory(): Promise<SalesRecord[]> {
  return readCloudField<SalesRecord[]>('salesHistory', KEYS.sales, []);
}

export async function appendSalesRecord(record: SalesRecord): Promise<void> {
  const history = await getSalesHistory();
  const idx = history.findIndex((r) => r.date === record.date);
  if (idx >= 0) history[idx] = record;
  else history.push(record);
  await writeCloudField('salesHistory', KEYS.sales, history);
}

export async function getStockData(): Promise<StockData> {
  return readCloudField<StockData>('stockData', KEYS.stock, {});
}

export async function saveStockData(data: StockData): Promise<void> {
  await writeCloudField('stockData', KEYS.stock, data);
}

export async function getIngredientPrices(): Promise<IngredientPrices> {
  return readCloudField<IngredientPrices>('ingredientPrices', KEYS.prices, SEED_PRICES);
}

export async function saveIngredientPrices(prices: IngredientPrices): Promise<void> {
  await writeCloudField('ingredientPrices', KEYS.prices, prices);
}

export async function getWasteLog(): Promise<WasteRecord[]> {
  return readCloudField<WasteRecord[]>('wasteLog', KEYS.waste, []);
}

export async function appendWasteRecord(record: WasteRecord): Promise<void> {
  const log = await getWasteLog();
  const idx = log.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    log[idx].items.push(...record.items);
    log[idx].total_daily_loss += record.total_daily_loss;
  } else {
    log.push(record);
  }
  await writeCloudField('wasteLog', KEYS.waste, log);
}

export async function clearWasteLog(): Promise<void> {
  await writeCloudField('wasteLog', KEYS.waste, []);
}

export const formatRp = (value: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const todayString = (): string => new Date().toISOString().split('T')[0];
export const DAY_NAMES_EXPORTED = DAY_NAMES;
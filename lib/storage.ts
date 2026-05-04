import type {
  MenuItem,
  SalesRecord,
  StockData,
  IngredientPrices,
  WasteRecord,
  DayCondition,
} from './types';
import { MODEL_MENU } from './model-prediction';

const KEYS = {
  menu: 'ventore_menu_list',
  sales: 'ventore_sales_history',
  stock: 'ventore_stock_data',
  prices: 'ventore_ingredient_prices',
  waste: 'ventore_waste_log',
  initialized: 'ventore_initialized',
  schemaVersion: 'ventore_schema_version',
};

const CURRENT_SCHEMA_VERSION = '2';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const CONDITIONS: DayCondition[] = ['Normal', 'Normal', 'Normal', 'Ramai', 'Normal', 'Hujan', 'Normal', 'Normal', 'Ramai', 'Normal', 'Normal', 'Normal', 'Normal', 'Normal'];

function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function dayName(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return DAY_NAMES[d.getDay()];
}

const SEED_MENUS: MenuItem[] = MODEL_MENU.map((m) => ({
  id: m.id,
  name: m.name,
  // Minimal placeholder recipe — user can edit ingredient mapping later
  recipe: {},
}));

const SEED_PRICES: IngredientPrices = {
  beras: 12,
  telur: 1500,
  minyak_goreng: 20,
  mie_basah: 10,
  ayam: 35,
  kaldu: 5,
  teh: 50,
  gula: 12,
  air: 0,
};

function generateSeedSales(): SalesRecord[] {
  const records: SalesRecord[] = [];
  for (let i = 14; i >= 1; i--) {
    const condition = CONDITIONS[i - 1] ?? 'Normal';
    const multiplier = condition === 'Ramai' ? 1.25 : condition === 'Hujan' ? 0.8 : 1.0;
    const sales: Record<string, number> = {};

    SEED_MENUS.forEach((menu, idx) => {
      // base mean varies slightly by index to create realistic variety
      const mean = 25 + idx * 3;
      const std = Math.max(3, Math.round(mean * 0.15));
      const raw = mean * multiplier + (Math.random() - 0.5) * std * 2;
      sales[menu.id] = Math.max(0, Math.round(raw));
    });

    records.push({
      date: dateString(i),
      day_of_week: dayName(i),
      condition,
      sales,
    });
  }
  return records;
}

function generateSeedWaste(): WasteRecord[] {
  return [
    {
      date: dateString(7),
      items: [
        { ingredient: 'beras', quantity: 500, unit: 'gram', reason: 'Sisa Produksi', unit_price: 12, total_loss: 6000 },
      ],
      total_daily_loss: 6000,
    },
    {
      date: dateString(3),
      items: [
        { ingredient: 'ayam', quantity: 200, unit: 'gram', reason: 'Kedaluwarsa', unit_price: 35, total_loss: 7000 },
        { ingredient: 'mie_basah', quantity: 300, unit: 'gram', reason: 'Sisa Produksi', unit_price: 10, total_loss: 3000 },
      ],
      total_daily_loss: 10000,
    },
  ];
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage quota exceeded — silent fail for MVP
  }
}

function isModelMenuList(value: MenuItem[] | null | undefined): boolean {
  if (!value || value.length !== SEED_MENUS.length) {
    return false;
  }

  return SEED_MENUS.every((menu, index) => value[index]?.id === menu.id);
}

function migrateMenuListIfNeeded(): MenuItem[] {
  const current = read<MenuItem[]>(KEYS.menu, []);

  if (!isModelMenuList(current)) {
    write(KEYS.menu, SEED_MENUS);
    localStorage.setItem(KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
    return SEED_MENUS;
  }

  localStorage.setItem(KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
  return current;
}

export function initializeIfNeeded(): void {
  const currentVersion = localStorage.getItem(KEYS.schemaVersion);

  if (currentVersion !== CURRENT_SCHEMA_VERSION) {
    migrateMenuListIfNeeded();
    localStorage.setItem(KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
  }

  if (!localStorage.getItem(KEYS.initialized)) {
    write(KEYS.sales, generateSeedSales());
    write(KEYS.prices, SEED_PRICES);
    write(KEYS.waste, generateSeedWaste());
    write(KEYS.stock, {});
    localStorage.setItem(KEYS.initialized, '1');
  }
}

export function getMenuList(): MenuItem[] {
  return migrateMenuListIfNeeded();
}

export function saveMenuList(menus: MenuItem[]): void {
  write(KEYS.menu, menus);
}

export function getSalesHistory(): SalesRecord[] {
  return read<SalesRecord[]>(KEYS.sales, []);
}

export function appendSalesRecord(record: SalesRecord): void {
  const history = getSalesHistory();
  // replace existing record for same date if any
  const idx = history.findIndex((r) => r.date === record.date);
  if (idx >= 0) history[idx] = record;
  else history.push(record);
  write(KEYS.sales, history);
}

export function getStockData(): StockData {
  return read<StockData>(KEYS.stock, {});
}

export function saveStockData(data: StockData): void {
  write(KEYS.stock, data);
}

export function getIngredientPrices(): IngredientPrices {
  return read<IngredientPrices>(KEYS.prices, SEED_PRICES);
}

export function saveIngredientPrices(prices: IngredientPrices): void {
  write(KEYS.prices, prices);
}

export function getWasteLog(): WasteRecord[] {
  return read<WasteRecord[]>(KEYS.waste, []);
}

export function appendWasteRecord(record: WasteRecord): void {
  const log = getWasteLog();
  const idx = log.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    log[idx].items.push(...record.items);
    log[idx].total_daily_loss += record.total_daily_loss;
  } else {
    log.push(record);
  }
  write(KEYS.waste, log);
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

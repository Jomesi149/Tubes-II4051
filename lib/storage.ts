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
};

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

const SEED_MENUS: MenuItem[] = [
  {
    id: 'nasi_goreng',
    name: 'Nasi Goreng',
    recipe: { beras: 200, telur: 1, minyak_goreng: 15 },
  },
  {
    id: 'mie_ayam',
    name: 'Mie Ayam',
    recipe: { mie_basah: 150, ayam: 80, kaldu: 200 },
  },
  {
    id: 'es_teh',
    name: 'Es Teh',
    recipe: { teh: 5, gula: 20, air: 300 },
  },
];

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
  const base = [
    { id: 'nasi_goreng', mean: 42, std: 6 },
    { id: 'mie_ayam', mean: 26, std: 4 },
    { id: 'es_teh', mean: 65, std: 8 },
  ];
  const records: SalesRecord[] = [];
  for (let i = 14; i >= 1; i--) {
    const condition = CONDITIONS[i - 1];
    const multiplier = condition === 'Ramai' ? 1.25 : condition === 'Hujan' ? 0.80 : 1.0;
    const sales: Record<string, number> = {};
    for (const menu of base) {
      const raw = menu.mean * multiplier + (Math.random() - 0.5) * menu.std * 2;
      sales[menu.id] = Math.max(0, Math.round(raw));
    }
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

export function initializeIfNeeded(): void {
  if (localStorage.getItem(KEYS.initialized)) return;
  write(KEYS.menu, SEED_MENUS);
  write(KEYS.sales, generateSeedSales());
  write(KEYS.prices, SEED_PRICES);
  write(KEYS.waste, generateSeedWaste());
  write(KEYS.stock, {});
  localStorage.setItem(KEYS.initialized, '1');
}

export function getMenuList(): MenuItem[] {
  return read<MenuItem[]>(KEYS.menu, SEED_MENUS);
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

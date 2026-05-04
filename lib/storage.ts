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

const CURRENT_SCHEMA_VERSION = '5';

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
    recipe: {
      beras: 200,
      telur: 1,
      minyak_goreng: 15,
      bawang_putih: 5,
      kecap_manis: 10,
      garam: 2,
    },
  },
  {
    id: 'mie_goreng',
    name: 'Mie Goreng Spesial',
    recipe: {
      mie_instan: 1,
      telur: 1,
      sawi: 30,
      kol: 20,
      bawang_putih: 5,
      cabai: 3,
    },
  },
  {
    id: 'soto_ayam',
    name: 'Soto Ayam',
    recipe: {
      ayam: 80,
      bawang_putih: 5,
      bawang_merah: 5,
      kol: 20,
      daun_bawang: 5,
      air: 300,
      garam: 2,
    },
  },
  {
    id: 'bakso_sapi',
    name: 'Bakso Sapi',
    recipe: {
      daging_sapi: 70,
      mie_bihun: 50,
      bawang_putih: 5,
      daun_bawang: 5,
      air: 300,
      garam: 2,
    },
  },
  {
    id: 'sate_ayam',
    name: 'Sate Ayam',
    recipe: {
      ayam: 100,
      tusuk_sate: 1,
      bumbu_kacang: 30,
      kecap_manis: 10,
      garam: 2,
    },
  },
  {
    id: 'ayam_geprek',
    name: 'Ayam Geprek',
    recipe: {
      ayam: 100,
      tepung_terigu: 30,
      cabai: 5,
      garam: 2,
      minyak_goreng: 15,
    },
  },
  {
    id: 'gorengan',
    name: 'Gorengan',
    recipe: {
      tepung_terigu: 50,
      minyak_goreng: 20,
      garam: 1,
      air: 30,
    },
  },
  {
    id: 'es_teh_manis',
    name: 'Es Teh Manis',
    recipe: {
      teh_celup: 1,
      gula: 15,
      air: 250,
      es_batu: 50,
    },
  },
  {
    id: 'es_jeruk',
    name: 'Es Jeruk',
    recipe: {
      jeruk: 1,
      gula: 10,
      air: 250,
      es_batu: 50,
    },
  },
  {
    id: 'kopi_susu',
    name: 'Kopi Susu',
    recipe: {
      kopi_bubuk: 10,
      susu: 50,
      gula: 10,
      air: 200,
      es_batu: 50,
    },
  },
];

const SEED_PRICES: IngredientPrices = {
  beras: 15,
  telur: 2500,
  minyak_goreng: 18,
  bawang_putih: 35,
  kecap_manis: 8,
  garam: 2,
  mie_instan: 3500,
  sawi: 8,
  kol: 6,
  cabai: 25,
  ayam: 35,
  bawang_merah: 30,
  daun_bawang: 15,
  air: 1,
  daging_sapi: 80,
  mie_bihun: 12,
  mie_basah: 10,
  tusuk_sate: 150,
  bumbu_kacang: 20,
  tepung_terigu: 14,
  teh_celup: 250,
  gula: 12,
  es_batu: 1,
  jeruk: 2000,
  kopi_bubuk: 90,
  susu: 18,
};

function migrateIngredientPricesIfNeeded(): IngredientPrices {
  const current = read<IngredientPrices>(KEYS.prices, {});
  const merged: IngredientPrices = { ...SEED_PRICES, ...current };

  const currentKeys = Object.keys(current);
  const missingSeedKeys = Object.keys(SEED_PRICES).some((key) => current[key] === undefined);

  if (currentKeys.length === 0 || missingSeedKeys) {
    write(KEYS.prices, merged);
  }

  return merged;
}

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

  return SEED_MENUS.every((menu, index) => {
    const current = value[index];
    if (!current || current.id !== menu.id) {
      return false;
    }

    const expectedRecipeEntries = Object.entries(menu.recipe);
    const currentRecipeEntries = Object.entries(current.recipe || {});

    if (expectedRecipeEntries.length !== currentRecipeEntries.length) {
      return false;
    }

    return expectedRecipeEntries.every(([ingredient, quantity]) => current.recipe?.[ingredient] === quantity);
  });
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
    migrateIngredientPricesIfNeeded();
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
  return migrateIngredientPricesIfNeeded();
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

export function clearWasteLog(): void {
  write(KEYS.waste, []);
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

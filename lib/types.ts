export type DayCondition = 'Normal' | 'Ramai' | 'Hujan';
export type WasteReason = 'Rusak' | 'Kedaluwarsa' | 'Sisa Produksi';

export interface MenuItem {
  id: string;
  name: string;
  recipe: Record<string, number>; // ingredient → quantity per portion (grams or units)
}

export interface SalesRecord {
  date: string;           // ISO date string YYYY-MM-DD
  day_of_week: string;    // Senin, Selasa, ...
  condition: DayCondition;
  sales: Record<string, number>; // menu id → quantity sold
}

export interface StockData {
  [ingredient: string]: number; // current physical stock
}

export interface IngredientPrices {
  [ingredient: string]: number; // price per unit (Rp)
}

export interface WasteItem {
  ingredient: string;
  quantity: number;
  unit: string;
  reason: WasteReason;
  unit_price: number;
  total_loss: number;
}

export interface WasteRecord {
  date: string;
  items: WasteItem[];
  total_daily_loss: number;
}

export interface RecommendationResult {
  menuId: string;
  menuName: string;
  ma: number;
  final: number;
  rationalization: string;
}

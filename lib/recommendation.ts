import type { SalesRecord, MenuItem, DayCondition, RecommendationResult } from './types';

const CONDITION_MULTIPLIER: Record<DayCondition, number> = {
  Normal: 1.00,
  Ramai: 1.25,
  Hujan: 0.80,
};

const BUFFER_RATE = 0.10;

export function calculateRecommendations(
  history: SalesRecord[],
  menus: MenuItem[],
  condition: DayCondition,
  nDays: number = 7
): RecommendationResult[] {
  const recent = history.slice(-nDays);
  const multiplier = CONDITION_MULTIPLIER[condition];

  return menus.map((menu) => {
    const totalSales = recent.reduce((sum, r) => sum + (r.sales[menu.id] || 0), 0);
    const ma = recent.length > 0 ? totalSales / recent.length : 0;
    const base = ma * (1 + BUFFER_RATE);
    const final = Math.ceil(base * multiplier);

    const rationalization =
      recent.length === 0
        ? 'Belum ada data penjualan. Gunakan estimasi manual.'
        : `Berdasarkan rata-rata ${recent.length} hari terakhir: ${Math.round(ma)} porsi. Dengan buffer ${(BUFFER_RATE * 100).toFixed(0)}% dan kondisi ${condition} → Rekomendasi: ${final} porsi.`;

    return { menuId: menu.id, menuName: menu.name, ma, final, rationalization };
  });
}

export function getTotalRecommendation(results: RecommendationResult[]): number {
  return results.reduce((sum, r) => sum + r.final, 0);
}

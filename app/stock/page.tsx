'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from 'react';
import {
  initializeIfNeeded,
  getMenuList,
  getSalesHistory,
  getStockData,
  saveStockData,
} from '@/lib/storage';
import { calculateRecommendations } from '@/lib/recommendation';
import type { DayCondition, MenuItem, RecommendationResult } from '@/lib/types';

type IngredientStatus = {
  name: string;
  required: number;
  available: number;
  unit: string;
  status: 'aman' | 'kritis';
};

const CONDITIONS: DayCondition[] = ['Normal', 'Ramai', 'Hujan'];

export default function StockPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [condition, setCondition] = useState<DayCondition>('Normal');
  const [stock, setStock] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<IngredientStatus[]>([]);
  const [saved, setSaved] = useState(false);

  // Derive all unique ingredients and their inferred units
  const ingredientUnits: Record<string, string> = {
    beras: 'gram',
    telur: 'butir',
    minyak_goreng: 'ml',
    mie_basah: 'gram',
    ayam: 'gram',
    kaldu: 'ml',
    teh: 'gram',
    gula: 'gram',
    air: 'ml',
  };

  function recalcStatuses() {
    const required: Record<string, number> = {};
    for (const rec of recommendations) {
      const menu = menus.find((m) => m.id === rec.menuId);
      if (!menu) continue;
      for (const [ing, perPortion] of Object.entries(menu.recipe)) {
        required[ing] = (required[ing] ?? 0) + rec.final * perPortion;
      }
    }

    const result: IngredientStatus[] = Object.entries(required).map(([ing, req]) => {
      const available = parseFloat(stock[ing] || '0') || 0;
      return {
        name: ing,
        required: Math.ceil(req),
        available,
        unit: ingredientUnits[ing] ?? 'unit',
        status: available >= req ? 'aman' : 'kritis',
      };
    });

    result.sort((a, b) => {
      if (a.status === 'kritis' && b.status !== 'kritis') return -1;
      if (a.status !== 'kritis' && b.status === 'kritis') return 1;
      return a.name.localeCompare(b.name);
    });

    setStatuses(result);
  }

  useEffect(() => {
    initializeIfNeeded();
    const m = getMenuList();
    setMenus(m);
    const history = getSalesHistory();
    const recs = calculateRecommendations(history, m, condition, 7);
    setRecommendations(recs);

    const saved = getStockData();
    const allIngredients = new Set<string>();
    m.forEach((menu) => Object.keys(menu.recipe).forEach((ing) => allIngredients.add(ing)));
    const initial: Record<string, string> = {};
    allIngredients.forEach((ing) => {
      initial[ing] = saved[ing] !== undefined ? String(saved[ing]) : '';
    });
    setStock(initial);
  }, []);

  useEffect(() => {
    if (menus.length === 0 || recommendations.length === 0) return;
    recalcStatuses();
  }, [recommendations, stock, menus]);

  useEffect(() => {
    if (menus.length === 0) return;
    const history = getSalesHistory();
    const recs = calculateRecommendations(history, menus, condition, 7);
    setRecommendations(recs);
  }, [condition, menus]);

  const handleSave = () => {
    const stockData: Record<string, number> = {};
    Object.entries(stock).forEach(([ing, val]) => {
      stockData[ing] = parseFloat(val) || 0;
    });
    saveStockData(stockData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const criticalCount = statuses.filter((s) => s.status === 'kritis').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-1">
          Modul 4
        </p>
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Stok & Alert</h1>
        <p className="text-[16px] text-ink-muted mt-1">
          Pantau ketersediaan bahan baku vs kebutuhan produksi
        </p>
      </div>

      {/* Condition selector */}
      <div className="mb-6 flex items-center gap-4">
        <p className="text-[14px] text-ink-subtle">Kondisi hari:</p>
        <div className="flex gap-2 bg-canvas rounded-full p-1 w-fit border border-hairline">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              className={`px-[14px] py-1.5 rounded-full text-[14px] font-medium transition-colors ${
                condition === c ? 'bg-surface-2 text-ink' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock input form */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-1">
            Stok Fisik Saat Ini
          </h2>
          <p className="text-[14px] text-ink-subtle mb-6">Masukkan jumlah stok yang tersedia</p>

          <div className="space-y-3">
            {Object.keys(stock).map((ing) => (
              <div key={ing} className="flex items-center gap-3">
                <span className="flex-1 text-[16px] text-ink capitalize">
                  {ing.replace(/_/g, ' ')}
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={stock[ing]}
                  onChange={(e) => setStock((prev) => ({ ...prev, [ing]: e.target.value }))}
                  className="w-28 bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                />
                <span className="text-[14px] text-ink-subtle w-10">
                  {ingredientUnits[ing] ?? 'unit'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="mt-6 w-full px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            {saved ? '✓ Stok Disimpan' : 'Simpan Stok'}
          </button>
        </div>

        {/* Alert table */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px]">
              Status Ketersediaan
            </h2>
            {criticalCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#e5484d]/15 text-[#e5484d] border border-[#e5484d]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e5484d] inline-block" />
                {criticalCount} bahan kritis
              </span>
            ) : statuses.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-success/15 text-success border border-success/20">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Semua aman
              </span>
            ) : null}
          </div>

          {statuses.length === 0 ? (
            <p className="text-[14px] text-ink-subtle">
              Masukkan stok fisik untuk melihat status ketersediaan.
            </p>
          ) : (
            <div className="space-y-0">
              {statuses.map((s, i) => (
                <div
                  key={s.name}
                  className={`py-3.5 ${i < statuses.length - 1 ? 'border-b border-hairline' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-ink capitalize">
                        {s.name.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[13px] text-ink-subtle mt-0.5">
                        Dibutuhkan: {s.required} {s.unit} · Tersedia: {s.available} {s.unit}
                      </p>
                    </div>
                    {s.status === 'kritis' ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#e5484d]/15 text-[#e5484d] border border-[#e5484d]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e5484d]" />
                        Kritis
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium bg-success/15 text-success border border-success/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        Aman
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.status === 'kritis' ? 'bg-[#e5484d]' : 'bg-success'
                      }`}
                      style={{
                        width: `${Math.min(100, s.required > 0 ? (s.available / s.required) * 100 : 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipe mapping reference */}
      <div className="mt-6 bg-surface-1 border border-hairline rounded-xl p-6">
        <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">
          Recipe Mapping
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map((menu) => {
            const rec = recommendations.find((r) => r.menuId === menu.id);
            return (
              <div key={menu.id} className="bg-surface-2 rounded-lg p-4">
                <p className="text-[14px] font-medium text-ink mb-2">{menu.name}</p>
                <p className="text-[12px] text-ink-subtle mb-2">
                  Target: {rec?.final ?? '—'} porsi
                </p>
                {Object.entries(menu.recipe).map(([ing, qty]) => (
                  <div key={ing} className="flex justify-between text-[13px] text-ink-subtle">
                    <span className="capitalize">{ing.replace(/_/g, ' ')}</span>
                    <span className="font-mono">
                      {rec ? rec.final * qty : qty}{' '}
                      {ingredientUnits[ing] ?? 'unit'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

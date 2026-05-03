'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  initializeIfNeeded,
  getMenuList,
  getSalesHistory,
  getStockData,
  getWasteLog,
  formatRp,
} from '@/lib/storage';
import { calculateRecommendations, getTotalRecommendation } from '@/lib/recommendation';
import type { DayCondition } from '@/lib/types';

interface DashboardData {
  totalRecommendation: number;
  criticalIngredients: string[];
  totalWasteLoss: number;
  condition: DayCondition;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    initializeIfNeeded();
    const menus = getMenuList();
    const history = getSalesHistory();
    const stock = getStockData();
    const wasteLog = getWasteLog();

    const condition: DayCondition = 'Normal';
    const recommendations = calculateRecommendations(history, menus, condition, 7);
    const totalRecommendation = getTotalRecommendation(recommendations);

    const criticalIngredients: string[] = [];
    for (const rec of recommendations) {
      const menu = menus.find((m) => m.id === rec.menuId);
      if (!menu) continue;
      for (const [ingredient, perPortion] of Object.entries(menu.recipe)) {
        const required = rec.final * perPortion;
        const available = stock[ingredient] ?? 0;
        if (available < required && !criticalIngredients.includes(ingredient)) {
          criticalIngredients.push(ingredient);
        }
      }
    }

    const totalWasteLoss = wasteLog.reduce((sum, r) => sum + r.total_daily_loss, 0);

    setData({ totalRecommendation, criticalIngredients, totalWasteLoss, condition });
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-subtle text-sm">
        Memuat data...
      </div>
    );
  }

  const hasCritical = data.criticalIngredients.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-1">
          Pusat Kendali
        </p>
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Widget 1: Total Rekomendasi */}
        <Link
          href="/recommendation"
          className="group block bg-surface-1 border border-hairline rounded-lg p-6 hover:bg-surface-2 transition-colors"
        >
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-3">
            Total Rekomendasi Produksi
          </p>
          <p className="text-[40px] font-semibold text-ink tracking-[-1px] leading-none mb-1">
            {data.totalRecommendation}
          </p>
          <p className="text-[14px] text-ink-muted">porsi · kondisi {data.condition}</p>
          <p className="text-[13px] text-primary mt-4 group-hover:text-primary-hover transition-colors">
            Lihat detail →
          </p>
        </Link>

        {/* Widget 2: Indikator Stok */}
        <Link
          href="/stock"
          className="group block bg-surface-1 border border-hairline rounded-lg p-6 hover:bg-surface-2 transition-colors"
        >
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-3">
            Indikator Stok
          </p>
          {hasCritical ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#e5484d]/15 text-[#e5484d] border border-[#e5484d]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e5484d] inline-block" />
                  Kritis
                </span>
              </div>
              <p className="text-[14px] text-ink-muted">
                {data.criticalIngredients.length} bahan kekurangan stok
              </p>
              <ul className="mt-2 space-y-1">
                {data.criticalIngredients.slice(0, 3).map((ing) => (
                  <li key={ing} className="text-[13px] text-[#e5484d]">
                    · {ing.replace(/_/g, ' ')}
                  </li>
                ))}
                {data.criticalIngredients.length > 3 && (
                  <li className="text-[13px] text-ink-tertiary">
                    +{data.criticalIngredients.length - 3} lainnya
                  </li>
                )}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-success/15 text-success border border-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  Aman
                </span>
              </div>
              <p className="text-[14px] text-ink-muted">Semua stok tercukupi</p>
            </>
          )}
          <p className="text-[13px] text-primary mt-4 group-hover:text-primary-hover transition-colors">
            Kelola stok →
          </p>
        </Link>

        {/* Widget 3: Total Waste */}
        <Link
          href="/waste"
          className="group block bg-surface-1 border border-hairline rounded-lg p-6 hover:bg-surface-2 transition-colors"
        >
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-3">
            Total Waste (Periode)
          </p>
          <p className="text-[40px] font-semibold text-ink tracking-[-1px] leading-none mb-1">
            {formatRp(data.totalWasteLoss)}
          </p>
          <p className="text-[14px] text-ink-muted">akumulasi kerugian</p>
          <p className="text-[13px] text-primary mt-4 group-hover:text-primary-hover transition-colors">
            Lihat log waste →
          </p>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-4">
          Aksi Cepat
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sales"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Input Penjualan Hari Ini
          </Link>
          <Link
            href="/waste"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
          >
            Catat Waste
          </Link>
          <Link
            href="/stock"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
          >
            Update Stok
          </Link>
        </div>
      </div>
    </div>
  );
}

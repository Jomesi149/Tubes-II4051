'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getMenuList, getStockData, initializeIfNeeded, saveStockData } from '@/lib/storage';
import type { MenuItem } from '@/lib/types';

export default function StockUsagePage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const ingredientUnits: Record<string, string> = useMemo(
    () => ({
      beras: 'gram',
      telur: 'butir',
      minyak_goreng: 'ml',
      bawang_putih: 'gram',
      kecap_manis: 'ml',
      garam: 'gram',
      mie_instan: 'bungkus',
      sawi: 'gram',
      kol: 'gram',
      cabai: 'gram',
      ayam: 'gram',
      bawang_merah: 'gram',
      daun_bawang: 'gram',
      gula: 'gram',
      air: 'ml',
      daging_sapi: 'gram',
      mie_bihun: 'gram',
      tusuk_sate: 'buah',
      bumbu_kacang: 'gram',
      tepung_terigu: 'gram',
      teh_celup: 'sachet',
      es_batu: 'gram',
      jeruk: 'buah',
      kopi_bubuk: 'gram',
      susu: 'ml',
    }),
    []
  );

  useEffect(() => {
    initializeIfNeeded();
    const loadedMenus = getMenuList();
    setMenus(loadedMenus);

    const savedStock = getStockData();
    const allIngredients = new Set<string>();
    loadedMenus.forEach((menu) => Object.keys(menu.recipe).forEach((ingredient) => allIngredients.add(ingredient)));

    const initialStock: Record<string, string> = {};
    const initialUsage: Record<string, string> = {};
    allIngredients.forEach((ingredient) => {
      initialStock[ingredient] = savedStock[ingredient] !== undefined ? String(savedStock[ingredient]) : '';
      initialUsage[ingredient] = '';
    });

    setStock(initialStock);
    setUsage(initialUsage);
  }, []);

  const handleSaveUsage = () => {
    const nextStock: Record<string, number> = {};

    Object.entries(stock).forEach(([ingredient, currentValue]) => {
      const current = parseFloat(currentValue) || 0;
      const used = parseFloat(usage[ingredient] || '0') || 0;
      nextStock[ingredient] = Math.max(0, current - used);
    });

    saveStockData(nextStock);
    setStock(
      Object.fromEntries(Object.entries(nextStock).map(([ingredient, value]) => [ingredient, String(value)]))
    );
    setUsage(Object.fromEntries(Object.keys(nextStock).map((ingredient) => [ingredient, ''])));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-1">Modul 4</p>
          <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Input Stok Terpakai</h1>
          <p className="text-[16px] text-ink-muted mt-1">Catat pemakaian stok manual hari ini untuk mengurangi persediaan yang tersimpan.</p>
        </div>
        <Link
          href="/stock"
          className="px-[14px] py-2 h-fit rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
        >
          Kembali ke Stok & Alert
        </Link>
      </div>

      <div className="bg-surface-1 border border-hairline rounded-xl p-6">
        <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-1">Stok Hari Ini</h2>
        <p className="text-[14px] text-ink-subtle mb-6">Masukkan jumlah bahan yang dipakai hari ini. Nilai ini akan mengurangi stok yang tersimpan.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Object.keys(stock).map((ingredient) => {
            const current = parseFloat(stock[ingredient] || '0') || 0;
            const used = parseFloat(usage[ingredient] || '0') || 0;
            const remaining = Math.max(0, current - used);

            return (
              <div key={ingredient} className="rounded-lg border border-hairline bg-canvas px-3 py-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="flex-1 text-[15px] text-ink capitalize">{ingredient.replace(/_/g, ' ')}</span>
                  <span className="text-[13px] text-ink-subtle">
                    Sisa: {remaining} {ingredientUnits[ingredient] ?? 'unit'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-ink-subtle mb-1">Stok Saat Ini</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={stock[ingredient]}
                      onChange={(e) => setStock((prev) => ({ ...prev, [ingredient]: e.target.value }))}
                      className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-ink-subtle mb-1">Dipakai Hari Ini</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={usage[ingredient]}
                      onChange={(e) => setUsage((prev) => ({ ...prev, [ingredient]: e.target.value }))}
                      className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                    />
                  </div>
                </div>
                <p className="text-[12px] text-ink-subtle mt-2">
                  {current} {ingredientUnits[ingredient] ?? 'unit'} - {used} {ingredientUnits[ingredient] ?? 'unit'} = {remaining} {ingredientUnits[ingredient] ?? 'unit'}
                </p>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSaveUsage}
          className="mt-6 w-full px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          {saved ? '✓ Pemakaian Tersimpan' : 'Simpan Pemakaian Stok'}
        </button>
      </div>

      <div className="mt-6 bg-surface-1 border border-hairline rounded-xl p-6">
        <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">Menu yang Dipengaruhi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map((menu) => (
            <div key={menu.id} className="bg-surface-2 rounded-lg p-4">
              <p className="text-[14px] font-medium text-ink mb-2">{menu.name}</p>
              {Object.entries(menu.recipe).map(([ingredient, qty]) => (
                <div key={ingredient} className="flex justify-between text-[13px] text-ink-subtle">
                  <span className="capitalize">{ingredient.replace(/_/g, ' ')}</span>
                  <span className="font-mono">
                    {qty} {ingredientUnits[ingredient] ?? 'unit'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
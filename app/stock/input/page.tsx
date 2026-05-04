'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMenuList, getStockData, initializeIfNeeded, saveStockData } from '@/lib/storage';
import type { MenuItem } from '@/lib/types';

export default function StockInputPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const ingredientUnits: Record<string, string> = {
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
  };

  useEffect(() => {
    initializeIfNeeded();
    const m = getMenuList();
    setMenus(m);

    const savedStock = getStockData();
    const allIngredients = new Set<string>();
    m.forEach((menu) => Object.keys(menu.recipe).forEach((ingredient) => allIngredients.add(ingredient)));

    const initial: Record<string, string> = {};
    allIngredients.forEach((ingredient) => {
      initial[ingredient] = savedStock[ingredient] !== undefined ? String(savedStock[ingredient]) : '';
    });
    setStock(initial);
  }, []);

  const handleSave = () => {
    const stockData: Record<string, number> = {};
    Object.entries(stock).forEach(([ingredient, value]) => {
      stockData[ingredient] = parseFloat(value) || 0;
    });
    saveStockData(stockData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-1">Modul 4</p>
          <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Input Stok</h1>
          <p className="text-[16px] text-ink-muted mt-1">Masukkan stok fisik bahan baku yang tersedia untuk hari ini</p>
        </div>
        <Link
          href="/stock"
          className="px-[14px] py-2 h-fit rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
        >
          Kembali ke Stok & Alert
        </Link>
      </div>

      <div className="bg-surface-1 border border-hairline rounded-xl p-6">
        <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-1">Stok Fisik Saat Ini</h2>
        <p className="text-[14px] text-ink-subtle mb-6">Isi jumlah stok untuk bahan yang dipakai oleh resep hari ini.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Object.keys(stock).map((ingredient) => (
            <div key={ingredient} className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2">
              <span className="flex-1 text-[15px] text-ink capitalize">{ingredient.replace(/_/g, ' ')}</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={stock[ingredient]}
                onChange={(e) => setStock((prev) => ({ ...prev, [ingredient]: e.target.value }))}
                className="w-28 bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
              />
              <span className="text-[14px] text-ink-subtle w-10">{ingredientUnits[ingredient] ?? 'unit'}</span>
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

      <div className="mt-6 bg-surface-1 border border-hairline rounded-xl p-6">
        <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">Daftar Menu & Bahan</h2>
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
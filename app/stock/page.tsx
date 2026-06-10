'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import Link from 'next/link';
import {
  getMenuList,
  saveMenuList,
  getStockData,
  hasPersonalRecipeData,
} from '@/lib/storage';
import type { MenuItem, StockData } from '@/lib/types';

export default function StockPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<StockData>({});
  const [isMounted, setIsMounted] = useState(false);
  const [recipeLocked, setRecipeLocked] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  const loadStockRecords = async () => {
    const currentMenus = await getMenuList();
    const currentStock = await getStockData();
    const isLocked = await hasPersonalRecipeData();

    setMenus(currentMenus);
    setStock(currentStock);
    setRecipeLocked(isLocked);
  };

  useEffect(() => {
    void loadStockRecords().then(() => setIsMounted(true));
  }, []);

  const handleRecipeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploadMessage('');

    if (recipeLocked) {
      setUploadError('Struktur resep sudah dikunci.');
      return;
    }

    try {
      const processRows = async (rows: Array<Record<string, unknown>>) => {
        const currentMenus = await getMenuList();
        const recipeMap = new Map<string, Record<string, number>>();

        rows.forEach((row) => {
          const menuId = String(row.menu_id ?? row.menuId ?? '').trim();
          const ingredient = String(row.ingredient_name ?? row.ingredientName ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
          const qty = parseFloat(String(row.quantity_per_portion ?? row.quantityPerPortion ?? '0')) || 0;

          if (menuId && ingredient) {
            if (!recipeMap.has(menuId)) recipeMap.set(menuId, {});
            recipeMap.get(menuId)![ingredient] = qty;
          }
        });

        const updatedMenus = currentMenus.map((menu) => ({
          ...menu,
          recipe: recipeMap.get(menu.id) || {},
        }));

        await saveMenuList(updatedMenus);
        await loadStockRecords();
        setUploadMessage('Struktur resep personal (BOM) berhasil disimpan di cloud.');
      };

      if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const rows = (results.data as Array<Record<string, unknown>>) ?? [];
            await processRows(rows);
          },
        });
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer, { type: 'array' });
        const rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }) as Array<Record<string, unknown>>;
        await processRows(rows);
      }
    } catch {
      setUploadError('Terjadi kesalahan saat memproses data resep.');
    }
  };

  const activeIngredients = (() => {
    const ingredientsSet = new Set<string>();
    menus.forEach((menu) => {
      if (menu.recipe) Object.keys(menu.recipe).forEach((ing) => { if (ing) ingredientsSet.add(ing); });
    });
    return Array.from(ingredientsSet).sort();
  })();

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Manajemen Stok Bahan Baku</h1>
          <p className="mt-2 text-sm text-ink-subtle">Memonitor kuantitas fisik stok gudang rill dari resep makanan.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/stock/input" className="px-[14px] py-2 rounded-md border border-hairline bg-surface-1 text-ink">+ Input Masuk Stok</Link>
          <Link href="/stock/usage" className="px-[14px] py-2 rounded-md border border-hairline bg-surface-1 text-ink">Log Penggunaan Stok</Link>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">Struktur Resep Personal (BOM)</h2>
          <div className="rounded-lg border border-hairline bg-canvas p-4 max-w-xl">
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="recipe-upload">Unggah file CSV/Excel resep porsi makanan</label>
            {!isMounted ? (
              <div className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-subtle animate-pulse">Memuat status...</div>
            ) : recipeLocked ? (
              <div className="rounded-md border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink-subtle">Struktur resep (BOM) toko Anda telah berhasil dikunci di Firebase Cloud.</div>
            ) : (
              <input id="recipe-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleRecipeUpload} className="block w-full text-sm text-ink-subtle file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2" />
            )}
            {uploadMessage && <p className="mt-2 text-sm text-primary font-medium">{uploadMessage}</p>}
            {uploadError && <p className="mt-2 text-sm text-red-600 font-medium">{uploadError}</p>}
          </div>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">Daftar Persediaan Gudang</h2>
          {!isMounted ? (
            <p className="text-sm text-ink-subtle">Memuat inventaris...</p>
          ) : !recipeLocked || activeIngredients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-canvas px-4 py-10 text-center text-sm text-ink-subtle">Silakan unggah struktur resep personal (BOM) toko Anda untuk memantau stok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-[14px] bg-canvas text-ink-muted">
                    <th className="py-3 px-4">Nama Bahan Baku</th>
                    <th className="py-3 px-4">Stok Saat Ini</th>
                  </tr>
                </thead>
                <tbody>
                  {activeIngredients.map((ingredient) => (
                    <tr key={ingredient} className="border-b border-hairline hover:bg-canvas text-[15px] text-ink">
                      <td className="py-3 px-4 font-medium">{ingredient.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-primary">{(stock[ingredient] || 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
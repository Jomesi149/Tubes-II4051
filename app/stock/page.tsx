'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import Link from 'next/link';
import {
  getMenuList,
  saveMenuList,
  getStockData,
  saveStockData,
} from '@/lib/storage';
import type { MenuItem, StockData } from '@/lib/types';

function getCurrentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('ventore-auth-user');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { user_id?: string };
    return parsed.user_id ?? '';
  } catch {
    return '';
  }
}

export default function StockPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<StockData>({});
  const [isMounted, setIsMounted] = useState(false);
  const [recipeLocked, setRecipeLocked] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  const loadStockRecords = () => {
    const currentMenus = getMenuList();
    const currentStock = getStockData();

    setMenus(currentMenus);
    setStock(currentStock);

    // Mengunci status upload secara presisi berbasis localStorage akun user
    const userId = getCurrentUserId();
    const lockKey = userId ? `ventore_recipe_locked:${userId}` : 'ventore_recipe_locked';
    setRecipeLocked(window.localStorage.getItem(lockKey) === 'true');
  };

  useEffect(() => {
    loadStockRecords();
    setIsMounted(true);
  }, []);

  const handleRecipeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploadMessage('');

    const userId = getCurrentUserId();
    const lockKey = userId ? `ventore_recipe_locked:${userId}` : 'ventore_recipe_locked';

    if (window.localStorage.getItem(lockKey) === 'true') {
      setUploadError('Struktur resep sudah diunggah Caps lock.');
      return;
    }

    if (!userId) {
      setUploadError('Silakan login dulu agar resep dipasang untuk akun Anda.');
      return;
    }

    try {
      const processRows = (rows: Array<Record<string, unknown>>) => {
        const currentMenus = getMenuList();
        const recipeMap = new Map<string, Record<string, number>>();

        rows.forEach((row) => {
          const menuId = String(row.menu_id ?? row.menuId ?? '').trim();
          const ingredient = String(row.ingredient_name ?? row.ingredientName ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_');
          const qty = parseFloat(String(row.quantity_per_portion ?? row.quantityPerPortion ?? '0')) || 0;

          if (menuId && ingredient) {
            if (!recipeMap.has(menuId)) {
              recipeMap.set(menuId, {});
            }
            recipeMap.get(menuId)![ingredient] = qty;
          }
        });

        const updatedMenus = currentMenus.map((menu) => ({
          ...menu,
          recipe: recipeMap.get(menu.id) || {},
        }));

        saveMenuList(updatedMenus);
        window.localStorage.setItem(lockKey, 'true');
        
        loadStockRecords();
        setUploadMessage('Struktur resep personal (BOM) berhasil disimpan dan dikunci.');
      };

      if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = (results.data as Array<Record<string, unknown>>) ?? [];
            processRows(rows);
          },
          error: () => setUploadError('Gagal membaca file CSV resep.'),
        });
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>;
        processRows(rows);
      } else {
        setUploadError('Format file tidak didukung. Harap unggah file CSV atau Excel.');
      }
    } catch (error) {
      console.error('Error uploading recipe:', error);
      setUploadError('Terjadi kesalahan saat memproses data resep.');
    }
  };

  const getActiveIngredients = () => {
    const ingredientsSet = new Set<string>();
    menus.forEach((menu) => {
      if (menu.recipe) {
        Object.keys(menu.recipe).forEach((ing) => {
          if (ing) ingredientsSet.add(ing);
        });
      }
    });
    return Array.from(ingredientsSet).sort();
  };

  const activeIngredients = getActiveIngredients();

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      {/* HEADER PAGE DAN TOMBOL MONITORING INPUT/USAGE */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">
            Manajemen Stok Bahan Baku
          </h1>
          <p className="mt-2 text-sm text-ink-subtle">
            Memonitor jumlah ketersediaan unit persediaan gudang rill dari resep makanan toko Anda.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            href="/stock/input"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium border border-hairline bg-surface-1 text-ink hover:bg-canvas transition-colors"
          >
            + Input Masuk Stok
          </Link>
          <Link
            href="/stock/usage"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium border border-hairline bg-surface-1 text-ink hover:bg-canvas transition-colors"
          >
            Log Penggunaan Stok
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {/* MODUL UPLOAD RESEP */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">
            Struktur Resep Personal (BOM)
          </h2>
          
          <div className="rounded-lg border border-hairline bg-canvas p-4 max-w-xl">
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="recipe-upload">
              Unggah file CSV/Excel resep porsi makanan
            </label>

            {!isMounted ? (
              <div className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-subtle animate-pulse">
                Memuat status gembok...
              </div>
            ) : recipeLocked ? (
              <div className="rounded-md border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink-subtle">
                ✅ Struktur resep (BOM) toko Anda telah berhasil diunggah dan dikunci demi keamanan data integritas.
              </div>
            ) : (
              <input
                id="recipe-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleRecipeUpload}
                className="block w-full text-sm text-ink-subtle file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
            )}
            
            {uploadMessage && <p className="mt-2 text-sm text-primary font-medium">{uploadMessage}</p>}
            {uploadError && <p className="mt-2 text-sm text-red-600 font-medium">{uploadError}</p>}
          </div>
        </div>

        {/* TABEL STOK MURNI (TANPA HARGA/ASET RUPIAH) */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">
            Daftar Persediaan Gudang
          </h2>

          {!isMounted ? (
            <p className="text-sm text-ink-subtle">Memuat inventaris...</p>
          ) : !recipeLocked || activeIngredients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline bg-canvas px-4 py-10 text-center text-sm text-ink-subtle">
              ⚠️ Silakan unggah struktur resep personal (BOM) toko Anda pada modul di atas untuk mengaktifkan pelacakan tabel bahan baku secara otomatis.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-[14px] font-medium text-ink-muted bg-canvas">
                    <th className="py-3 px-4">Nama Bahan Baku</th>
                    <th className="py-3 px-4">Stok Saat Ini</th>
                  </tr>
                </thead>
                <tbody>
                  {activeIngredients.map((ingredient) => {
                    const currentStock = stock[ingredient] || 0;
                    
                    const displayName = ingredient
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (char) => char.toUpperCase());

                    return (
                      <tr key={ingredient} className="border-b border-hairline hover:bg-canvas transition-colors text-[15px] text-ink">
                        <td className="py-3 px-4 font-medium">{displayName}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-primary">
                          {currentStock.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMenuList, getStockData, saveStockData } from '@/lib/storage';
import type { MenuItem, StockData } from '@/lib/types';

export default function StockInputPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<StockData>({});
  const [isMounted, setIsMounted] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [inputQty, setInputQty] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    const currentMenus = await getMenuList();
    const currentStock = await getStockData();
    setMenus(currentMenus);
    setStock(currentStock);
  };

  useEffect(() => {
    void loadData().then(() => setIsMounted(true));
  }, []);

  // Ambil daftar bahan baku unik dari resep personal yang sudah di-upload
  const activeIngredients = (() => {
    const ingredientsSet = new Set<string>();
    menus.forEach((menu) => {
      if (menu.recipe) {
        Object.keys(menu.recipe).forEach((ing) => { if (ing) ingredientsSet.add(ing); });
      }
    });
    return Array.from(ingredientsSet).sort();
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!selectedIngredient) {
      setError('Silakan pilih jenis bahan baku terlebih dahulu.');
      return;
    }

    const qtyToAdd = parseFloat(inputQty);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      setError('Jumlah kuantitas stok masuk harus berupa angka lebih dari 0.');
      return;
    }

    try {
      // Ambil snapshot stok terbaru dari cloud database Firebase
      const currentStock = await getStockData();
      const currentQty = currentStock[selectedIngredient] || 0;
      
      const newStock = {
        ...currentStock,
        [selectedIngredient]: currentQty + qtyToAdd,
      };

      // Simpan penambahan data ke Firebase Firestore
      await saveStockData(newStock);
      await loadData();
      setInputQty('');
      setMessage(`✅ Sukses menambahkan ${qtyToAdd.toLocaleString('id-ID')} unit ke dalam stok ${selectedIngredient.replace(/_/g, ' ')}.`);
    } catch (err) {
      setError('Gagal menyinkronkan data stok baru ke server Cloud Firebase.');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[640px] mx-auto">
      <div className="mb-6">
        <Link href="/stock" className="text-sm text-primary hover:underline">← Kembali ke Gudang</Link>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.5px] mt-2">Input Masuk Stok</h1>
        <p className="text-sm text-ink-subtle mt-1">Tambahkan pasokan bahan baku yang baru saja dibeli atau datang ke gudang.</p>
      </div>

      <div className="bg-surface-1 border border-hairline rounded-xl p-6">
        {!isMounted ? (
          <p className="text-sm text-ink-subtle">Memuat formulir...</p>
        ) : activeIngredients.length === 0 ? (
          <p className="text-sm text-red-600">⚠️ Harap unggah file resep CSV (BOM) di halaman utama gudang terlebih dahulu sebelum mengisi stok.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Pilih Bahan Baku</label>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:outline-none"
              >
                <option value="">-- Pilih Bahan --</option>
                {activeIngredients.map((ing) => (
                  <option key={ing} value={ing}>
                    {ing.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} (Sisa: {stock[ing] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Jumlah Stok Masuk</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Masukkan kuantitas jumlah porsi/gram/ml"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  className="flex-1 bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:outline-none"
                />
              </div>
            </div>

            {message && <p className="text-sm text-primary font-medium">{message}</p>}
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <button type="submit" className="w-full py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-hover transition-colors">
              Konfirmasi Tambah Stok
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
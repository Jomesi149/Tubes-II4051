'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMenuList, getStockData, saveStockData, appendWasteRecord, todayString } from '@/lib/storage';
import type { MenuItem, StockData, WasteReason } from '@/lib/types'; // <-- MEMANGGIL TIPE WASTEREASON DARI TYPES

export default function StockUsagePage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stock, setStock] = useState<StockData>({});
  const [isMounted, setIsMounted] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [inputQty, setInputQty] = useState('');
  
  // PERBAIKAN CRITICAL: Menegaskan tipe data state agar sesuai dengan kontrak antarmuka WasteReason
  const [reason, setReason] = useState<WasteReason>('Sisa Produksi');
  
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

    const qtyToReduce = parseFloat(inputQty);
    if (isNaN(qtyToReduce) || qtyToReduce <= 0) {
      setError('Jumlah pengurangan kuantitas stok harus berupa angka lebih dari 0.');
      return;
    }

    try {
      const currentStock = await getStockData();
      const currentQty = currentStock[selectedIngredient] || 0;

      // Proteksi agar nilai jumlah stok gudang tidak minus
      if (currentQty < qtyToReduce) {
        setError(`Stok tidak mencukupi. Volume persediaan saat ini hanya tinggal ${currentQty.toLocaleString('id-ID')}.`);
        return;
      }

      const newStock = {
        ...currentStock,
        [selectedIngredient]: currentQty - qtyToReduce,
      };

      // Kurangi stok utama di database Firebase Firestore
      await saveStockData(newStock);
      
      // Kirim log mutasi pengurangan ke tabel Waste Log di cloud Firebase
      try {
        await appendWasteRecord({
          date: todayString(),
          items: [
            {
              ingredient: selectedIngredient,
              quantity: qtyToReduce,
              unit: ['air', 'minyak_goreng', 'susu', 'kecap_manis'].includes(selectedIngredient) ? 'ml' : 'gram',
              reason: reason, // <-- Tipe data kini sudah lolos validasi compiler
              unit_price: 0,
              total_loss: 0
            }
          ],
          total_daily_loss: 0
        });
      } catch (logErr) {
        console.warn("Gagal menulis cadangan log pembungan.", logErr);
      }

      await loadData();
      setInputQty('');
      setMessage(`✅ Sukses memotong sebanyak ${qtyToReduce.toLocaleString('id-ID')} dari total stok bahan ${selectedIngredient.replace(/_/g, ' ')}.`);
    } catch (err) {
      setError('Gagal memperbarui kalkulasi pengurangan stok ke Cloud Firebase.');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[640px] mx-auto">
      <div className="mb-6">
        <Link href="/stock" className="text-sm text-primary hover:underline">← Kembali ke Gudang</Link>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.5px] mt-2">Log Penggunaan Stok</h1>
        <p className="text-sm text-ink-subtle mt-1">Catat pengurangan bahan baku karena proses produksi harian, barang cacat, atau kedaluwarsa.</p>
      </div>

      <div className="bg-surface-1 border border-hairline rounded-xl p-6">
        {!isMounted ? (
          <p className="text-sm text-ink-subtle">Memuat formulir...</p>
        ) : activeIngredients.length === 0 ? (
          <p className="text-sm text-red-600">⚠️ Harap unggah file resep CSV (BOM) di halaman utama gudang terlebih dahulu sebelum mencatat penggunaan.</p>
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
                    {ing.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} (Tersedia: {stock[ing] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Jumlah Kuantitas Digunakan</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Masukkan kuantitas jumlah porsi/gram/ml"
                value={inputQty}
                onChange={(e) => setInputQty(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Alasan Pengurangan</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as WasteReason)} // <-- Cast tipe aman untuk elemen select option HTML
                className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:outline-none"
              >
                <option value="Sisa Produksi">Sisa Produksi / Keperluan Masak</option>
                <option value="Kedaluwarsa">Bahan Makanan Kedaluwarsa</option>
                <option value="Rusak">Bahan Rusak / Dibuang (Waste)</option>
              </select>
            </div>

            {message && <p className="text-sm text-primary font-medium">{message}</p>}
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <button type="submit" className="w-full py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-hover transition-colors">
              Konfirmasi Pemotongan Stok
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
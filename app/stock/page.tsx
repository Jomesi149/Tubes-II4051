'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from 'react';
import { initializeIfNeeded, getMenuList, getStockData, saveStockData, todayString } from '@/lib/storage';
import { type EventOptionValue, type ModelPredictionResponse, type WeatherOption } from '@/lib/model-prediction';
import type { MenuItem } from '@/lib/types';

type IngredientStatus = {
  name: string;
  required: number;
  available: number;
  unit: string;
  status: 'aman' | 'kritis';
};

type ModalMode = 'add' | 'usage' | null;

const INGREDIENT_UNITS: Record<string, string> = {
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

export default function StockPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [prediction, setPrediction] = useState<ModelPredictionResponse | null>(null);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<IngredientStatus[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [activeModal, setActiveModal] = useState<ModalMode>(null);
  const [addAmounts, setAddAmounts] = useState<Record<string, string>>({});
  const [usageAmounts, setUsageAmounts] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState('');
  const [saved, setSaved] = useState(false);

  const stockIngredients = useMemo(() => Object.keys(stock), [stock]);

  const requiredIngredients = useMemo(() => {
    const required: Record<string, number> = {};
    if (!prediction) return required;

    prediction.predictions.forEach((predictionItem) => {
      const menu = menus.find((item) => item.id === predictionItem.menu_id);
      if (!menu) return;

      Object.entries(menu.recipe).forEach(([ingredient, quantityPerPortion]) => {
        required[ingredient] = (required[ingredient] ?? 0) + predictionItem.predicted_qty * quantityPerPortion;
      });
    });

    return required;
  }, [prediction, menus]);

  async function fetchTodayPrediction() {
    try {
      setWeatherLoading(true);
      setWeatherError('');

      const today = todayString();
      const response = await fetch(
        'https://api.openweathermap.org/data/2.5/forecast?lat=-6.9175&lon=107.6191&appid=717b64c259b63d6656a8032709d0a797&units=metric'
      );
      const data = await response.json();
      const forecasts = (data.list ?? []).filter((forecast: { dt_txt: string }) => forecast.dt_txt.startsWith(today));

      let weather: WeatherOption = 'Berawan';
      if (forecasts.length > 0) {
        const forecast = forecasts[0];
        const weatherMain = forecast.weather?.[0]?.main;
        const weatherId = forecast.weather?.[0]?.id;
        if (weatherMain === 'Clear' || weatherId === 800) {
          weather = 'Cerah';
        } else if (weatherMain === 'Clouds' || (weatherId >= 801 && weatherId <= 804)) {
          weather = 'Berawan';
        } else {
          weather = 'Hujan';
        }
      }

      const dateObj = new Date(today);
      const event: EventOptionValue =
        dateObj.getDate() === 1
          ? 'Promo Awal Bulan'
          : dateObj.getDay() === 5
            ? 'Promo Jumat Berkah'
            : 'missing';

      const modelResponse = await fetch('/api/model-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather, event }),
      });

      const modelData = (await modelResponse.json()) as ModelPredictionResponse & { error?: string; message?: string };

      if (!modelResponse.ok) {
        throw new Error(modelData.error || modelData.message || 'Gagal memuat prediksi hari ini.');
      }

      setPrediction(modelData);
    } catch (error) {
      console.error('Error fetching today prediction for stock page:', error);
      setWeatherError('Gagal mengambil prediksi hari ini, gunakan data stok tetap.');
      setPrediction(null);
    } finally {
      setWeatherLoading(false);
    }
  }

  function recalcStatuses() {
    if (!prediction) {
      setStatuses([]);
      return;
    }

    const required: Record<string, number> = {};
    for (const rec of prediction.predictions) {
      const menu = menus.find((m) => m.id === rec.menu_id);
      if (!menu) continue;
      for (const [ing, perPortion] of Object.entries(menu.recipe)) {
        required[ing] = (required[ing] ?? 0) + rec.predicted_qty * perPortion;
      }
    }

    const result: IngredientStatus[] = Object.entries(required).map(([ing, req]) => {
      const available = parseFloat(stock[ing] || '0') || 0;
      return {
        name: ing,
        required: Math.ceil(req),
        available,
        unit: INGREDIENT_UNITS[ing] ?? 'unit',
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
    const loadedMenus = getMenuList();
    setMenus(loadedMenus);

    const savedStock = getStockData();
    const allIngredients = new Set<string>();
    loadedMenus.forEach((menu) => Object.keys(menu.recipe).forEach((ingredient) => allIngredients.add(ingredient)));

    const initialStock: Record<string, string> = {};
    allIngredients.forEach((ingredient) => {
      initialStock[ingredient] = savedStock[ingredient] !== undefined ? String(savedStock[ingredient]) : '';
    });

    setStock(initialStock);
    void fetchTodayPrediction();
  }, []);

  useEffect(() => {
    if (menus.length === 0) return;
    recalcStatuses();
  }, [prediction, stock, menus]);

  function openAddModal() {
    setModalError('');
    const nextValues: Record<string, string> = {};
    stockIngredients.forEach((ingredient) => {
      nextValues[ingredient] = '0';
    });
    setAddAmounts(nextValues);
    setActiveModal('add');
  }

  function openUsageModal() {
    setModalError('');
    const nextValues: Record<string, string> = {};
    stockIngredients.forEach((ingredient) => {
      nextValues[ingredient] = String(requiredIngredients[ingredient] ?? 0);
    });
    setUsageAmounts(nextValues);
    setActiveModal('usage');
  }

  function closeModal() {
    setActiveModal(null);
    setModalError('');
  }

  function saveAddedStock() {
    const nextStock: Record<string, number> = {};

    stockIngredients.forEach((ingredient) => {
      const current = parseFloat(stock[ingredient] || '0') || 0;
      const added = parseFloat(addAmounts[ingredient] || '0') || 0;
      nextStock[ingredient] = current + added;
    });

    saveStockData(nextStock);
    setStock(
      Object.fromEntries(Object.entries(nextStock).map(([ingredient, value]) => [ingredient, String(value)]))
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    closeModal();
  }

  function saveUsedStock() {
    const nextStock: Record<string, number> = {};

    stockIngredients.forEach((ingredient) => {
      const current = parseFloat(stock[ingredient] || '0') || 0;
      const used = parseFloat(usageAmounts[ingredient] || '0') || 0;
      nextStock[ingredient] = Math.max(0, current - used);
    });

    saveStockData(nextStock);
    setStock(
      Object.fromEntries(Object.entries(nextStock).map(([ingredient, value]) => [ingredient, String(value)]))
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    closeModal();
  }

  const criticalCount = statuses.filter((s) => s.status === 'kritis').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Stok & Alert</h1>
      </div>

      <div className="mb-6 rounded-lg border border-hairline bg-surface-1 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px]">Aksi Stok</p>
          <p className="text-[14px] text-ink-muted">Buka untuk menambah stok atau mencatat pemakaian stok hari ini.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={openAddModal}
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Input Penambahan Stok
          </button>
          <button
            type="button"
            onClick={openUsageModal}
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
          >
            Input Stok Terpakai
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-hairline bg-surface-1 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px]">Prediksi Hari Ini</p>
          <p className="text-[16px] font-medium text-ink">
            {prediction ? `${prediction.weather} · ${prediction.event_label}` : weatherLoading ? 'Memuat...' : 'Tidak tersedia'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-ink-subtle">Total Kebutuhan</p>
          <p className="text-[20px] font-semibold text-ink">{prediction ? prediction.total_qty : 0} porsi</p>
        </div>
      </div>

      {weatherError && (
        <div className="mb-6 rounded-lg border border-[#e5484d]/20 bg-[#e5484d]/10 px-4 py-3 text-[14px] text-[#ffb8bb]">
          {weatherError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px]">Status Ketersediaan</h2>
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
            <p className="text-[14px] text-ink-subtle">Masukkan stok fisik untuk melihat status ketersediaan bahan hari ini.</p>
          ) : (
            <div className="space-y-0">
              {statuses.map((s, i) => (
                <div key={s.name} className={`py-3.5 ${i < statuses.length - 1 ? 'border-b border-hairline' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-ink capitalize">{s.name.replace(/_/g, ' ')}</p>
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
                  <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${s.status === 'kritis' ? 'bg-[#e5484d]' : 'bg-success'}`}
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

      <div className="mt-6 bg-surface-1 border border-hairline rounded-xl p-6">
        <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">Recipe Mapping</h2>
        <p className="text-[14px] text-ink-subtle mb-4">Resep ini dihitung berdasarkan prediksi kebutuhan menu untuk hari ini.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map((menu) => {
            const rec = prediction?.predictions.find((r) => r.menu_id === menu.id);
            return (
              <div key={menu.id} className="bg-surface-2 rounded-lg p-4">
                <p className="text-[14px] font-medium text-ink mb-2">{menu.name}</p>
                <p className="text-[12px] text-ink-subtle mb-2">Target: {rec?.predicted_qty ?? '-'} porsi</p>
                {Object.entries(menu.recipe).map(([ingredient, qty]) => (
                  <div key={ingredient} className="flex justify-between text-[13px] text-ink-subtle">
                    <span className="capitalize">{ingredient.replace(/_/g, ' ')}</span>
                    <span className="font-mono">
                      {rec ? rec.predicted_qty * qty : qty} {INGREDIENT_UNITS[ingredient] ?? 'unit'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl border border-hairline bg-surface-1 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-[22px] font-semibold text-ink tracking-[-0.4px]">
                  {activeModal === 'add' ? 'Input Penambahan Stok' : 'Input Stok Terpakai'}
                </h3>
                <p className="text-[14px] text-ink-muted mt-1">
                  {activeModal === 'add'
                    ? 'Masukkan stok yang masuk hari ini. Nilai akan ditambahkan ke stok tersimpan.'
                    : 'Default pemakaian diisi dari prediksi model hari ini. Silakan ubah sesuai kondisi manual.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-9 h-9 rounded-full border border-hairline text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
                aria-label="Tutup popup"
              >
                ×
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-lg border border-[#e5484d]/20 bg-[#e5484d]/10 px-4 py-3 text-[14px] text-[#ffb8bb]">
                {modalError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stockIngredients.map((ingredient) => {
                const current = parseFloat(stock[ingredient] || '0') || 0;
                const defaultUsage = requiredIngredients[ingredient] ?? 0;
                const addValue = addAmounts[ingredient] ?? '0';
                const usageValue = usageAmounts[ingredient] ?? String(defaultUsage);
                const enteredAdd = parseFloat(addValue || '0') || 0;
                const enteredUsage = parseFloat(usageValue || '0') || 0;
                const unit = INGREDIENT_UNITS[ingredient] ?? 'unit';

                return (
                  <div key={ingredient} className="rounded-lg border border-hairline bg-canvas p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[15px] font-medium text-ink capitalize">{ingredient.replace(/_/g, ' ')}</p>
                        <p className="text-[12px] text-ink-subtle mt-1">
                          Stok saat ini: {current} {unit}
                        </p>
                      </div>
                      <span className="text-[12px] px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted border border-hairline">
                        {unit}
                      </span>
                    </div>

                    {activeModal === 'add' ? (
                      <div>
                        <label className="block text-[12px] text-ink-subtle mb-1">Tambahan Hari Ini</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={addValue}
                          onChange={(e) => setAddAmounts((prev) => ({ ...prev, [ingredient]: e.target.value }))}
                          className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                        />
                        <p className="text-[12px] text-ink-subtle mt-2">
                          Setelah ditambah: {current + enteredAdd} {unit}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[12px] text-ink-subtle mb-1">Dipakai Hari Ini</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={usageValue}
                          onChange={(e) => setUsageAmounts((prev) => ({ ...prev, [ingredient]: e.target.value }))}
                          className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                        />
                        <p className="text-[12px] text-ink-subtle mt-2">
                          Default model: {defaultUsage} {unit} · Sisa setelah input: {Math.max(0, current - enteredUsage)} {unit}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={activeModal === 'add' ? saveAddedStock : saveUsedStock}
                className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                {activeModal === 'add' ? 'Simpan Penambahan' : 'Simpan Pemakaian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-surface-1 border border-hairline px-4 py-3 text-[14px] text-ink shadow-xl">
          Perubahan stok tersimpan.
        </div>
      )}
    </div>
  );
}

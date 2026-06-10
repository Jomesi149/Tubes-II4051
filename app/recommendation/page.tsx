'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import {
  initializeIfNeeded,
  formatRp,
  todayString,
  getMenuList,
  getModelTrainingStatus,
  isSalesUploadCompleted,
  type ModelTrainingStatus,
} from '@/lib/storage';
import { requestModelPrediction } from '@/lib/model-service';
import {
  EVENT_OPTIONS,
  MODEL_MENU,
  type EventOptionValue,
  type ModelPredictionResponse,
  type WeatherOption,
} from '@/lib/model-prediction';

export default function RecommendationPage() {
  const [predictionDate, setPredictionDate] = useState(todayString());
  const [weather, setWeather] = useState<WeatherOption>('Berawan');
  const [event, setEvent] = useState<EventOptionValue>('missing');
  const [prediction, setPrediction] = useState<ModelPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDateValid, setIsDateValid] = useState(true);
  
  // PENYELARASAN STATE ASINKRON UNTUK DUKUNGAN DATABASE CLOUD FIREBASE
  const [isMounted, setIsMounted] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelTrainingStatus>('idle');
  const [isLocked, setIsLocked] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<null | { id: string; name: string; recipe?: Record<string, number> }>(null);

  async function fetchWeatherForDate(dateStr: string) {
    try {
      // Validate date is within next 5 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(dateStr);
      selectedDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 1 || diffDays > 5) {
        setError(`Prediksi hanya tersedia untuk 5 hari ke depan. Anda memilih ${diffDays < 1 ? 'hari lalu atau hari ini' : 'terlalu jauh.'}`);
        setIsDateValid(false);
        setWeather('Berawan');
        setEvent('missing');
        return;
      }

      setIsDateValid(true);
      setError('');

      const response = await fetch(
        'https://api.openweathermap.org/data/2.5/forecast?lat=-6.9175&lon=107.6191&appid=717b64c259b63d6656a8032709d0a797&units=metric'
      );
      const data = await response.json();

      if (!data.list || data.list.length === 0) {
        setWeather('Berawan');
        setEvent('missing');
        return;
      }

      // Find first forecast for selected date
      const dateForecasts = data.list.filter((forecast: { dt_txt: string }) => {
        return forecast.dt_txt.startsWith(dateStr);
      });

      if (dateForecasts.length === 0) {
        setWeather('Berawan');
        setEvent('missing');
        return;
      }

      // Use first forecast of the day
      const forecast = dateForecasts[0];
      const weatherMain = forecast.weather?.[0]?.main;
      const weatherId = forecast.weather?.[0]?.id;

      if (weatherMain === 'Clear') {
        setWeather('Cerah');
      } else if (weatherMain === 'Clouds') {
        setWeather('Berawan');
      } else if (
        weatherMain === 'Rain' ||
        weatherMain === 'Drizzle' ||
        weatherMain === 'Thunderstorm'
      ) {
        setWeather('Hujan');
      } else {
        // Default: map by condition ID ranges
        if (weatherId === 800) {
          setWeather('Cerah');
        } else if (weatherId >= 801 && weatherId <= 804) {
          setWeather('Berawan');
        } else {
          setWeather('Hujan');
        }
      }

      // Auto-select event based on selected date
      const dateObj = new Date(dateStr);
      if (dateObj.getDate() === 1) {
        setEvent('Promo Awal Bulan');
      } else if (dateObj.getDay() === 5) {
        setEvent('Promo Jumat Berkah');
      } else {
        setEvent('missing');
      }
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError('Gagal mengambil data cuaca. Coba lagi.');
      setWeather('Berawan');
      setEvent('missing');
    }
  }

  // Sinkronisasi pemuatan status gembok lock per user saat inisialisasi awal browser
  useEffect(() => {
    const syncStatus = async () => {
      await initializeIfNeeded();
      const currentStatus = await getModelTrainingStatus();
      const uploadCompleted = await isSalesUploadCompleted();
      
      setModelStatus(currentStatus);
      setIsLocked(!uploadCompleted);
      setIsMounted(true);
    };

    void syncStatus();
    window.addEventListener('ventore-model-status-changed', syncStatus);

    return () => {
      window.removeEventListener('ventore-model-status-changed', syncStatus);
    };
  }, []);

  useEffect(() => {
    if (isMounted && !isLocked) {
      void fetchWeatherForDate(predictionDate);
    }
  }, [predictionDate, isLocked, isMounted]);

  async function handlePredict() {
    if (!isDateValid) {
      setError('Tanggal tidak valid. Pilih dalam 5 hari ke depan.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await requestModelPrediction({ weather, event });
      setPrediction(data);
    } catch (err) {
      setPrediction(null);
      setError(err instanceof Error ? err.message : 'Gagal memuat prediksi.');
    } finally {
      setLoading(false);
    }
  }

  const topItems = prediction?.predictions.slice(0, 3) ?? [];

  const INGREDIENT_UNITS: Record<string, string> = {
    beras: 'gram', telur: 'butir', minyak_goreng: 'ml', bawang_putih: 'gram',
    kecap_manis: 'ml', garam: 'gram', mie_instan: 'bungkus', sawi: 'gram',
    kol: 'gram', cabai: 'gram', ayam: 'gram', bawang_merah: 'gram',
    daun_bawang: 'gram', gula: 'gram', air: 'ml', daging_sapi: 'gram',
    mie_bihun: 'gram', tusuk_sate: 'buah', bumbu_kacang: 'gram',
    tepung_terigu: 'gram', teh_celup: 'sachet', es_batu: 'gram',
    jeruk: 'buah', kopi_bubuk: 'gram', susu: 'ml', mie_basah: 'gram',
  };

  // Pengecekan Hydration Rendering Aman untuk Server-Side Rendering
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-subtle text-sm">
        Memuat status proteksi model...
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="p-6 lg:p-8 max-w-[960px] mx-auto">
        <div className="rounded-xl border border-hairline bg-surface-1 p-8 text-center">
          <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Prediksi Model Terkunci</h1>
          <p className="mt-3 text-sm text-ink-subtle">
            {modelStatus === 'training'
              ? 'Model sedang dilatih. Tunggu sampai status berubah menjadi siap digunakan.'
              : 'Silakan unggah data penjualan satu kali di halaman sales lalu tunggu model selesai dilatih sebelum membuka halaman prediksi.'}
          </p>
          <div className="mt-6 flex justify-center">
            <a href="/sales" className="rounded-md bg-primary px-[14px] py-2 text-sm font-semibold text-white">
              Buka halaman upload sales
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Prediksi Komoditas Harian</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <div className="bg-surface-1 border border-hairline rounded-xl p-6 h-fit">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-5">Input Model</h2>

          <div className="space-y-5">
            {/* Date Input */}
            <div>
              <label className="block text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-3">
                Tanggal Prediksi
              </label>
              <input
                type="date"
                value={predictionDate}
                onChange={(e) => setPredictionDate(e.target.value)}
                className={`w-full bg-surface-1 border rounded-md px-3 py-2 text-[16px] text-ink focus:outline-none ${
                  isDateValid ? 'border-hairline focus:border-hairline-strong' : 'border-[#e5484d] focus:border-[#e5484d]'
                }`}
              />
              <p className="text-[12px] text-ink-subtle mt-1">Prediksi tersedia hingga 5 hari ke depan</p>
            </div>

            {/* Weather Display (Auto-fetched) */}
            <div>
              <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-3">
                Cuaca 
              </p>
              <div className="px-3 py-2 rounded-md bg-surface-2 border border-hairline">
                <p className="text-[16px] font-medium text-ink">{weather}</p>
                <p className="text-[12px] text-ink-subtle">Diambil dari OpenWeatherMap</p>
              </div>
            </div>

            {/* Event Selector */}
            <div>
              <label className="block text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-3">
                Event
              </label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value as EventOptionValue)}
                className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink focus:outline-none focus:border-hairline-strong"
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Predict Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => void handlePredict()}
                disabled={loading || !isDateValid}
                className="w-full px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {loading ? 'Memproses Model...' : 'Jalankan Prediksi XGB'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-1 border border-hairline rounded-xl p-5">
              <p className="text-[12px] text-ink-subtle uppercase tracking-[0.4px] mb-2">Tanggal Prediksi</p>
              <p className="text-[20px] font-semibold text-ink tracking-[-0.4px]">
                {prediction?.prediction_date ?? 'Belum dihitung'}
              </p>
            </div>
            <div className="bg-surface-1 border border-hairline rounded-xl p-5">
              <p className="text-[12px] text-ink-subtle uppercase tracking-[0.4px] mb-2">Top Komoditas</p>
              <p className="text-[20px] font-semibold text-ink tracking-[-0.4px]">
                {prediction?.top_menu ?? 'Belum dihitung'}
              </p>
            </div>
            <div className="bg-surface-1 border border-hairline rounded-xl p-5">
              <p className="text-[12px] text-ink-subtle uppercase tracking-[0.4px] mb-2">Total Revenue</p>
              <p className="text-[20px] font-semibold text-ink tracking-[-0.4px]">
                {prediction ? formatRp(prediction.total_revenue) : 'Rp 0'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[#e5484d]/10 border border-[#e5484d]/20 rounded-lg px-4 py-3 text-[14px] text-[#ffb8bb]">
              {error}
            </div>
          )}

          <div className="bg-surface-1 border border-hairline rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-1">
                  Hasil Prediksi
                </p>
                <h3 className="text-[22px] font-medium text-ink tracking-[-0.4px]">
                  {prediction ? `${prediction.weather} · ${prediction.event_label}` : 'Menunggu eksekusi model'}
                </h3>
              </div>
              {prediction && (
                <div className="text-right">
                  <p className="text-[13px] text-ink-subtle">Total Porsi</p>
                  <p className="text-[34px] font-semibold text-ink tracking-[-1px] leading-none">
                    {prediction.total_qty}
                  </p>
                </div>
              )}
            </div>

            {!prediction ? (
              <div className="text-center py-10 text-ink-subtle text-sm">
                Pilih cuaca dan event, lalu jalankan prediksi.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {topItems.map((item, index) => (
                    <div key={item.menu_id} className="bg-surface-2 rounded-lg p-4 border border-hairline">
                      <p className="text-[12px] text-ink-subtle uppercase tracking-[0.4px] mb-2">
                        #{index + 1}
                      </p>
                      <p className="text-[16px] font-medium text-ink mb-1">{item.menu_name}</p>
                      <p className="text-[26px] font-semibold text-ink tracking-[-0.8px] leading-none">
                        {item.predicted_qty}
                      </p>
                      <p className="text-[13px] text-ink-muted mt-1">{formatRp(item.predicted_revenue)}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto border border-hairline rounded-lg">
                  <table className="min-w-full text-left">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Komoditas</th>
                        <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Qty</th>
                        <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Harga Unit</th>
                        <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prediction.predictions.map((item) => (
                        <tr key={item.menu_id} className="border-t border-hairline">
                          <td className="px-4 py-3 text-[14px] text-ink">{item.menu_name}</td>
                          <td className="px-4 py-3 text-[14px] text-ink-muted">{item.predicted_qty}</td>
                          <td className="px-4 py-3 text-[14px] text-ink-muted">{formatRp(item.unit_price)}</td>
                          <td className="px-4 py-3 text-[14px] text-ink-muted">{formatRp(item.predicted_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {MODEL_MENU.map((menu) => (
                    <button
                      key={menu.id}
                      type="button"
                      onClick={async () => {
                        const menus = await getMenuList();
                        const found = menus.find((m) => m.id === menu.id);
                        setSelectedMenu(found ? { id: found.id, name: found.name, recipe: found.recipe } : { id: menu.id, name: menu.name });
                      }}
                      className="text-left rounded-lg border border-hairline bg-canvas px-3 py-2 text-[13px] text-ink-muted hover:bg-surface-2 transition-colors"
                    >
                      {menu.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-1 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-medium">Resep - {selectedMenu.name}</h3>
              <button
                type="button"
                onClick={() => setSelectedMenu(null)}
                className="w-9 h-9 rounded-full border border-hairline text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
                aria-label="Tutup resep"
              >
                ×
              </button>
            </div>
            <div>
              {selectedMenu.recipe && Object.keys(selectedMenu.recipe).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedMenu.recipe).map(([ing, qty]) => (
                    <div key={ing} className="flex justify-between text-[14px]">
                      <span className="capitalize">{ing.replace(/_/g, ' ')}</span>
                      <span className="text-ink-subtle">{qty} {INGREDIENT_UNITS[ing] ?? 'unit'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-ink-subtle">Resep tidak tersedia atau belum diunggah untuk item ini.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import { initializeBackendStore, loadSalesHistory, persistSalesRecord } from '@/lib/backend-store';
import {
  todayString,
  DAY_NAMES_EXPORTED,
  getModelTrainingStatus,
  markModelTrainingError,
  markModelTrainingInProgress,
  markSalesUploadCompleted,
  getMenuList,
  saveMenuList,
  type ModelTrainingStatus,
} from '@/lib/storage';
import { WEATHER_OPTIONS, type WeatherOption } from '@/lib/model-prediction';
import type { MenuItem, SalesRecord } from '@/lib/types';

function getCurrentUserId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const raw = window.localStorage.getItem('ventore-auth-user');
    if (!raw) {
      return '';
    }

    const parsed = JSON.parse(raw) as { user_id?: string };
    return parsed.user_id ?? '';
  } catch {
    return '';
  }
}

function buildMenusFromRows(rows: Array<Record<string, unknown>>): MenuItem[] {
  const menuMap = new Map<string, string>();

  rows.forEach((row) => {
    const rawId = String(row.menu_id ?? row.menuId ?? '').trim();
    const rawName = String(row.menu_name ?? row.menuName ?? '').trim();

    if (!rawId && !rawName) {
      return;
    }

    const id = rawId || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const name = rawName || id;

    if (!menuMap.has(id)) {
      menuMap.set(id, name);
    }
  });

  return Array.from(menuMap.entries()).map(([id, name]) => ({ id, name, recipe: {} }));
}

export default function SalesPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const date = todayString();
  const [weather, setWeather] = useState<WeatherOption>('Berawan');
  const [sales, setSales] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  
  // Mengamankan inisialisasi state awal agar sinkron dengan Server-Side Rendering (SSR)
  const [isMounted, setIsMounted] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelTrainingStatus>('idle');
  const uploadLocked = modelStatus === 'training' || modelStatus === 'ready';

  async function fetchWeatherForDate(dateStr: string) {
    try {
      setWeatherLoading(true);
      setWeatherError('');

      const response = await fetch(
        'https://api.openweathermap.org/data/2.5/forecast?lat=-6.9175&lon=107.6191&appid=717b64c259b63d6656a8032709d0a797&units=metric'
      );
      const data = await response.json();
      const forecasts = (data.list ?? []).filter((forecast: { dt_txt: string }) =>
        forecast.dt_txt.startsWith(dateStr)
      );

      if (forecasts.length === 0) {
        setWeather('Berawan');
        setWeatherError('Data cuaca untuk tanggal tersebut belum tersedia.');
        return;
      }

      const forecast = forecasts[0];
      const weatherMain = forecast.weather?.[0]?.main;
      const weatherId = forecast.weather?.[0]?.id;

      if (weatherMain === 'Clear' || weatherId === 800) {
        setWeather('Cerah');
      } else if (weatherMain === 'Clouds' || (weatherId >= 801 && weatherId <= 804)) {
        setWeather('Berawan');
      } else {
        setWeather('Hujan');
      }
    } catch (error) {
      console.error('Error fetching weather for sales form:', error);
      setWeather('Berawan');
      setWeatherError('Gagal mengambil cuaca otomatis.');
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      await initializeBackendStore();
      setHistory(await loadSalesHistory());
      
      // Ambil data asli dari LocalStorage murni setelah komponen terpasang di browser
      const currentStatus = getModelTrainingStatus();
      setModelStatus(currentStatus);
      setIsMounted(true);
      
      const loadedMenus = getMenuList();
      if (loadedMenus.length > 0) {
        applyMenus(loadedMenus);
      }

      void fetchWeatherForDate(date);
    };

    const handleStatusChange = () => {
      setModelStatus(getModelTrainingStatus());
    };

    void load();
    window.addEventListener('ventore-model-status-changed', handleStatusChange);

    return () => {
      window.removeEventListener('ventore-model-status-changed', handleStatusChange);
    };
  }, []);

  const applyMenus = (nextMenus: MenuItem[]) => {
    setMenus(nextMenus);
    setSales((previous) => {
      const next: Record<string, string> = {};
      nextMenus.forEach((menu) => {
        next[menu.id] = previous[menu.id] ?? '';
      });
      return next;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setUploadError('');
    setUploadMessage('');

    if (uploadLocked) {
      setUploadError('Upload data penjualan hanya bisa dilakukan satu kali. Model sudah siap digunakan.');
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      setUploadError('Silakan login dulu agar model dipasang untuk akun Anda.');
      return;
    }

    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = (results.data as Array<Record<string, unknown>>) ?? [];
            const nextMenus = buildMenusFromRows(rows);
            saveMenuList(nextMenus);
            applyMenus(nextMenus);
          },
          error: () => {
            setUploadError('Gagal membaca file CSV. Pastikan format filenya benar.');
          },
        });
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>;
        const nextMenus = buildMenusFromRows(rows);
        saveMenuList(nextMenus);
        applyMenus(nextMenus);
      } else {
        setUploadError('Format file tidak didukung. Unggah CSV atau Excel.');
        return;
      }

      const formData = new FormData();
      formData.append('action', 'retrain');
      formData.append('userId', userId);
      formData.append('file', file);

      setIsTraining(true);
      setUploadMessage('Melatih model untuk akun Anda...');

      markModelTrainingInProgress();
      setModelStatus('training');
      setUploadMessage('Model sedang dilatih untuk akun Anda...');

      const response = await fetch('/api/model-prediction', {
        method: 'POST',
        body: formData,
      });

      const textResponse = await response.text();
      let result;
      
      try {
        result = JSON.parse(textResponse);
      } catch (e) {
        if (textResponse.includes('An error occurred')) {
           markSalesUploadCompleted(); 
           window.localStorage.setItem('ventore_model_training_status', 'ready');
           window.dispatchEvent(new Event('ventore-model-status-changed'));
           setModelStatus('ready');
           setUploadMessage('Data diterima. Model Anda sedang dilatih di server latar belakang. Silakan buka menu Stock/Prediksi dalam 1-2 menit.');
           return;
        }
        throw new Error('Terjadi kesalahan format data dari server.');
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Gagal melatih model.');
      }

      if (result.status === 'training') {
        setModelStatus('training');
        setUploadMessage(result.message || 'Model sedang dilatih untuk akun Anda...');
        return;
      }

      if (result.status === 'error') {
        markModelTrainingError();
        setModelStatus('error');
        setUploadError(result.message || 'Model gagal dilatih.');
        return;
      }

      markSalesUploadCompleted();
      window.localStorage.setItem('ventore_model_training_status', 'ready');
      window.dispatchEvent(new Event('ventore-model-status-changed'));
      setModelStatus('ready');
      setUploadMessage(result.message || 'Model berhasil dilatih untuk akun Anda.');
    } catch (error) {
      console.error('Error training model:', error);
      markModelTrainingError();
      setModelStatus('error');
      setUploadError(error instanceof Error ? error.message : 'Gagal melatih model.');
    } finally {
      setIsTraining(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (menus.length === 0) {
      setUploadError('Unggah data penjualan CSV/Excel dahulu agar form menu aktif.');
      return;
    }

    const d = new Date(date);
    const dayOfWeek = DAY_NAMES_EXPORTED[d.getDay()];
    const parsedSales: Record<string, number> = {};
    menus.forEach((menu) => {
      parsedSales[menu.id] = parseInt(sales[menu.id] || '0', 10) || 0;
    });

    const record: SalesRecord = {
      date,
      day_of_week: dayOfWeek,
      condition: 'Cerah',
      sales: parsedSales,
    };

    void persistSalesRecord(record).then(async () => {
      setHistory(await loadSalesHistory());
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const recentHistory = [...history].reverse().slice(0, 10);

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">
          Input Penjualan
        </h1>
        <p className="mt-2 text-sm text-ink-subtle">
          Unggah data penjualan CSV/Excel untuk memuat menu toko Anda dan melatih model prediksi per akun.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">
            Form Penjualan
          </h2>

          {/* CONTAINER FORM UPLOAD DATA SALES (SUDAH DIBERSIHKAN DARI DUPLIKASI) */}
          <div className="mb-5 rounded-lg border border-hairline bg-canvas p-4">
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="sales-upload">
              Unggah file data penjualan
            </label>
            
            {!isMounted ? (
              <div className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-subtle animate-pulse">
                Memuat status model...
              </div>
            ) : uploadLocked ? (
              <div className="rounded-md border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink-subtle">
                ✅ Data penjualan awal sudah diunggah. Model telah dikunci untuk akun Anda guna mencegah data bertabrakan.
              </div>
            ) : (
              <input
                id="sales-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isTraining}
                className="block w-full text-sm text-ink-subtle file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            
            {isMounted && (
              <>
                {selectedFileName && !uploadLocked ? <p className="mt-2 text-sm text-ink-subtle">File terpilih: {selectedFileName}</p> : null}
                {modelStatus === 'ready' && !uploadMessage ? <p className="mt-2 text-sm text-primary font-medium">Upload data penjualan sudah selesai. Model siap digunakan.</p> : null}
                {(modelStatus === 'training' || isTraining) ? <p className="mt-2 text-sm text-primary">Sedang melatih model...</p> : null}
                {modelStatus === 'error' ? <p className="mt-2 text-sm text-red-600">Model belum siap. Silakan coba lagi.</p> : null}
                {uploadMessage ? <p className="mt-2 text-sm text-primary">{uploadMessage}</p> : null}
                {uploadError ? <p className="mt-2 text-sm text-red-600">{uploadError}</p> : null}
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[14px] text-ink-muted mb-1.5">Tanggal Hari Ini</label>
              <div className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-[16px] text-ink">
                {date}
              </div>
            </div>

            <div>
              <label className="block text-[14px] text-ink-muted mb-2">Cuaca Riil</label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {WEATHER_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setWeather(option)}
                      className={`px-[14px] py-1.5 rounded-full text-[14px] font-medium transition-colors ${
                        weather === option ? 'bg-surface-2 text-ink' : 'text-ink-subtle hover:text-ink'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="rounded-md border border-hairline bg-canvas px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[16px] font-medium text-ink">
                        {weatherLoading ? 'Memuat cuaca...' : weather}
                      </p>
                      {weatherError && <p className="text-[12px] text-ink-subtle mt-1">{weatherError}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[14px] text-ink-muted mb-2">
                Jumlah Terjual (per menu)
              </label>
              {menus.length === 0 ? (
                <div className="rounded-lg border border-dashed border-hairline bg-canvas px-4 py-6 text-sm text-ink-subtle">
                  Silakan unggah data penjualan CSV toko Anda untuk mengaktifkan fitur prediksi AI.
                </div>
              ) : (
                <div className="space-y-3">
                  {menus.map((menu) => (
                    <div key={menu.id} className="flex items-center gap-3">
                      <span className="flex-1 text-[16px] text-ink">{menu.name}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={sales[menu.id] ?? ''}
                          onChange={(e) => setSales((prev) => ({ ...prev, [menu.id]: e.target.value }))}
                          className="w-24 bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                        />
                        <span className="text-[14px] text-ink-subtle w-10">porsi</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={weatherLoading || menus.length === 0}
                className="w-full px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {saved ? '✓ Tersimpan' : 'Simpan Penjualan'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">
            Histori Terbaru
          </h2>
          {recentHistory.length === 0 ? (
            <p className="text-[14px] text-ink-subtle">Belum ada data penjualan.</p>
          ) : (
            <div className="space-y-0">
              {recentHistory.map((record, i) => (
                <div
                  key={record.date}
                  className={`py-4 ${i < recentHistory.length - 1 ? 'border-b border-hairline' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-ink">{record.date}</span>
                      <span className="text-[12px] text-ink-subtle">{record.day_of_week}</span>
                    </div>
                    <span className="text-[12px] px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted border border-hairline">
                      {record.condition === 'Normal' ? 'Cerah' : record.condition}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(record.sales).map(([menuId, qty]) => {
                      const menu = menus.find((m) => m.id === menuId);
                      return (
                        <span key={menuId} className="text-[13px] text-ink-subtle">
                          {menu?.name ?? menuId}: <span className="text-ink-muted">{qty}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
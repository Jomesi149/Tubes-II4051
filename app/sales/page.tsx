'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import {
  todayString,
  DAY_NAMES_EXPORTED,
  appendSalesRecord,
  getSalesHistory,
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

function buildMenusFromRows(rows: Array<Record<string, unknown>>): MenuItem[] {
  const menuMap = new Map<string, string>();
  rows.forEach((row) => {
    const rawId = String(row.menu_id ?? row.menuId ?? '').trim();
    const rawName = String(row.menu_name ?? row.menuName ?? '').trim();
    if (!rawId && !rawName) return;
    const id = rawId || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const name = rawName || id;
    if (!menuMap.has(id)) menuMap.set(id, name);
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
        return;
      }
      const forecast = forecasts[0];
      const weatherMain = forecast.weather?.[0]?.main;
      if (weatherMain === 'Clear') setWeather('Cerah');
      else if (weatherMain === 'Clouds') setWeather('Berawan');
      else setWeather('Hujan');
    } catch {
      setWeather('Berawan');
      setWeatherError('Gagal mengambil cuaca otomatis.');
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      const currentStatus = await getModelTrainingStatus();
      setModelStatus(currentStatus);
      setIsMounted(true);
      
      if (currentStatus === 'ready') {
        const loadedMenus = await getMenuList();
        if (loadedMenus.length > 0) applyMenus(loadedMenus);
        setHistory(await getSalesHistory());
      } else {
        setMenus([]);
        setHistory([]);
      }
      void fetchWeatherForDate(date);
    };

    const handleStatusChange = async () => {
      const nextStatus = await getModelTrainingStatus();
      setModelStatus(nextStatus);
      if (nextStatus === 'ready') {
        const loadedMenus = await getMenuList();
        if (loadedMenus.length > 0) applyMenus(loadedMenus);
        setHistory(await getSalesHistory());
      } else {
        setHistory([]);
      }
    };

    void load();
    window.addEventListener('ventore-model-status-changed', handleStatusChange);
    return () => window.removeEventListener('ventore-model-status-changed', handleStatusChange);
  }, []);

  const applyMenus = (nextMenus: MenuItem[]) => {
    setMenus(nextMenus);
    setSales((previous) => {
      const next: Record<string, string> = {};
      nextMenus.forEach((menu) => { next[menu.id] = previous[menu.id] ?? ''; });
      return next;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setUploadError('');
    setUploadMessage('');

    if (uploadLocked) {
      setUploadError('Upload data penjualan hanya bisa dilakukan satu kali.');
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      setUploadError('Silakan login dulu.');
      return;
    }

    try {
      const processFileData = async (nextMenus: MenuItem[]) => {
        await saveMenuList(nextMenus);
        applyMenus(nextMenus);
      };

      if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const rows = (results.data as Array<Record<string, unknown>>) ?? [];
            await processFileData(buildMenusFromRows(rows));
          },
        });
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer, { type: 'array' });
        const rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }) as Array<Record<string, unknown>>;
        await processFileData(buildMenusFromRows(rows));
      }

      const formData = new FormData();
      formData.append('action', 'retrain');
      formData.append('userId', userId);
      formData.append('file', file);

      setIsTraining(true);
      await markModelTrainingInProgress();
      setModelStatus('training');

      const response = await fetch('/api/model-prediction', { method: 'POST', body: formData });
      const textResponse = await response.text();
      let result;
      
      try {
        result = JSON.parse(textResponse);
      } catch (e) {
        if (textResponse.includes('An error occurred')) {
           await markSalesUploadCompleted(); 
           setModelStatus('ready');
           setUploadMessage('Data diterima. Model Anda sedang dilatih di server latar belakang.');
           return;
        }
        throw new Error('Terjadi kesalahan format dari server.');
      }

      if (!response.ok) throw new Error(result.error || result.message || 'Gagal melatih model.');

      if (result.status === 'training') {
        setModelStatus('training');
        return;
      }

      if (result.status === 'error') {
        await markModelTrainingError();
        setModelStatus('error');
        return;
      }

      await markSalesUploadCompleted();
      setModelStatus('ready');
      setUploadMessage('Model berhasil dilatih untuk akun Anda.');
    } catch (error) {
      console.error(error);
      await markModelTrainingError();
      setModelStatus('error');
      setUploadError('Gagal melatih model.');
    } finally {
      setIsTraining(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (menus.length === 0) return;

    const d = new Date(date);
    const dayOfWeek = DAY_NAMES_EXPORTED[d.getDay()];
    const parsedSales: Record<string, number> = {};
    menus.forEach((menu) => { parsedSales[menu.id] = parseInt(sales[menu.id] || '0', 10) || 0; });

    const record: SalesRecord = { date, day_of_week: dayOfWeek, condition: weather, sales: parsedSales };
    void appendSalesRecord(record).then(async () => { setHistory(await getSalesHistory()); });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const recentHistory = [...history].reverse().slice(0, 10);
  const menuNameById = new Map(menus.map((menu) => [menu.id, menu.name]));
  const canShowHistory = modelStatus === 'ready' && menus.length > 0 && recentHistory.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Input Penjualan</h1>
        <p className="mt-2 text-sm text-ink-subtle">Unggah data penjualan untuk melatih model AI per akun.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">Form Penjualan</h2>

          <div className="mb-5 rounded-lg border border-hairline bg-canvas p-4">
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="sales-upload">Unggah file data penjualan</label>
            {!isMounted ? (
              <div className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-subtle animate-pulse">Memuat status...</div>
            ) : uploadLocked ? (
              <div className="rounded-md border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink-subtle">Data penjualan sudah diunggah dan dikunci per akun.</div>
            ) : (
              <input id="sales-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} disabled={isTraining} className="block w-full text-sm text-ink-subtle file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-60" />
            )}
            {isMounted && (
              <>
                {selectedFileName && !uploadLocked && <p className="mt-2 text-sm text-ink-subtle">File terpilih: {selectedFileName}</p>}
                {modelStatus === 'ready' && !uploadMessage && <p className="mt-2 text-sm text-primary font-medium">Upload selesai. Model siap digunakan.</p>}
                {(modelStatus === 'training' || isTraining) && <p className="mt-2 text-sm text-primary">Sedang melatih model...</p>}
                {uploadMessage && <p className="mt-2 text-sm text-primary">{uploadMessage}</p>}
                {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[14px] text-ink-muted mb-1.5">Tanggal Hari Ini</label>
              <div className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-[16px] text-ink">{date}</div>
            </div>
            <div>
              <label className="block text-[14px] text-ink-muted mb-2">Cuaca Riil</label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {WEATHER_OPTIONS.map((option) => (
                    <button key={option} type="button" onClick={() => setWeather(option)} className={`px-[14px] py-1.5 rounded-full text-[14px] font-medium ${weather === option ? 'bg-surface-2 text-ink' : 'text-ink-subtle'}`}>{option}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[14px] text-ink-muted mb-2">Jumlah Terjual</label>
              {menus.length === 0 ? (
                <div className="rounded-lg border border-dashed border-hairline bg-canvas px-4 py-6 text-sm text-ink-subtle">Silakan unggah data penjualan toko Anda untuk mengaktifkan form menu.</div>
              ) : (
                <div className="space-y-3">
                  {menus.map((menu) => (
                    <div key={menu.id} className="flex items-center gap-3">
                      <span className="flex-1 text-[16px] text-ink">{menu.name}</span>
                      <input type="number" min="0" value={sales[menu.id] ?? ''} onChange={(e) => setSales((prev) => ({ ...prev, [menu.id]: e.target.value }))} className="w-24 bg-surface-1 border border-hairline rounded-md px-3 py-2 text-right" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={menus.length === 0} className="w-full py-2 rounded-md bg-primary text-white disabled:opacity-60">{saved ? '✓ Tersimpan' : 'Simpan Penjualan'}</button>
          </form>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-xl p-6 lg:sticky lg:top-8 lg:self-start">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">Histori Terbaru</h2>

          {!canShowHistory ? (
            <div className="rounded-lg border border-dashed border-hairline bg-canvas px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink">Histori penjualan masih kosong.</p>
              <p className="mt-2 text-sm text-ink-subtle">
                {modelStatus === 'ready' && menus.length > 0
                  ? 'Silakan isi form penjualan lalu tekan Simpan Penjualan.'
                  : 'Silakan unggah CSV data penjualan terlebih dahulu untuk mengaktifkan menu.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {recentHistory.map((record) => (
                <div key={record.date} className="border-b border-hairline pb-5 last:border-b-0 last:pb-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{record.date}</p>
                      <p className="mt-0.5 text-xs text-ink-tertiary">{record.day_of_week}</p>
                    </div>
                    <span className="rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-ink-subtle">{record.condition}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(record.sales).map(([menuId, quantity]) => (
                      <div key={menuId} className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-ink-subtle">{menuNameById.get(menuId) ?? menuId.replace(/_/g, ' ')}</span>
                        <span className="shrink-0 font-mono font-semibold text-ink">{quantity}</span>
                      </div>
                    ))}
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

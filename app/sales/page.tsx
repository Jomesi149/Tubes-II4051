'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import {
  initializeIfNeeded,
  getMenuList,
  getSalesHistory,
  appendSalesRecord,
  todayString,
  DAY_NAMES_EXPORTED,
} from '@/lib/storage';
import { WEATHER_OPTIONS, type WeatherOption } from '@/lib/model-prediction';
import type { MenuItem, SalesRecord } from '@/lib/types';

export default function SalesPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<SalesRecord[]>([]);
  const date = todayString();
  const [weather, setWeather] = useState<WeatherOption>('Berawan');
  const [sales, setSales] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');

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
    initializeIfNeeded();
    const m = getMenuList();
    setMenus(m);
    setHistory(getSalesHistory());
    const initial: Record<string, string> = {};
    m.forEach((menu) => {
      initial[menu.id] = '';
    });
    setSales(initial);
    void fetchWeatherForDate(date);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    appendSalesRecord(record);
    setHistory(getSalesHistory());
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
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">
            Form Penjualan
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Date */}
            <div>
              <label className="block text-[14px] text-ink-muted mb-1.5">Tanggal Hari Ini</label>
              <div className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-[16px] text-ink">
                {date}
              </div>
            </div>

            {/* Weather */}
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

            {/* Per-menu inputs */}
            <div>
              <label className="block text-[14px] text-ink-muted mb-2">
                Jumlah Terjual (per menu)
              </label>
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
                        onChange={(e) =>
                          setSales((prev) => ({ ...prev, [menu.id]: e.target.value }))
                        }
                        className="w-24 bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink text-right focus:outline-none focus:border-hairline-strong"
                      />
                      <span className="text-[14px] text-ink-subtle w-10">porsi</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={weatherLoading}
                className="w-full px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {saved ? '✓ Tersimpan' : 'Simpan Penjualan'}
              </button>
            </div>
          </form>
        </div>

        {/* History */}
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

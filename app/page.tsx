'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initializeIfNeeded, getWasteLog, formatRp, todayString } from '@/lib/storage';
import type { ModelPredictionResponse, WeatherOption } from '@/lib/model-prediction';
import { MODEL_MENU } from '@/lib/model-prediction';

interface DashboardData {
  predictionDate: string;
  weather: string;
  eventLabel: string;
  totalQty: number;
  totalRevenue: number;
  topMenu: string;
  totalWasteLoss: number;
  predictions: Array<{ menu_id: string; menu_name: string; predicted_qty: number; predicted_revenue: number }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    initializeIfNeeded();
    const wasteLog = getWasteLog();
    const totalWasteLoss = wasteLog.reduce((sum, r) => sum + r.total_daily_loss, 0);

    async function loadPrediction() {
      try {
        // Get today's date
        const today = todayString();
        const dateObj = new Date(today);

        // Auto-detect weather for today
        let weather: WeatherOption = 'Berawan';
        let event: string = 'missing';

        try {
          const weatherResponse = await fetch(
            'https://api.openweathermap.org/data/2.5/forecast?lat=-6.9175&lon=107.6191&appid=717b64c259b63d6656a8032709d0a797&units=metric'
          );
          const weatherData = await weatherResponse.json();

          if (weatherData.list && weatherData.list.length > 0) {
            const todayForecasts = weatherData.list.filter((f: { dt_txt: string }) =>
              f.dt_txt.startsWith(today)
            );

            if (todayForecasts.length > 0) {
              const forecast = todayForecasts[0];
              const weatherMain = forecast.weather?.[0]?.main;
              const weatherId = forecast.weather?.[0]?.id;

              if (weatherMain === 'Clear' || weatherId === 800) {
                weather = 'Cerah';
              } else if (weatherMain === 'Clouds' || (weatherId >= 801 && weatherId <= 804)) {
                weather = 'Berawan';
              } else if (
                weatherMain === 'Rain' ||
                weatherMain === 'Drizzle' ||
                weatherMain === 'Thunderstorm'
              ) {
                weather = 'Hujan';
              }
            }
          }
        } catch (err) {
          console.error('Weather fetch failed:', err);
        }

        // Auto-detect event for today
        if (dateObj.getDate() === 1) {
          event = 'Promo Awal Bulan';
        } else if (dateObj.getDay() === 5) {
          event = 'Promo Jumat Berkah';
        }

        // Fetch prediction
        const response = await fetch('/api/model-prediction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weather, event }),
        });

        const prediction = (await response.json()) as ModelPredictionResponse;
        setData({
          predictionDate: prediction.prediction_date,
          weather: prediction.weather,
          eventLabel: prediction.event_label,
          totalQty: prediction.total_qty,
          totalRevenue: prediction.total_revenue,
          topMenu: prediction.top_menu,
          totalWasteLoss,
          predictions: prediction.predictions,
        });
      } catch {
        setData({
          predictionDate: '-',
          weather: 'Berawan',
          eventLabel: 'Tidak Ada',
          totalQty: 0,
          totalRevenue: 0,
          topMenu: '-',
          totalWasteLoss: 0,
          predictions: [],
        });
      }
    }

    void loadPrediction();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-subtle text-sm">
        Memuat data...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/recommendation"
          className="group block bg-surface-1 border border-hairline rounded-lg p-6 hover:bg-surface-2 transition-colors"
        >
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-3">
            Total Prediksi Porsi
          </p>
          <p className="text-[40px] font-semibold text-ink tracking-[-1px] leading-none mb-1">
            {data.totalQty}
          </p>
          <p className="text-[14px] text-ink-muted">{data.weather} · {data.eventLabel}</p>
          <p className="text-[13px] text-primary mt-4 group-hover:text-primary-hover transition-colors">
            Lihat prediksi →
          </p>
        </Link>

        <div className="group block bg-surface-1 border border-hairline rounded-lg p-6">
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-3">
            Komoditas Teratas
          </p>
          <p className="text-[28px] font-semibold text-ink tracking-[-0.8px] leading-none mb-1">
            {data.topMenu}
          </p>
          <p className="text-[14px] text-ink-muted">Prediksi paling tinggi untuk sesi berikutnya</p>
        </div>

        <Link
          href="/waste"
          className="group block bg-surface-1 border border-hairline rounded-lg p-6 hover:bg-surface-2 transition-colors"
        >
          <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-3">
            Total Waste (Periode)
          </p>
          <p className="text-[40px] font-semibold text-ink tracking-[-1px] leading-none mb-1">
            {formatRp(data.totalWasteLoss)}
          </p>
          <p className="text-[14px] text-ink-muted">akumulasi kerugian</p>
          <p className="text-[13px] text-primary mt-4 group-hover:text-primary-hover transition-colors">
            Lihat log waste →
          </p>
        </Link>
      </div>

      <div className="mt-6 bg-surface-1 border border-hairline rounded-lg p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.4px] text-ink-subtle mb-1">Tanggal Prediksi</p>
          <p className="text-[18px] font-medium text-ink">{data.predictionDate}</p>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.4px] text-ink-subtle mb-1">Revenue Model</p>
          <p className="text-[18px] font-medium text-ink">{formatRp(data.totalRevenue)}</p>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.4px] text-ink-subtle mb-1">Waste Akumulasi</p>
          <p className="text-[18px] font-medium text-ink">{formatRp(data.totalWasteLoss)}</p>
        </div>
      </div>

      {/* Predicted quantities for all products */}
      <div className="mt-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-4">
          Prediksi Jumlah Produk Hari Ini
        </p>
        <div className="overflow-x-auto border border-hairline rounded-lg">
          <table className="min-w-full text-left bg-surface-1">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Komoditas</th>
                <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Qty Prediksi</th>
                <th className="px-4 py-3 text-[12px] uppercase tracking-[0.4px] text-ink-subtle">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.predictions && data.predictions.length > 0 ? (
                data.predictions.map((pred, idx) => (
                  <tr key={pred.menu_id} className={`${idx < data.predictions.length - 1 ? 'border-b border-hairline' : ''}`}>
                    <td className="px-4 py-3 text-[14px] text-ink font-medium">{pred.menu_name}</td>
                    <td className="px-4 py-3 text-[14px] text-ink">{pred.predicted_qty}</td>
                    <td className="px-4 py-3 text-[14px] text-ink-muted">{formatRp(pred.predicted_revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-[14px] text-ink-subtle text-center">
                    Belum ada prediksi. Coba buka halaman Prediksi Model.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-4">
          Aksi Cepat
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/recommendation"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Buka Prediksi Model
          </Link>
          <Link
            href="/sales"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
          >
            Input Penjualan Hari Ini
          </Link>
          <Link
            href="/waste"
            className="px-[14px] py-2 rounded-md text-[14px] font-medium bg-surface-1 border border-hairline text-ink hover:bg-surface-2 transition-colors"
          >
            Catat Waste
          </Link>
        </div>
      </div>
    </div>
  );
}

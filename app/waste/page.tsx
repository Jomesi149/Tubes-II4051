'use client';

import { useEffect, useState } from 'react';
import {
  initializeIfNeeded,
  getWasteLog,
  appendWasteRecord,
  getIngredientPrices,
  formatRp,
  todayString,
} from '@/lib/storage';
import type { WasteReason, WasteRecord, WasteItem } from '@/lib/types';

const REASONS: WasteReason[] = ['Rusak', 'Kedaluwarsa', 'Sisa Produksi'];

interface ChartPoint {
  date: string;
  total: number;
}

function WasteChart({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-[14px] text-ink-subtle py-8 text-center">
        Belum cukup data untuk ditampilkan (min. 2 hari)
      </p>
    );
  }

  const W = 600;
  const H = 160;
  const PAD = { t: 12, r: 12, b: 32, l: 56 };

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  const xScale = (i: number) =>
    PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const yScale = (v: number) =>
    H - PAD.b - (v / maxVal) * (H - PAD.t - PAD.b);

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(d.total).toFixed(1)}`)
    .join(' ');

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const xStep = Math.ceil(data.length / 5);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      aria-label="Tren waste harian"
    >
      {/* grid lines */}
      {yTicks.map((v) => (
        <line
          key={v}
          x1={PAD.l}
          y1={yScale(v)}
          x2={W - PAD.r}
          y2={yScale(v)}
          stroke="#23252a"
          strokeWidth="1"
        />
      ))}
      {/* area fill */}
      <path
        d={`${path} L${xScale(data.length - 1).toFixed(1)},${yScale(0).toFixed(1)} L${xScale(0).toFixed(1)},${yScale(0).toFixed(1)} Z`}
        fill="#5e6ad2"
        fillOpacity="0.08"
      />
      {/* line */}
      <path d={path} fill="none" stroke="#5e6ad2" strokeWidth="1.5" strokeLinejoin="round" />
      {/* dots */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.total)} r="3" fill="#5e6ad2" />
      ))}
      {/* x labels */}
      {data.map((d, i) => {
        if (i % xStep !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={i}
            x={xScale(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#8a8f98"
          >
            {d.date.slice(5)}
          </text>
        );
      })}
      {/* y labels */}
      {yTicks.map((v) => (
        <text
          key={v}
          x={PAD.l - 4}
          y={yScale(v)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize="10"
          fill="#8a8f98"
        >
          {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
        </text>
      ))}
    </svg>
  );
}

export default function WastePage() {
  const [log, setLog] = useState<WasteRecord[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [date, setDate] = useState(todayString());
  const [ingredient, setIngredient] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('gram');
  const [reason, setReason] = useState<WasteReason>('Sisa Produksi');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    initializeIfNeeded();
    setLog(getWasteLog());
    setPrices(getIngredientPrices());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredient.trim() || !quantity) return;

    const qty = parseFloat(quantity);
    const unitPrice = prices[ingredient.trim().replace(/ /g, '_')] ?? 0;
    const totalLoss = qty * unitPrice;

    const item: WasteItem = {
      ingredient: ingredient.trim(),
      quantity: qty,
      unit,
      reason,
      unit_price: unitPrice,
      total_loss: totalLoss,
    };

    const record: WasteRecord = { date, items: [item], total_daily_loss: totalLoss };
    appendWasteRecord(record);

    const newLog = getWasteLog();
    setLog(newLog);
    setSaved(true);
    setIngredient('');
    setQuantity('');
    setTimeout(() => setSaved(false), 2500);
  };

  // Chart data
  const chartData: ChartPoint[] = [...log]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, total: r.total_daily_loss }));

  // Metrics
  const totalLoss = log.reduce((s, r) => s + r.total_daily_loss, 0);

  const sortedByDate = [...log].sort((a, b) => a.date.localeCompare(b.date));
  const midIdx = Math.floor(sortedByDate.length / 2);
  const firstHalf = sortedByDate.slice(0, midIdx);
  const secondHalf = sortedByDate.slice(midIdx);
  const firstHalfTotal = firstHalf.reduce((s, r) => s + r.total_daily_loss, 0);
  const secondHalfTotal = secondHalf.reduce((s, r) => s + r.total_daily_loss, 0);
  const wasteReduction =
    firstHalfTotal > 0 ? ((firstHalfTotal - secondHalfTotal) / firstHalfTotal) * 100 : null;
  const kpiMet = wasteReduction !== null && wasteReduction >= 25;

  const recentLog = [...log].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-1">
          Modul 5
        </p>
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">Log Waste</h1>
        <p className="text-[16px] text-ink-muted mt-1">
          Catat dan evaluasi pembuangan bahan baku harian
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6">
          <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-6">
            Catat Waste
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-[14px] text-ink-muted mb-1.5">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink focus:outline-none focus:border-hairline-strong"
              />
            </div>

            {/* Ingredient */}
            <div>
              <label className="block text-[14px] text-ink-muted mb-1.5">Nama Bahan</label>
              <input
                type="text"
                value={ingredient}
                onChange={(e) => setIngredient(e.target.value)}
                placeholder="cth: beras, ayam, telur"
                required
                className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-hairline-strong"
              />
            </div>

            {/* Quantity + unit */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[14px] text-ink-muted mb-1.5">Jumlah</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full bg-surface-1 border border-hairline rounded-md px-3 py-2 text-[16px] text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-hairline-strong"
                />
              </div>
              <div className="w-24">
                <label className="block text-[14px] text-ink-muted mb-1.5">Satuan</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-surface-1 border border-hairline rounded-md px-2 py-2 text-[16px] text-ink focus:outline-none focus:border-hairline-strong"
                >
                  <option value="gram">gram</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="liter">liter</option>
                  <option value="butir">butir</option>
                  <option value="unit">unit</option>
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[14px] text-ink-muted mb-2">Alasan</label>
              <div className="flex flex-wrap gap-2 bg-canvas rounded-full p-1 w-fit border border-hairline">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`px-[10px] py-1 rounded-full text-[13px] font-medium transition-colors ${
                      reason === r
                        ? 'bg-surface-2 text-ink'
                        : 'text-ink-subtle hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost preview */}
            {ingredient && quantity && prices[ingredient.trim().replace(/ /g, '_')] !== undefined && (
              <div className="bg-surface-2 rounded-md px-4 py-3">
                <p className="text-[13px] text-ink-subtle">Estimasi kerugian:</p>
                <p className="text-[22px] font-medium text-ink tracking-[-0.4px]">
                  {formatRp(
                    parseFloat(quantity) *
                      (prices[ingredient.trim().replace(/ /g, '_')] ?? 0)
                  )}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full px-[14px] py-2 rounded-md text-[14px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              {saved ? '✓ Tersimpan' : 'Simpan Waste'}
            </button>
          </form>
        </div>

        {/* Right column: chart + metrics + log */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-surface-1 border border-hairline rounded-lg p-4">
              <p className="text-[13px] text-ink-subtle uppercase tracking-[0.4px] mb-2">
                Total Kerugian
              </p>
              <p className="text-[28px] font-semibold text-ink tracking-[-0.6px]">
                {formatRp(totalLoss)}
              </p>
            </div>
            <div className="bg-surface-1 border border-hairline rounded-lg p-4">
              <p className="text-[13px] text-ink-subtle uppercase tracking-[0.4px] mb-2">
                Entri Waste
              </p>
              <p className="text-[28px] font-semibold text-ink tracking-[-0.6px]">{log.length}</p>
              <p className="text-[13px] text-ink-subtle">hari dicatat</p>
            </div>
            <div className="bg-surface-1 border border-hairline rounded-lg p-4 col-span-2 sm:col-span-1">
              <p className="text-[13px] text-ink-subtle uppercase tracking-[0.4px] mb-2">
                KPI Waste Reduction
              </p>
              {wasteReduction !== null ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-[28px] font-semibold text-ink tracking-[-0.6px]">
                      {wasteReduction > 0 ? '−' : '+'}
                      {Math.abs(wasteReduction).toFixed(0)}%
                    </p>
                    {kpiMet ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/15 text-success border border-success/20">
                        ✓ Target
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-muted border border-hairline">
                        Target ≥25%
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink-tertiary mt-1">vs paruh pertama periode</p>
                </>
              ) : (
                <p className="text-[14px] text-ink-subtle">Butuh lebih banyak data</p>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-surface-1 border border-hairline rounded-xl p-6">
            <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">
              Tren Kerugian Waste
            </h2>
            <WasteChart data={chartData} />
          </div>

          {/* Log history */}
          <div className="bg-surface-1 border border-hairline rounded-xl p-6">
            <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px] mb-4">
              Riwayat Waste
            </h2>
            {recentLog.length === 0 ? (
              <p className="text-[14px] text-ink-subtle">Belum ada catatan waste.</p>
            ) : (
              <div className="space-y-0">
                {recentLog.map((record, i) => (
                  <div
                    key={`${record.date}-${i}`}
                    className={`py-4 ${i < recentLog.length - 1 ? 'border-b border-hairline' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[14px] font-medium text-ink">{record.date}</span>
                      <span className="text-[14px] font-medium text-ink">
                        {formatRp(record.total_daily_loss)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {record.items.map((item, j) => (
                        <div key={j} className="flex items-center justify-between text-[13px] text-ink-subtle">
                          <span>
                            {item.ingredient} — {item.quantity} {item.unit} ({item.reason})
                          </span>
                          <span className="text-ink-tertiary">{formatRp(item.total_loss)}</span>
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
    </div>
  );
}

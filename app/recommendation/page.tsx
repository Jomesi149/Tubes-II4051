'use client';

import { useEffect, useState } from 'react';
import { initializeIfNeeded, getMenuList, getSalesHistory } from '@/lib/storage';
import { calculateRecommendations } from '@/lib/recommendation';
import type { DayCondition, RecommendationResult } from '@/lib/types';

const CONDITIONS: DayCondition[] = ['Normal', 'Ramai', 'Hujan'];
const N_DAYS_OPTIONS = [7, 14];

const CONDITION_LABEL: Record<DayCondition, string> = {
  Normal: 'Normal',
  Ramai: 'Ramai ☀',
  Hujan: 'Hujan ☂',
};

const CONDITION_MULTIPLIER: Record<DayCondition, string> = {
  Normal: '×1.00',
  Ramai: '×1.25',
  Hujan: '×0.80',
};

export default function RecommendationPage() {
  const [condition, setCondition] = useState<DayCondition>('Normal');
  const [nDays, setNDays] = useState(7);
  const [results, setResults] = useState<RecommendationResult[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeIfNeeded();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const menus = getMenuList();
    const history = getSalesHistory();
    setResults(calculateRecommendations(history, menus, condition, nDays));
  }, [condition, nDays, ready]);

  const totalFinal = results.reduce((s, r) => s + r.final, 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto">
      <div className="mb-8">
        <p className="text-[13px] font-medium text-ink-subtle tracking-[0.4px] uppercase mb-1">
          Modul 2
        </p>
        <h1 className="text-[28px] font-semibold text-ink tracking-[-0.6px]">
          Recommendation Engine
        </h1>
        <p className="text-[16px] text-ink-muted mt-1">
          Rekomendasi produksi harian berbasis Moving Average
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface-1 border border-hairline rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Kondisi */}
          <div>
            <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-3">
              Kondisi Hari Ini
            </p>
            <div className="flex gap-2 bg-canvas rounded-full p-1 w-fit">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`px-[14px] py-1.5 rounded-full text-[14px] font-medium transition-colors ${
                    condition === c
                      ? 'bg-surface-2 text-ink'
                      : 'text-ink-subtle hover:text-ink'
                  }`}
                >
                  {CONDITION_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Periode MA */}
          <div>
            <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-3">
              Periode Moving Average
            </p>
            <div className="flex gap-2 bg-canvas rounded-full p-1 w-fit">
              {N_DAYS_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setNDays(n)}
                  className={`px-[14px] py-1.5 rounded-full text-[14px] font-medium transition-colors ${
                    nDays === n
                      ? 'bg-surface-2 text-ink'
                      : 'text-ink-subtle hover:text-ink'
                  }`}
                >
                  {n} hari
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-hairline flex items-center gap-4">
          <div>
            <p className="text-[12px] text-ink-subtle">Bobot kondisi</p>
            <p className="text-[22px] font-medium text-ink tracking-[-0.4px]">
              {CONDITION_MULTIPLIER[condition]}
            </p>
          </div>
          <div className="h-8 w-px bg-hairline" />
          <div>
            <p className="text-[12px] text-ink-subtle">Buffer produksi</p>
            <p className="text-[22px] font-medium text-ink tracking-[-0.4px]">+10%</p>
          </div>
          <div className="h-8 w-px bg-hairline" />
          <div>
            <p className="text-[12px] text-ink-subtle">Total porsi hari ini</p>
            <p className="text-[22px] font-medium text-ink tracking-[-0.4px]">{totalFinal}</p>
          </div>
        </div>
      </div>

      {/* Per-menu recommendations */}
      <div className="space-y-4">
        {results.map((result) => (
          <div
            key={result.menuId}
            className="bg-surface-1 border border-hairline rounded-lg p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-[22px] font-medium text-ink tracking-[-0.4px]">
                  {result.menuName}
                </h2>
                <p className="text-[14px] text-ink-subtle mt-0.5">
                  MA {nDays}h: {Math.round(result.ma)} porsi
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[40px] font-semibold text-ink tracking-[-1px] leading-none">
                  {result.final}
                </p>
                <p className="text-[14px] text-ink-muted">porsi</p>
              </div>
            </div>

            {/* Rationalization */}
            <div className="bg-surface-2 rounded-md px-4 py-3">
              <p className="text-[13px] text-ink-muted font-mono leading-relaxed">
                {result.rationalization}
              </p>
            </div>

            {/* Calculation steps */}
            <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-ink-tertiary">
              <span>MA = {result.ma.toFixed(1)} porsi</span>
              <span className="text-hairline-strong">·</span>
              <span>×(1+10%) = {(result.ma * 1.1).toFixed(1)}</span>
              <span className="text-hairline-strong">·</span>
              <span>{CONDITION_MULTIPLIER[condition]} kondisi = <strong className="text-ink-subtle">{result.final} porsi</strong></span>
            </div>
          </div>
        ))}

        {results.length === 0 && (
          <div className="text-center py-16 text-ink-subtle text-sm">
            Memuat rekomendasi...
          </div>
        )}
      </div>

      {/* Formula reference */}
      <div className="mt-8 bg-surface-1 border border-hairline rounded-lg p-6">
        <p className="text-[13px] font-medium text-ink-subtle uppercase tracking-[0.4px] mb-3">
          Formula Kalkulasi
        </p>
        <div className="font-mono text-[13px] text-ink-muted space-y-1">
          <p>MA = Σ(penjualan N hari terakhir) / N</p>
          <p>Rekomendasi_Dasar = MA × (1 + 0.10)</p>
          <p>Rekomendasi_Final = Rekomendasi_Dasar × bobot_kondisi</p>
        </div>
      </div>
    </div>
  );
}

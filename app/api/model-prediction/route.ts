import { spawnSync } from 'child_process';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import type { EventOptionValue, WeatherOption } from '@/lib/model-prediction';

export const runtime = 'nodejs';

type Body = {
  weather?: WeatherOption;
  event?: EventOptionValue;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const weather = body.weather ?? 'Berawan';
  const event = body.event ?? 'missing';

  const scriptPath = path.join(process.cwd(), 'train_model', 'predict.py');
  const result = spawnSync('python', [scriptPath, '--weather', weather, '--event', event, '--json'], {
    encoding: 'utf-8',
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    return NextResponse.json(
      {
        message: 'Gagal menjalankan model prediksi.',
        error: result.stderr || result.stdout || 'Unknown error',
      },
      { status: 500 }
    );
  }

  try {
    const payload = JSON.parse(result.stdout);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      {
        message: 'Model mengembalikan output yang tidak valid.',
        error: result.stdout,
      },
      { status: 500 }
    );
  }
}

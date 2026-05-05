import { NextRequest, NextResponse } from 'next/server';
import type { EventOptionValue, WeatherOption } from '@/lib/model-prediction';

export const runtime = 'nodejs';

const DEFAULT_HF_SPACE_ID = 'hakimgans/ventoree';
const DEFAULT_HF_API_NAME = 'predict';

type Body = {
  weather?: WeatherOption;
  event?: EventOptionValue;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const weather = body.weather ?? 'Berawan';
  const event = body.event ?? 'missing';

  const hfSpaceId = process.env.HF_SPACE_ID || process.env.NEXT_PUBLIC_HF_SPACE_ID || DEFAULT_HF_SPACE_ID;
  const hfApiBaseUrl =
    process.env.HF_API_URL_BASE ||
    `https://${hfSpaceId.replace('/', '-')}.hf.space`;
  const hfApiName = process.env.HF_API_NAME || DEFAULT_HF_API_NAME;
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;

  const apiBaseCandidates = [
    hfApiBaseUrl,
    `${hfApiBaseUrl}/gradio_api`,
  ];

  async function fetchWithAuth(url: string, init: RequestInit) {
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
      },
    });
  }

  async function tryStartPrediction(baseUrl: string) {
    return fetchWithAuth(`${baseUrl}/call/${hfApiName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: [weather, event],
      }),
    });
  }

  async function tryFetchResult(baseUrl: string, eventId: string) {
    return fetchWithAuth(`${baseUrl}/call/${hfApiName}/${eventId}`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
    });
  }

  try {
    let lastError = '';

    for (const baseUrl of apiBaseCandidates) {
      const predictResponse = await tryStartPrediction(baseUrl);
      const startText = await predictResponse.text();
      let startPayload: unknown = null;

      try {
        startPayload = JSON.parse(startText);
      } catch {
        startPayload = startText;
      }

      if (!predictResponse.ok) {
        lastError = typeof startPayload === 'string' ? startPayload : JSON.stringify(startPayload);
        continue;
      }

      const eventId =
        startPayload && typeof startPayload === 'object' && 'event_id' in startPayload
          ? String((startPayload as { event_id?: string }).event_id ?? '')
          : '';

      if (!eventId) {
        lastError = typeof startPayload === 'string' ? startPayload : JSON.stringify(startPayload);
        continue;
      }

      const streamResponse = await tryFetchResult(baseUrl, eventId);
      const streamText = await streamResponse.text();

      if (!streamResponse.ok) {
        lastError = streamText;
        continue;
      }

      const finalLine = streamText
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('data:'));

      if (!finalLine) {
        lastError = streamText;
        continue;
      }

      const parsedData = finalLine.replace(/^data:\s*/, '');

      try {
        const payload = JSON.parse(parsedData) as unknown;

        const extractResult = (value: unknown): unknown => {
          if (Array.isArray(value)) {
            if (value.length >= 3 && value[2] && typeof value[2] === 'object') {
              return value[2];
            }

            if (value.length >= 1 && value[0] && typeof value[0] === 'object') {
              return value[0];
            }
          }

          if (value && typeof value === 'object' && 'data' in value) {
            const dataPayload = value as { data?: unknown };
            return extractResult(dataPayload.data);
          }

          return value;
        };

        const modelResult = extractResult(payload);

        if (modelResult && typeof modelResult === 'object' && !Array.isArray(modelResult)) {
          return NextResponse.json(modelResult);
        }

        return NextResponse.json(payload);
      } catch {
        return NextResponse.json({ message: 'Gagal mem-parsing hasil Hugging Face.', error: parsedData }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        message: 'Hugging Face tidak bisa dihubungi dengan endpoint Gradio yang tersedia.',
        error: lastError || 'Not Found',
      },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Gagal menghubungkan ke Hugging Face.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

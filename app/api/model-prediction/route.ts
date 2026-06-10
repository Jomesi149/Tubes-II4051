import { NextRequest, NextResponse } from 'next/server';
import type { EventOptionValue, WeatherOption } from '@/lib/model-prediction';

export const runtime = 'nodejs';

const DEFAULT_HF_SPACE_ID = 'hakimgans/ventoree';
const DEFAULT_HF_PREDICT_API_NAME = 'predict';
const DEFAULT_HF_RETRAIN_API_NAME = 'retrain';

type Body = {
  action?: 'predict' | 'retrain';
  userId?: string;
  weather?: WeatherOption;
  event?: EventOptionValue;
};

function getUserId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const hfSpaceId = process.env.HF_SPACE_ID || process.env.NEXT_PUBLIC_HF_SPACE_ID || DEFAULT_HF_SPACE_ID;
  const hfApiBaseUrl = (process.env.HF_API_URL_BASE || `https://${hfSpaceId.replace('/', '-')}.hf.space`).replace(/\/+$/, '');
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;

  const apiBaseCandidates = [hfApiBaseUrl, `${hfApiBaseUrl}/gradio_api`];

  function buildGradioApiUrl(baseUrl: string, path: string) {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    if (normalizedBase.endsWith('/gradio_api')) {
      return `${normalizedBase}${path}`;
    }
    return `${normalizedBase}/gradio_api${path}`;
  }

  async function fetchWithAuth(url: string, init: RequestInit) {
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
      },
    });
  }

  async function tryStartPrediction(baseUrl: string, apiName: string, payload: unknown) {
    return fetchWithAuth(buildGradioApiUrl(baseUrl, `/call/${apiName}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  // Fungsi handal untuk mengambil string path file dari endpoint upload
  function extractUploadPath(payload: unknown): string {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;

    if (Array.isArray(payload)) {
      const [firstValue] = payload;
      if (typeof firstValue === 'string') return firstValue;
      if (firstValue && typeof firstValue === 'object' && 'path' in firstValue) {
        return String((firstValue as { path?: unknown }).path);
      }
      return '';
    }

    if (typeof payload === 'object') {
      if ('path' in payload) {
        return String((payload as { path?: unknown }).path);
      }
      if ('data' in payload) {
        return extractUploadPath((payload as { data?: unknown }).data);
      }
    }
    return '';
  }

  async function tryFetchResult(baseUrl: string, apiName: string, eventId: string) {
    return fetchWithAuth(buildGradioApiUrl(baseUrl, `/call/${apiName}/${eventId}`), {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
    });
  }

  function extractEventId(payload: unknown): string {
    if (payload && typeof payload === 'object') {
      const candidate = payload as { event_id?: unknown; eventId?: unknown };
      const eventId = candidate.event_id ?? candidate.eventId;
      return typeof eventId === 'string' ? eventId : '';
    }

    return '';
  }

  async function readEventStreamText(response: Response) {
    return response.text();
  }

  function extractStreamPayload(streamText: string): string {
    const finalLine = streamText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('data:'));

    return finalLine ? finalLine.replace(/^data:\s*/, '') : '';
  }

  try {
    let action: 'predict' | 'retrain' = 'predict';
    let userId = '';
    let weather: WeatherOption = 'Berawan';
    let event: EventOptionValue = 'missing';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      action = (formData.get('action') as string | null) === 'retrain' ? 'retrain' : 'predict';
      userId = getUserId(formData.get('userId'));

      if (action === 'retrain') {
        if (!userId) {
          return NextResponse.json({ message: 'userId wajib diisi untuk retraining.' }, { status: 401 });
        }

        const file = formData.get('file');
        if (!(file instanceof File) || !file.size) {
          return NextResponse.json({ message: 'File CSV atau Excel wajib diunggah.' }, { status: 400 });
        }

        const uploadForm = new FormData();
        uploadForm.append('files', file, file.name);

        const uploadResponse = await fetchWithAuth(buildGradioApiUrl(hfApiBaseUrl, '/upload'), {
          method: 'POST',
          body: uploadForm,
        });
        const uploadText = await uploadResponse.text();
        let uploadPayload: unknown = null;
        try {
          uploadPayload = JSON.parse(uploadText);
        } catch {
          uploadPayload = uploadText;
        }

        if (!uploadResponse.ok) {
          return NextResponse.json(
            { message: 'Gagal mengunggah file ke Hugging Face.', error: uploadText },
            { status: 502 }
          );
        }

        // Ambil string path
        const uploadedPath = extractUploadPath(uploadPayload);

        if (!uploadedPath) {
          return NextResponse.json({ message: 'Hugging Face tidak mengembalikan path unggahan.', error: uploadText }, { status: 502 });
        }

        // BENTUK OBJEK GRADIO SECARA MANUAL DAN STRICT
        const gradioFileData = {
          meta: { _type: "gradio.FileData" },
          path: uploadedPath,
          orig_name: file.name,
          size: file.size,
          mime_type: file.type || "text/csv",
        };

        const hfApiName = process.env.HF_RETRAIN_API_NAME || DEFAULT_HF_RETRAIN_API_NAME;
        const retrainResponse = await fetchWithAuth(buildGradioApiUrl(hfApiBaseUrl, `/call/${hfApiName}`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            data: [userId, gradioFileData], // Kirim objek rakitan kita yang sangat valid
          }),
        });
        
        const retrainText = await retrainResponse.text();

        if (!retrainResponse.ok) {
          return NextResponse.json({ message: 'Gagal melatih model.', error: retrainText }, { status: 502 });
        }

        let retrainPayload: unknown = null;
        try {
          retrainPayload = JSON.parse(retrainText);
        } catch {
          retrainPayload = retrainText;
        }

        const eventId = extractEventId(retrainPayload);
        if (!eventId) {
          return NextResponse.json(
            { message: retrainText || 'Model sedang dilatih.', success: true, status: 'training' },
            { status: 200 }
          );
        }

        const maxPollAttempts = 8;
        let finalPayload = '';

        for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
          const streamResponse = await tryFetchResult(hfApiBaseUrl, hfApiName, eventId);
          const streamText = await readEventStreamText(streamResponse);
          finalPayload = extractStreamPayload(streamText);

          if (finalPayload) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (!finalPayload) {
          return NextResponse.json(
            { message: 'Model sedang dilatih. Silakan tunggu beberapa saat.', success: true, status: 'training' },
            { status: 200 }
          );
        }

        try {
          const parsedPayload = JSON.parse(finalPayload);
          const statusValue = parsedPayload && typeof parsedPayload === 'object' && 'status' in parsedPayload
            ? String((parsedPayload as { status?: unknown }).status ?? '')
            : '';

          return NextResponse.json(
            {
              message: statusValue === 'ready' ? 'Model siap digunakan.' : 'Model sedang dilatih. Silakan tunggu beberapa saat.',
              success: true,
              status: statusValue === 'ready' ? 'ready' : 'training',
            },
            { status: 200 }
          );
        } catch {
          return NextResponse.json(
            { message: 'Model sedang dilatih. Silakan tunggu beberapa saat.', success: true, status: 'training' },
            { status: 200 }
          );
        }
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as Body;
      action = body.action === 'retrain' ? 'retrain' : 'predict';
      userId = getUserId(body.userId);
      weather = body.weather ?? 'Berawan';
      event = body.event ?? 'missing';
    }

    if (!userId) {
      return NextResponse.json({ message: 'userId wajib diisi untuk prediksi.' }, { status: 401 });
    }

    const hfApiName = action === 'retrain' ? process.env.HF_RETRAIN_API_NAME || DEFAULT_HF_RETRAIN_API_NAME : process.env.HF_API_NAME || DEFAULT_HF_PREDICT_API_NAME;
    
    // Pastikan objek dummy/fallback untuk dry run retrain juga sama persis strukturnya
    const payload =
      action === 'retrain'
        ? { data: [userId, { meta: { _type: 'gradio.FileData' }, path: '', orig_name: 'dummy.csv', size: 100, mime_type: 'text/csv' }] }
        : { data: [userId, weather, event] };

    let lastError = '';

    for (const baseUrl of apiBaseCandidates) {
      const predictResponse = await tryStartPrediction(baseUrl, hfApiName, payload);
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

      const streamResponse = await tryFetchResult(baseUrl, hfApiName, eventId);
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
        const payloadResult = JSON.parse(parsedData) as unknown;

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

        const modelResult = extractResult(payloadResult);
        if (modelResult && typeof modelResult === 'object' && !Array.isArray(modelResult)) {
          return NextResponse.json(modelResult);
        }

        return NextResponse.json(payloadResult);
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
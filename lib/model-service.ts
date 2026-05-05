import type { EventOptionValue, ModelPredictionResponse, WeatherOption } from './model-prediction';

export const MODEL_SERVICE_PROVIDER = 'huggingface';
export const MODEL_SERVICE_SPACE_ID = process.env.NEXT_PUBLIC_HF_SPACE_ID ?? 'hakimgans/ventoree';
export const MODEL_SERVICE_ENDPOINT =
  process.env.NEXT_PUBLIC_MODEL_PREDICTION_ENDPOINT ?? '/api/model-prediction';

export interface ModelPredictionRequest {
  weather: WeatherOption;
  event: EventOptionValue;
}

export async function requestModelPrediction(
  input: ModelPredictionRequest,
): Promise<ModelPredictionResponse> {
  const response = await fetch(MODEL_SERVICE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-model-provider': MODEL_SERVICE_PROVIDER,
      'x-hf-space-id': MODEL_SERVICE_SPACE_ID,
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as ModelPredictionResponse & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Gagal memuat prediksi.');
  }

  return data;
}

export const MODEL_MENU = [
  { id: 'nasi_goreng', name: 'Nasi Goreng' },
  { id: 'mie_goreng', name: 'Mie Goreng Spesial' },
  { id: 'soto_ayam', name: 'Soto Ayam' },
  { id: 'bakso_sapi', name: 'Bakso Sapi' },
  { id: 'sate_ayam', name: 'Sate Ayam' },
  { id: 'ayam_geprek', name: 'Ayam Geprek' },
  { id: 'gorengan', name: 'Gorengan' },
  { id: 'es_teh_manis', name: 'Es Teh Manis' },
  { id: 'es_jeruk', name: 'Es Jeruk' },
  { id: 'kopi_susu', name: 'Kopi Susu' },
] as const;

export const WEATHER_OPTIONS = ['Cerah', 'Berawan', 'Hujan'] as const;

export const EVENT_OPTIONS = [
  { label: 'Tidak Ada Event', value: 'missing' },
  { label: 'Promo Awal Bulan', value: 'Promo Awal Bulan' },
  { label: 'Promo Jumat Berkah', value: 'Promo Jumat Berkah' },
] as const;

export type WeatherOption = (typeof WEATHER_OPTIONS)[number];
export type EventOptionValue = (typeof EVENT_OPTIONS)[number]['value'];

export interface ModelPredictionItem {
  menu_id: string;
  menu_name: string;
  predicted_qty: number;
  unit_price: number;
  predicted_revenue: number;
}

export interface ModelPredictionResponse {
  prediction_date: string;
  weather: WeatherOption;
  event_label: string;
  event_name: string;
  total_qty: number;
  total_revenue: number;
  top_menu: string;
  predictions: ModelPredictionItem[];
}

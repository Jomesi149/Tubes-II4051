from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import gradio as gr
import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "xgb_qty_sold_pipeline.joblib"
DATA_PATH = BASE_DIR / "ventore_sales_10_menus.csv"

WEATHER_OPTIONS = ["Cerah", "Berawan", "Hujan"]
EVENT_OPTIONS = [
    ("Tidak Ada Event", "missing"),
    ("Promo Awal Bulan", "Promo Awal Bulan"),
    ("Promo Jumat Berkah", "Promo Jumat Berkah"),
]


@lru_cache(maxsize=1)
def load_assets() -> tuple[object, pd.DataFrame]:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model tidak ditemukan: {MODEL_PATH}")
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset tidak ditemukan: {DATA_PATH}")

    pipeline = joblib.load(MODEL_PATH)
    history = pd.read_csv(DATA_PATH)
    history["date"] = pd.to_datetime(history["date"], dayfirst=False, errors="coerce")
    return pipeline, history


def build_prediction_frame(weather: str, event_name: str) -> tuple[pd.DataFrame, pd.Timestamp]:
    pipeline, df_history = load_assets()
    del pipeline

    last_date = df_history["date"].max()
    tomorrow = last_date + pd.Timedelta(days=1)

    event_flag = 0 if event_name == "missing" else 1
    menus = df_history["menu_id"].dropna().unique()
    prediction_rows = []

    for menu in menus:
        menu_df = df_history[df_history["menu_id"] == menu]
        if menu_df.empty:
            continue

        menu_name = menu_df["menu_name"].iloc[0]
        lag_1_row = menu_df[menu_df["date"] == last_date]
        lag_1_val = float(lag_1_row["qty_sold"].values[0]) if not lag_1_row.empty else 0.0

        lag_7_date = tomorrow - pd.Timedelta(days=7)
        lag_7_row = menu_df[menu_df["date"] == lag_7_date]
        lag_7_val = float(lag_7_row["qty_sold"].values[0]) if not lag_7_row.empty else 0.0

        unit_price = float(lag_1_row["unit_price"].values[0]) if not lag_1_row.empty else float(menu_df["unit_price"].iloc[-1])

        prediction_rows.append(
            {
                "menu_id": menu,
                "menu_name": menu_name,
                "unit_price": unit_price,
                "weather": weather,
                "event_flag": event_flag,
                "event_name": event_name,
                "qty_sold_lag_1": lag_1_val,
                "qty_sold_lag_7": lag_7_val,
                "day_of_week": tomorrow.dayofweek,
                "is_weekend": 1 if tomorrow.dayofweek >= 5 else 0,
                "month": tomorrow.month,
                "week_of_year": tomorrow.isocalendar().week,
                "day": tomorrow.day,
                "year": tomorrow.year,
            }
        )

    frame = pd.DataFrame(prediction_rows)
    return frame, tomorrow


def make_prediction(weather: str, event_label: str):
    event_name = event_label if event_label != "Tidak Ada Event" else "missing"
    pipeline, _ = load_assets()
    feature_frame, tomorrow = build_prediction_frame(weather, event_name)

    if feature_frame.empty:
        empty_df = pd.DataFrame(columns=["Nama Menu", "Qty", "Harga Unit", "Revenue"])
        summary = "### Prediksi tidak tersedia\nDataset menu kosong."
        return summary, empty_df, {
            "prediction_date": tomorrow.strftime("%Y-%m-%d"),
            "weather": weather,
            "event_label": event_label,
            "event_name": event_name,
            "total_qty": 0,
            "total_revenue": 0.0,
            "top_menu": "-",
            "predictions": [],
        }

    prediction_input = feature_frame.drop(columns=["menu_name"])
    predictions = pipeline.predict(prediction_input)

    feature_frame["predicted_qty"] = predictions.round().astype(int)
    feature_frame["predicted_qty"] = feature_frame["predicted_qty"].clip(lower=0)
    feature_frame["predicted_revenue"] = feature_frame["predicted_qty"] * feature_frame["unit_price"]
    sorted_frame = feature_frame.sort_values(["predicted_qty", "predicted_revenue"], ascending=[False, False]).reset_index(drop=True)

    top_row = sorted_frame.iloc[0]
    total_qty = int(sorted_frame["predicted_qty"].sum())
    total_revenue = float(sorted_frame["predicted_revenue"].sum())

    summary = (
        f"### Hasil Prediksi\n"
        f"- Tanggal prediksi: **{tomorrow.strftime('%Y-%m-%d')}**\n"
        f"- Cuaca: **{weather}**\n"
        f"- Event: **{event_label}**\n"
        f"- Total porsi: **{total_qty}**\n"
        f"- Total potensi pendapatan: **Rp {total_revenue:,.0f}**\n"
        f"- Top menu: **{top_row['menu_name']}**"
    )

    display_df = sorted_frame[["menu_name", "predicted_qty", "unit_price", "predicted_revenue"]].rename(
        columns={
            "menu_name": "Nama Menu",
            "predicted_qty": "Qty",
            "unit_price": "Harga Unit",
            "predicted_revenue": "Revenue",
        }
    )

    return summary, display_df, {
        "prediction_date": tomorrow.strftime("%Y-%m-%d"),
        "weather": weather,
        "event_label": event_label,
        "event_name": event_name,
        "total_qty": total_qty,
        "total_revenue": total_revenue,
        "top_menu": top_row["menu_name"],
        "predictions": [
            {
                "menu_id": row["menu_id"],
                "menu_name": row["menu_name"],
                "predicted_qty": int(row["predicted_qty"]),
                "unit_price": float(row["unit_price"]),
                "predicted_revenue": float(row["predicted_revenue"]),
            }
            for _, row in sorted_frame.iterrows()
        ],
    }


with gr.Blocks(title="Ventoré MVP - Prediksi Model") as demo:
    gr.Markdown("# Ventoré MVP\nPrediksi kebutuhan menu harian berbasis model XGBoost.")
    gr.Markdown(
        "Aplikasi ini disiapkan untuk Hugging Face Spaces. Pilih cuaca dan event, lalu jalankan prediksi."
    )

    with gr.Row():
        with gr.Column(scale=1, min_width=320):
            weather_input = gr.Dropdown(
                choices=WEATHER_OPTIONS,
                value="Berawan",
                label="Cuaca",
            )
            event_input = gr.Dropdown(
                choices=EVENT_OPTIONS,
                value="missing",
                label="Event",
            )
            run_button = gr.Button("Jalankan Prediksi", variant="primary")

        with gr.Column(scale=2):
            summary_output = gr.Markdown()
            table_output = gr.Dataframe(
                headers=["Nama Menu", "Qty", "Harga Unit", "Revenue"],
                datatype=["str", "number", "number", "number"],
                label="Detail Prediksi",
                interactive=False,
                wrap=True,
            )
            json_output = gr.JSON(label="Result JSON", visible=False)

    run_button.click(
        fn=make_prediction,
        inputs=[weather_input, event_input],
        outputs=[summary_output, table_output, json_output],
        api_name="predict",
    )

    gr.Examples(
        examples=[
            ["Cerah", "missing"],
            ["Berawan", "Promo Awal Bulan"],
            ["Hujan", "Promo Jumat Berkah"],
        ],
        inputs=[weather_input, event_input],
        label="Contoh input",
    )

if __name__ == "__main__":
    demo.queue().launch()

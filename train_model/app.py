from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import gradio as gr
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_percentage_error, r2_score, root_mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

WEATHER_OPTIONS = ["Cerah", "Berawan", "Hujan"]
EVENT_OPTIONS = [
    ("Tidak Ada Event", "missing"),
    ("Promo Awal Bulan", "Promo Awal Bulan"),
    ("Promo Jumat Berkah", "Promo Jumat Berkah"),
]
REQUIRED_COLUMNS = {
    "date",
    "day_name",
    "day_of_week",
    "is_weekend",
    "month",
    "week_of_year",
    "weather",
    "event_flag",
    "event_name",
    "menu_id",
    "menu_name",
    "unit_price",
    "qty_sold",
    "gross_sales",
}


def sanitize_user_id(user_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", (user_id or "default").strip())
    cleaned = cleaned or "default"
    return cleaned[:64]


def get_user_paths(user_id: str) -> tuple[Path, Path]:
    safe_user_id = sanitize_user_id(user_id)
    return DATA_DIR / f"{safe_user_id}_sales.csv", MODEL_DIR / f"{safe_user_id}_pipeline.joblib"


def normalize_path(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("path", "name", "file"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate:
                return candidate
        return ""
    if isinstance(value, str):
        return value
    return ""


def read_sales_file(file_path: str | Path) -> pd.DataFrame:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File data tidak ditemukan: {path}")

    suffix = path.suffix.lower()
    if suffix in {".xlsx", ".xls"}:
        try:
            return pd.read_excel(path)
        except ImportError as exc:
            raise RuntimeError("Excel tidak bisa dibaca. Pastikan paket openpyxl terpasang.") from exc
    return pd.read_csv(path)


def prepare_training_frame(raw_frame: pd.DataFrame) -> pd.DataFrame:
    frame = raw_frame.copy()
    frame.columns = [str(col).strip().lower() for col in frame.columns]

    missing_columns = sorted(REQUIRED_COLUMNS.difference(frame.columns))
    if missing_columns:
        raise ValueError(f"File harus memiliki kolom: {', '.join(missing_columns)}")

    frame = frame[sorted(REQUIRED_COLUMNS)].copy()
    frame["date"] = pd.to_datetime(frame["date"], dayfirst=False, errors="coerce")
    frame = frame.dropna(subset=["date", "qty_sold"]).reset_index(drop=True)
    frame = frame.sort_values(["date", "menu_id"]).reset_index(drop=True)

    frame["day"] = frame["date"].dt.day
    frame["year"] = frame["date"].dt.year
    frame["month"] = pd.to_numeric(frame["month"], errors="coerce").fillna(frame["date"].dt.month)
    frame["week_of_year"] = pd.to_numeric(frame["week_of_year"], errors="coerce").fillna(frame["date"].dt.isocalendar().week)
    frame["day_of_week"] = pd.to_numeric(frame["day_of_week"], errors="coerce").fillna(frame["date"].dt.dayofweek)
    frame["is_weekend"] = pd.to_numeric(frame["is_weekend"], errors="coerce").fillna((frame["day_of_week"] >= 5).astype(int))
    frame["event_flag"] = pd.to_numeric(frame["event_flag"], errors="coerce").fillna(0)
    frame["unit_price"] = pd.to_numeric(frame["unit_price"], errors="coerce").fillna(0)
    frame["gross_sales"] = pd.to_numeric(frame["gross_sales"], errors="coerce").fillna(0)
    frame["qty_sold"] = pd.to_numeric(frame["qty_sold"], errors="coerce").fillna(0)

    frame["qty_sold_lag_1"] = frame.groupby("menu_id")["qty_sold"].shift(1)
    frame["qty_sold_lag_7"] = frame.groupby("menu_id")["qty_sold"].shift(7)
    frame = frame.dropna(subset=["qty_sold_lag_7"]).reset_index(drop=True)

    return frame


def build_pipeline(training_frame: pd.DataFrame) -> Pipeline:
    drop_columns = ["qty_sold", "gross_sales", "date", "menu_name", "day_name"]
    feature_frame = training_frame.drop(columns=drop_columns, errors="ignore")
    target = training_frame["qty_sold"]

    numeric_features = [
        "day_of_week",
        "is_weekend",
        "month",
        "week_of_year",
        "unit_price",
        "day",
        "year",
        "event_flag",
        "qty_sold_lag_1",
        "qty_sold_lag_7",
    ]
    categorical_features = ["weather", "event_name", "menu_id"]

    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    x_train, _, y_train, _ = train_test_split(
        feature_frame,
        target,
        test_size=0.2,
        random_state=42,
        shuffle=False,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                XGBRegressor(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=6,
                    random_state=42,
                    objective="reg:squarederror",
                    tree_method="hist",
                ),
            ),
        ]
    )
    pipeline.fit(x_train, y_train)
    return pipeline


def load_assets(user_id: str) -> tuple[Any, pd.DataFrame]:
    data_path, model_path = get_user_paths(user_id)
    if not model_path.exists():
        raise FileNotFoundError(f"Model belum tersedia untuk user {user_id}. Silakan unggah file data lalu latih model.")
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset belum tersedia untuk user {user_id}.")

    pipeline = joblib.load(model_path)
    history = pd.read_csv(data_path)
    history["date"] = pd.to_datetime(history["date"], dayfirst=False, errors="coerce")
    return pipeline, history


def build_prediction_frame(user_id: str, weather: str, event_name: str) -> tuple[pd.DataFrame, pd.Timestamp]:
    _, df_history = load_assets(user_id)

    last_date = df_history["date"].max()
    tomorrow = last_date + pd.Timedelta(days=1)

    event_flag = 0 if event_name == "missing" else 1
    menus = df_history["menu_id"].dropna().unique()
    prediction_rows: list[dict[str, Any]] = []

    for menu in menus:
        menu_df = df_history[df_history["menu_id"] == menu]
        if menu_df.empty:
            continue

        menu_name = str(menu_df["menu_name"].iloc[0])
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


def make_prediction(user_id: str, weather: str, event_label: str):
    event_name = event_label if event_label != "Tidak Ada Event" else "missing"

    try:
        pipeline, _ = load_assets(user_id)
        feature_frame, tomorrow = build_prediction_frame(user_id, weather, event_name)
    except FileNotFoundError as exc:
        empty_df = pd.DataFrame(columns=["Nama Menu", "Qty", "Harga Unit", "Revenue"])
        summary = f"### Model belum siap\n{exc}"
        return summary, empty_df, {
            "prediction_date": None,
            "weather": weather,
            "event_label": event_label,
            "event_name": event_name,
            "total_qty": 0,
            "total_revenue": 0.0,
            "top_menu": "-",
            "predictions": [],
            "error": str(exc),
        }

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


def retrain_model(user_id: str, csv_file_path: Any) -> str:
    try:
        normalized_path = normalize_path(csv_file_path)
        if not normalized_path:
            return "File data kosong. Unggah file CSV atau Excel terlebih dahulu."

        data_path, model_path = get_user_paths(user_id)
        raw_frame = read_sales_file(normalized_path)
        prepared_frame = prepare_training_frame(raw_frame)
        prepared_frame.to_csv(data_path, index=False)

        pipeline = build_pipeline(prepared_frame)
        joblib.dump(pipeline, model_path)

        return (
            f"Model berhasil dilatih untuk user {sanitize_user_id(user_id)}. "
            f"Data tersimpan di {data_path.name} dan model di {model_path.name}."
        )
    except ValueError as exc:
        return f"Format file tidak valid: {exc}"
    except FileNotFoundError as exc:
        return str(exc)
    except Exception as exc:  # pragma: no cover - runtime safety for Spaces
        return f"Gagal melatih model: {exc}"


with gr.Blocks(title="Ventoré MVP - Prediksi Model") as demo:
    gr.Markdown("# Ventoré MVP\nPrediksi kebutuhan menu harian berbasis model XGBoost.")
    gr.Markdown(
        "Unggah file CSV atau Excel yang berisi kolom penjualan toko Anda. Setiap user akan memiliki model dan datasetnya sendiri."
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
            user_id_input = gr.Textbox(visible=False)
            upload_input = gr.File(label="Upload CSV/Excel", file_types=[".csv", ".xlsx", ".xls"])
            run_button = gr.Button("Jalankan Prediksi", variant="primary")
            retrain_button = gr.Button("Latih Ulang Model", variant="secondary")
            retrain_status = gr.Markdown()

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
        inputs=[user_id_input, weather_input, event_input],
        outputs=[summary_output, table_output, json_output],
        api_name="predict",
    )

    retrain_button.click(
        fn=retrain_model,
        inputs=[user_id_input, upload_input],
        outputs=[retrain_status],
        api_name="retrain",
    )

    gr.Examples(
        examples=[
            ["", "Cerah", "missing"],
            ["", "Berawan", "Promo Awal Bulan"],
            ["", "Hujan", "Promo Jumat Berkah"],
        ],
        inputs=[user_id_input, weather_input, event_input],
        label="Contoh input",
    )


if __name__ == "__main__":
    demo.queue().launch()

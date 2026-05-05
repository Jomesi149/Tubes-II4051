import argparse
import json
import warnings
from pathlib import Path
from datetime import timedelta

import joblib
import pandas as pd
import requests

try:
    from sklearn.exceptions import InconsistentVersionWarning

    warnings.filterwarnings("ignore", category=InconsistentVersionWarning)
except Exception:
    pass


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "xgb_qty_sold_pipeline.joblib"
DB_PATH = BASE_DIR / "ventore_sales_10_menus.csv"

def get_weather_tomorrow():
    lat = -6.2349
    lon = 106.9896
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=weathercode&timezone=Asia%2FJakarta&forecast_days=2"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        weather_code = data['daily']['weathercode'][1]
        
        if weather_code == 0:
            return "Cerah"
        elif 1 <= weather_code <= 3 or weather_code in [45, 48]:
            return "Berawan"
        else:
            return "Hujan"
    except Exception:
        return "Berawan"

def predict_tomorrow_sales(weather_override=None, event_name_override="missing", emit_json=False):
    try:
        pipeline = joblib.load(MODEL_PATH)
    except FileNotFoundError:
        raise FileNotFoundError(f"File {MODEL_PATH} tidak ditemukan.")

    try:
        df_history = pd.read_csv(DB_PATH)
        df_history["date"] = pd.to_datetime(df_history["date"], dayfirst=False, errors="coerce")
    except FileNotFoundError:
        raise FileNotFoundError(f"Database {DB_PATH} tidak ditemukan.")

    last_date = df_history["date"].max()
    besok = last_date + pd.Timedelta(days=1)

    cuaca_besok = weather_override or get_weather_tomorrow()
    event_name = event_name_override or "missing"
    event_flag = 0 if event_name == "missing" else 1

    menus = df_history["menu_id"].unique()
    prediction_rows = []

    for menu in menus:
        menu_df = df_history[df_history["menu_id"] == menu]
        menu_name = menu_df["menu_name"].iloc[0]
        
        lag_1_row = menu_df[menu_df["date"] == last_date]
        lag_1_val = lag_1_row["qty_sold"].values[0] if not lag_1_row.empty else 0
        
        lag_7_date = besok - pd.Timedelta(days=7)
        lag_7_row = menu_df[menu_df["date"] == lag_7_date]
        lag_7_val = lag_7_row["qty_sold"].values[0] if not lag_7_row.empty else 0

        unit_price = lag_1_row["unit_price"].values[0] if not lag_1_row.empty else menu_df["unit_price"].iloc[-1]

        prediction_rows.append({
            "menu_id": menu,
            "menu_name": menu_name,
            "unit_price": unit_price,
            "weather": cuaca_besok, 
            "event_flag": event_flag,
            "event_name": event_name,
            "qty_sold_lag_1": lag_1_val,
            "qty_sold_lag_7": lag_7_val,
            "day_of_week": besok.dayofweek,
            "is_weekend": 1 if besok.dayofweek >= 5 else 0,
            "month": besok.month,
            "week_of_year": besok.isocalendar().week,
            "day": besok.day,
            "year": besok.year
        })

    data_besok = pd.DataFrame(prediction_rows)
    feature_frame = data_besok.drop(columns=["menu_name"])
    predictions = pipeline.predict(feature_frame)
    
    data_besok["predicted_qty"] = predictions.round().astype(int)
    data_besok["predicted_qty"] = data_besok["predicted_qty"].apply(lambda x: max(0, x)) 
    data_besok["predicted_revenue"] = data_besok["predicted_qty"] * data_besok["unit_price"]

    sorted_besok = data_besok.sort_values(["predicted_qty", "predicted_revenue"], ascending=[False, False])

    result = {
        "prediction_date": besok.strftime("%Y-%m-%d"),
        "weather": cuaca_besok,
        "event_label": "Tidak Ada Event" if event_name == "missing" else event_name,
        "event_name": event_name,
        "total_qty": int(data_besok["predicted_qty"].sum()),
        "total_revenue": float(data_besok["predicted_revenue"].sum()),
        "top_menu": sorted_besok.iloc[0]["menu_name"] if not sorted_besok.empty else "-",
        "predictions": [
            {
                "menu_id": row["menu_id"],
                "menu_name": row["menu_name"],
                "predicted_qty": int(row["predicted_qty"]),
                "unit_price": float(row["unit_price"]),
                "predicted_revenue": float(row["predicted_revenue"]),
            }
            for _, row in sorted_besok.iterrows()
        ],
    }

    if emit_json:
        print(json.dumps(result, ensure_ascii=False))
        return result

    print(f"Tanggal terakhir di data : {last_date.strftime('%Y-%m-%d')}")
    print(f"Membuat prediksi untuk   : {besok.strftime('%Y-%m-%d')}")
    print(f"Prediksi Cuaca Besok     : {cuaca_besok} (Otomatis dari Open-Meteo)\n")
    print(f"=== Prediksi Kebutuhan Stok ===")
    for index, row in data_besok.iterrows():
        print(f"- {row['menu_name']}: {row['predicted_qty']} porsi")

    data_besok[["menu_id", "menu_name", "predicted_qty"]].to_csv(BASE_DIR / "prediksi_besok.csv", index=False)
    print("\nHasil prediksi lengkap diekspor ke 'prediksi_besok.csv'")

    return result


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weather", default=None)
    parser.add_argument("--event", default="missing")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    predict_tomorrow_sales(weather_override=args.weather, event_name_override=args.event, emit_json=args.json)
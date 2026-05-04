import pandas as pd
import joblib
import requests
from datetime import timedelta

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
    except Exception as e:
        print(f"Peringatan: Gagal menarik data API Open-Meteo ({e}). Menggunakan default 'Berawan'.")
        return "Berawan"

def predict_tomorrow_sales():
    model_path = "xgb_qty_sold_pipeline.joblib"
    try:
        pipeline = joblib.load(model_path)
    except FileNotFoundError:
        print(f"Error: File {model_path} tidak ditemukan.")
        return

    db_path = "ventore_sales_10_menus.csv"
    try:
        df_history = pd.read_csv(db_path)
        df_history["date"] = pd.to_datetime(df_history["date"], dayfirst=False, errors="coerce")
    except FileNotFoundError:
        print(f"Error: Database {db_path} tidak ditemukan.")
        return

    last_date = df_history["date"].max()
    besok = last_date + pd.Timedelta(days=1)
    print(f"Tanggal terakhir di data : {last_date.strftime('%Y-%m-%d')}")
    print(f"Membuat prediksi untuk   : {besok.strftime('%Y-%m-%d')}")

    cuaca_besok = get_weather_tomorrow()
    print(f"Prediksi Cuaca Besok     : {cuaca_besok} (Otomatis dari Open-Meteo)\n")

    menus = df_history["menu_id"].unique()
    prediction_rows = []

    for menu in menus:
        menu_df = df_history[df_history["menu_id"] == menu]
        
        lag_1_row = menu_df[menu_df["date"] == last_date]
        lag_1_val = lag_1_row["qty_sold"].values[0] if not lag_1_row.empty else 0
        
        lag_7_date = besok - pd.Timedelta(days=7)
        lag_7_row = menu_df[menu_df["date"] == lag_7_date]
        lag_7_val = lag_7_row["qty_sold"].values[0] if not lag_7_row.empty else 0

        unit_price = lag_1_row["unit_price"].values[0] if not lag_1_row.empty else menu_df["unit_price"].iloc[-1]

        prediction_rows.append({
            "menu_id": menu,
            "unit_price": unit_price,
            "weather": cuaca_besok, 
            "event_flag": 0,       
            "event_name": "missing",
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
    predictions = pipeline.predict(data_besok)
    
    data_besok["predicted_qty"] = predictions.round().astype(int)
    data_besok["predicted_qty"] = data_besok["predicted_qty"].apply(lambda x: max(0, x)) 

    print(f"=== Prediksi Kebutuhan Stok ===")
    for index, row in data_besok.iterrows():
        print(f"- {row['menu_id'].replace('_', ' ').title()}: {row['predicted_qty']} porsi")
        
    data_besok[['menu_id', 'predicted_qty']].to_csv("prediksi_besok.csv", index=False)
    print("\nHasil prediksi lengkap diekspor ke 'prediksi_besok.csv'")

if __name__ == "__main__":
    predict_tomorrow_sales()
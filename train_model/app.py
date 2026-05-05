import streamlit as st
import pandas as pd
import joblib
import requests
from datetime import datetime, timedelta

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
        return "Berawan"

st.set_page_config(page_title="Warung Forecaster", layout="wide")

st.title("Sistem Prediksi Stok & Inventaris Warung")
st.markdown("Sistem ini memprediksi porsi penjualan esok hari dengan menarik data cuaca secara otomatis dari Open-Meteo API.")

st.sidebar.header("Parameter Esok Hari")
besok = datetime.now() + timedelta(days=1)
st.sidebar.write(f"**Tanggal Prediksi:** {besok.strftime('%d %B %Y')}")

cuaca_otomatis = get_weather_tomorrow()
st.sidebar.info(f"Prakiraan Cuaca (Otomatis): {cuaca_otomatis}")

event_input = st.sidebar.selectbox(
    "Apakah ada event/momen khusus?",
    ("Tidak Ada", "Periode Gajian", "Promo Jumat Berkah")
)

tombol_prediksi = st.sidebar.button("Jalankan Prediksi", type="primary")

if tombol_prediksi:
    try:
        model = joblib.load("xgb_qty_sold_pipeline.joblib") 
        df_history = pd.read_csv("ventore_sales_10_menus.csv")
        df_history["date"] = pd.to_datetime(df_history["date"], dayfirst=False, errors="coerce")
    except FileNotFoundError:
        st.error("Model atau Dataset tidak ditemukan! Pastikan file xgb_qty_sold_pipeline.joblib dan ventore_sales_10_menus.csv ada di folder yang sama.")
        st.stop()

    with st.spinner("Mengkalkulasi tren penjualan dan cuaca..."):
        last_date = df_history["date"].max()
        menus = df_history["menu_id"].unique()
        prediction_rows = []
        
        event_flag = 0 if event_input == "Tidak Ada Event" else 1
        event_name = "missing" if event_input == "Tidak Ada Event" else event_input

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
                "weather": cuaca_otomatis,
                "event_flag": event_flag,       
                "event_name": event_name,
                "qty_sold_lag_1": lag_1_val,
                "qty_sold_lag_7": lag_7_val,
                "day_of_week": besok.weekday(),
                "is_weekend": 1 if besok.weekday() >= 5 else 0,
                "month": besok.month,
                "week_of_year": besok.isocalendar().week,
                "day": besok.day,
                "year": besok.year
            })

        data_besok = pd.DataFrame(prediction_rows)

        predictions = model.predict(data_besok.drop(columns=["menu_name"])) 
        
        data_besok["Prediksi Porsi (Qty)"] = predictions.round().astype(int)
        data_besok["Prediksi Porsi (Qty)"] = data_besok["Prediksi Porsi (Qty)"].apply(lambda x: max(0, x))
        data_besok["Potensi Pendapatan"] = data_besok["Prediksi Porsi (Qty)"] * data_besok["unit_price"]

    st.success("Prediksi berhasil dijalankan!")
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Porsi Diprediksi Terjual", data_besok["Prediksi Porsi (Qty)"].sum())
    with col2:
        st.metric("Total Potensi Pendapatan (Gross)", f"Rp {data_besok['Potensi Pendapatan'].sum():,.0f}")

    st.markdown("---")
    
    col_tabel, col_grafik = st.columns([1, 1])

    with col_tabel:
        st.subheader("Detail Rencana Produksi")
        df_display = data_besok[["menu_name", "Prediksi Porsi (Qty)"]].rename(columns={"menu_name": "Nama Menu"})
        st.dataframe(df_display, use_container_width=True, hide_index=True)

    with col_grafik:
        st.subheader("Grafik Kebutuhan Stok")
        chart_data = df_display.set_index("Nama Menu")
        st.bar_chart(chart_data, color="#ffaa00")
        
else:
    st.info("Silakan cek parameter di sidebar sebelah kiri, lalu klik Jalankan Prediksi.")
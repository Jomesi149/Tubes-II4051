# Ventoré

Aplikasi manajemen operasional F&B berbasis web untuk membantu pemilik usaha kecil mengelola penjualan, stok bahan baku, waste, dan rekomendasi produksi harian — tanpa perlu server atau database eksternal.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Persistensi**: `localStorage` (tidak butuh backend)
- **Algoritma**: Simple Moving Average (SMA) untuk rekomendasi produksi

## Cara Menjalankan

### Prasyarat

- Node.js 18 atau lebih baru
- npm / yarn / pnpm

### Instalasi

```bash
# Clone repo
git clone <repo-url>
cd Tubes-II4051

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Build Production

```bash
npm run build
npm run start
```

## Fitur

### Dashboard
Halaman utama yang menampilkan ringkasan kondisi operasional harian:
- Total rekomendasi produksi (porsi) berdasarkan kondisi hari
- Indikator stok — mendeteksi bahan kritis yang tidak cukup untuk memenuhi produksi
- Akumulasi kerugian waste dalam periode berjalan
- Aksi cepat ke modul utama

### Penjualan (`/sales`)
Input dan riwayat penjualan harian per menu:
- Catat penjualan tiap menu beserta kondisi hari (Normal / Ramai / Hujan)
- Riwayat penjualan lengkap dalam tabel
- Data tersimpan di `localStorage` dan digunakan sebagai basis kalkulasi SMA

### Stok (`/stock`)
Manajemen stok bahan baku:
- Lihat dan update kuantitas stok per bahan
- Status kritis ditampilkan jika stok tidak mencukupi kebutuhan produksi yang direkomendasikan

### Waste (`/waste`)
Pencatatan kerugian bahan:
- Catat waste per bahan (jenis: Rusak / Kedaluwarsa / Sisa Produksi)
- Hitung kerugian otomatis berdasarkan harga per unit
- Log waste per hari dengan total kerugian harian

### Rekomendasi Produksi (`/recommendation`)
Kalkulasi rekomendasi jumlah porsi yang harus diproduksi:
- Algoritma: Simple Moving Average 7 hari terakhir + buffer 10%
- Penyesuaian kondisi hari: Normal (×1.0), Ramai (×1.25), Hujan (×0.80)
- Tampilkan rasionalisasi per menu

## Struktur Proyek

```
├── app/
│   ├── page.tsx              # Dashboard
│   ├── sales/page.tsx        # Modul penjualan
│   ├── stock/page.tsx        # Modul stok
│   ├── waste/page.tsx        # Modul waste
│   └── recommendation/page.tsx
├── components/
│   └── Navbar.tsx
├── lib/
│   ├── types.ts              # Tipe data global
│   ├── storage.ts            # Abstraksi localStorage
│   └── recommendation.ts     # Algoritma SMA
```

## Catatan

- Semua data disimpan di `localStorage` browser — tidak ada server atau database.
- Data akan hilang jika browser storage dibersihkan.
- Aplikasi di-seed dengan data contoh saat pertama kali dibuka.

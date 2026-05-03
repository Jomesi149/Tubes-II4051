# Ventoré — MVP Feature Specification (AI Agent Prompt Document)

> **Tujuan Dokumen:** Dokumen ini adalah spesifikasi teknis terstruktur untuk digunakan sebagai konteks sistem oleh AI agent dalam membantu pengembangan, debugging, atau perluasan fitur aplikasi Ventoré. Baca seluruh dokumen sebelum menghasilkan output apapun.
>
> **Dokumen terkait yang WAJIB dibaca bersamaan:**
> - `DESIGN.md` — Design system & visual language (Linear-inspired). Semua keputusan UI harus mengacu ke sini.
> - `CLAUDE.md` — Behavioral guidelines & tech stack constraints untuk AI agent.

---

## Konteks Proyek

**Nama Aplikasi:** Ventoré
**Tahap:** MVP (Minimum Viable Product)
**Domain:** Manajemen operasional F&B (Food & Beverage) — fokus pada reduksi food waste dan pencegahan stockout
**Target Pengguna:** Staf operasional dan pemilik usaha kuliner skala kecil-menengah
**Target KPI Utama:** Penurunan food waste sebesar ≥25% dalam periode pengukuran

---

## Tech Stack (lihat CLAUDE.md untuk detail constraints)

| Layer | Teknologi |
|---|---|
| Backend | Go (Golang) + Fiber framework |
| Frontend | Next.js (React) + Tailwind CSS |
| Database (prod) | PostgreSQL |
| Storage (MVP) | localStorage (browser-side persistence) |
| ML Logic | Moving Average — diimplementasikan di Go |

---

## Arsitektur Data Utama

```
localStorage
├── sales_history[]         → array transaksi penjualan harian per menu
├── stock_data{}            → stok fisik bahan baku (key: nama bahan, value: jumlah)
├── waste_log[]             → log pembuangan bahan (tanggal, bahan, jumlah, nilai rupiah)
└── menu_list[]             → daftar menu aktif beserta recipe mapping-nya
```

---

## UI / Design System Reference

> **Sumber tunggal kebenaran untuk semua keputusan visual: `DESIGN.md`**
> Jangan membuat token warna, ukuran, atau komponen baru tanpa mengacu ke sana terlebih dahulu.

### Prinsip Visual Ventoré (diturunkan dari DESIGN.md)

Ventoré menggunakan design language **Linear-inspired** dari `DESIGN.md`. Aplikasi ini adalah product-focused internal tool — dark canvas, technical, dan dense. Berikut pemetaan keputusan desain per konteks UI:

#### Warna (referensi token `DESIGN.md → colors`)

| Konteks UI Ventoré | Token DESIGN.md | Nilai |
|---|---|---|
| Background halaman | `{colors.canvas}` | #010102 |
| Card / panel modul | `{colors.surface-1}` | #0f1011 |
| Card state hover / featured | `{colors.surface-2}` | #141516 |
| Border card & input | `{colors.hairline}` | #23252a |
| Teks utama | `{colors.ink}` | #f7f8f8 |
| Teks sekunder / label | `{colors.ink-muted}` | #d0d6e0 |
| Teks tersier / placeholder | `{colors.ink-subtle}` | #8a8f98 |
| Aksen / CTA / primary button | `{colors.primary}` | #5e6ad2 |
| **Red Alert (stok kritis)** | Gunakan `#e5484d` — warna semantik khusus Ventoré¹ | — |
| **Status aman (stok cukup)** | `{colors.semantic-success}` | #27a644 |

> ¹ `#e5484d` adalah satu-satunya penambahan warna semantik di luar DESIGN.md. Diperbolehkan karena Red Alert adalah kebutuhan operasional kritis. Gunakan **hanya** untuk indikator stok kritis dan badge darurat — tidak untuk elemen dekoratif.

#### Tipografi (referensi token `DESIGN.md → typography`)

| Elemen UI Ventoré | Token DESIGN.md |
|---|---|
| Judul halaman / modul | `{typography.headline}` — 28px / 600 / -0.6px |
| Judul widget dashboard | `{typography.card-title}` — 22px / 500 / -0.4px |
| Angka metrik besar (porsi, nilai Rp) | `{typography.display-md}` — 40px / 600 / -1.0px |
| Label & body form | `{typography.body}` — 16px / 400 |
| Label kecil / caption | `{typography.body-sm}` — 14px / 400 |
| Eyebrow / label kategori | `{typography.eyebrow}` — 13px / 500 / +0.4px |
| Nilai kode / formula | `{typography.mono}` — 13px / 400 |

#### Komponen Utama (referensi token `DESIGN.md → components`)

| Komponen Ventoré | Gunakan komponen DESIGN.md |
|---|---|
| Card widget dashboard | `feature-card` |
| Panel modul utama | `product-screenshot-card` |
| Tombol simpan / konfirmasi | `button-primary` |
| Tombol batal / aksi sekunder | `button-secondary` |
| Input stok & penjualan | `text-input` + `text-input-focused` |
| Badge status stok | `status-badge` (modifikasi warna sesuai kondisi) |
| Baris log waste | `changelog-row` |
| Pilihan kondisi hari (Normal/Ramai/Hujan) | `pricing-tab-default` + `pricing-tab-selected` |
| Navigasi sidebar / top bar | `top-nav` |

#### Spacing & Layout (referensi `DESIGN.md → spacing` dan `Layout`)

- Padding internal card: `{spacing.lg}` 24px
- Gap antar widget dashboard: `{spacing.lg}` 24px
- Gap antar section: `{spacing.section}` 96px
- Padding input form: 8px vertikal · 12px horizontal (spek Linear)
- Grid dashboard: 3 kolom di desktop, 2 kolom di tablet, 1 kolom di mobile
- Max content width: 1280px

#### Elevasi & Depth

Ikuti sistem elevasi 4-level dari DESIGN.md. Gunakan surface ladder, **bukan drop shadow**:

| Level | Digunakan untuk |
|---|---|
| `{colors.canvas}` | Background halaman |
| `{colors.surface-1}` | Widget & card default |
| `{colors.surface-2}` | Card yang difokuskan / hover state |
| Focus ring: 2px `{colors.primary-focus}` @ 50% opacity | Input aktif / button focused |

#### Font Substitute

Linear Display/Text/Mono tidak tersedia publik. Gunakan fallback resmi dari DESIGN.md:
- Display & body: **Inter** weight 500/600/700, atau **Geist Sans**
- Mono: **JetBrains Mono** atau **Geist Mono** weight 400

#### Rules yang TIDAK boleh dilanggar (dari DESIGN.md → Do's and Don'ts)

- ❌ Jangan gunakan lavender `{colors.primary}` sebagai background card atau section
- ❌ Jangan tambahkan warna aksen kedua selain Red Alert yang sudah didefinisikan
- ❌ Jangan gunakan atmospheric gradient atau spotlight card
- ❌ Jangan pill-round tombol CTA (gunakan `{rounded.md}` 8px)
- ❌ Jangan buat halaman dengan light mode
- ✅ Gunakan data visual / chart sebagai elemen protagonist tiap section
- ✅ Pakai surface ladder untuk hirarki — bukan shadow

---

## Modul 1 — Dashboard (Pusat Kendali Ringkasan)

### Deskripsi
Layar utama aplikasi. Menampilkan gambaran cepat kondisi operasional harian dalam bentuk widget ringkasan.

### Widget yang Ditampilkan

| Widget | Komponen UI | Sumber Data | Kondisi Trigger |
|---|---|---|---|
| **Total Rekomendasi Produksi** | `feature-card` + `{typography.display-md}` | Output Modul 2 | Selalu tampil |
| **Indikator Stok Kritis** | `feature-card` + `status-badge` merah | Output Modul 4 | Tampil jika ada stok < kebutuhan |
| **Total Waste Real-time** | `feature-card` + `{typography.display-md}` | Output Modul 5 | Akumulasi periode berjalan |

### Mekanisme
1. Saat aplikasi dibuka, sistem melakukan agregasi data dari modul Recommendation dan Stock Management.
2. Setiap widget diperbarui secara reaktif setiap kali data di localStorage berubah.
3. Indikator Stok Kritis menampilkan **badge merah** (`#e5484d`) jika ada ≥1 bahan dengan stok di bawah kebutuhan.

---

## Modul 2 — Recommendation Engine (Moving Average)

### Deskripsi
Fitur inti untuk menghitung angka produksi harian yang optimal guna menekan food waste sekaligus mencegah stockout.

### Formula Kalkulasi

```
Step 1 — Moving Average:
  MA = SUM(penjualan N hari terakhir) / N
  Default N = 7 hari | Alternatif N = 14 hari

Step 2 — Production Buffer:
  Rekomendasi_Dasar = MA × (1 + buffer_rate)
  Default buffer_rate = 0.10 (10%)

Step 3 — Condition Modifier:
  Rekomendasi_Final = Rekomendasi_Dasar × bobot_kondisi

  Tabel Bobot Kondisi:
  ┌──────────────┬────────┐
  │ Kondisi      │ Bobot  │
  ├──────────────┼────────┤
  │ Normal       │ 1.00   │
  │ Ramai        │ 1.25   │
  │ Hujan        │ 0.80   │
  └──────────────┴────────┘
```

### Sub-fitur

- **Moving Average Logic:** Menarik data `sales_history[]` dari localStorage, memfilter N hari terakhir, menghitung rata-rata per menu.
- **Production Buffer:** Menambahkan margin keamanan (+10% default) ke hasil MA.
- **Condition Modifier:** Pill toggle (gunakan `pricing-tab-default` + `pricing-tab-selected`) untuk Normal / Ramai / Hujan.
- **Rasionalisasi Historis:** Sistem menghasilkan teks penjelasan otomatis, contoh output:
  > *"Berdasarkan rata-rata penjualan 3 Rabu terakhir: 42 porsi. Dengan buffer 10% dan kondisi Normal → Rekomendasi: 46 porsi."*

### Mekanisme Alur
```
User pilih kondisi hari (pill toggle)
        ↓
Sistem tarik sales_history dari localStorage
        ↓
Hitung Moving Average (N hari)
        ↓
Tambahkan Production Buffer
        ↓
Kalikan dengan Condition Modifier
        ↓
Output: Angka Rekomendasi Final + Teks Rasionalisasi
```

---

## Modul 3 — Sales Input (Pencatatan Penjualan)

### Deskripsi
Antarmuka untuk mencatat data penjualan aktual di akhir hari sebagai bahan pembelajaran sistem.

### Komponen Antarmuka

- **Form Input Penjualan:** Satu baris per menu dari `menu_list[]`, input jumlah terjual — gunakan `text-input`.
- **Daftar Menu Dinamis:** Daftar produk aktif yang ditarik dari `menu_list[]` di localStorage.
- **Tombol Simpan:** `button-primary` — menyimpan data dan memperbarui `sales_history[]`.

### Struktur Data Disimpan

```json
{
  "date": "2025-07-15",
  "day_of_week": "Selasa",
  "condition": "Normal",
  "sales": {
    "nasi_goreng": 38,
    "mie_ayam": 22,
    "es_teh": 55
  }
}
```

### Mekanisme
1. User mengisi form dan menekan **Simpan**.
2. Sistem membuat objek transaksi baru dan melakukan `push` ke array `sales_history[]` di localStorage.
3. Tabel **"Histori Terbaru"** diperbarui otomatis — gunakan layout `changelog-row` per baris.
4. Data tersimpan lokal — **tidak hilang** saat halaman di-refresh atau sinyal terputus.

---

## Modul 4 — Basic Stock Alert (Keamanan Inventori)

### Deskripsi
Sistem pemantauan stok bahan baku berbasis recipe mapping untuk memastikan ketersediaan sesuai target produksi.

### Komponen

#### 4a. Recipe Mapping
Mendefinisikan kebutuhan bahan baku per porsi menu. Contoh:

```json
{
  "nasi_goreng": {
    "beras": 200,
    "telur": 1,
    "minyak_goreng": 15
  },
  "mie_ayam": {
    "mie_basah": 150,
    "ayam": 80,
    "kaldu": 200
  }
}
```

#### 4b. Kalkulasi Kebutuhan Otomatis
```
Kebutuhan_Bahan = Rekomendasi_Produksi (dari Modul 2) × Kebutuhan_per_Porsi
```

#### 4c. Komparasi Stok & Visual Alert

```
Sisa_Stok = Stok_Tersedia (input staf) − Kebutuhan_Bahan

Jika Sisa_Stok < 0 → STATUS: KRITIS
  → status-badge dengan background #e5484d, teks "Kritis"
  → Red Alert badge di Dashboard widget (Modul 1)

Jika Sisa_Stok ≥ 0 → STATUS: AMAN
  → status-badge dengan background {colors.semantic-success}, teks "Aman"
```

### Mekanisme
1. Staf menginput jumlah stok fisik bahan baku — gunakan `text-input`.
2. Sistem mengambil angka Rekomendasi Final dari Modul 2.
3. Kalkulasi kebutuhan bahan dilakukan otomatis menggunakan recipe mapping.
4. Jika hasil negatif → badge **Red Alert** dipicu dan ditampilkan di Dashboard (Modul 1).

---

## Modul 5 — Evaluation Feature (Log Waste & Sukses MVP)

### Deskripsi
Fitur validasi performa untuk membuktikan apakah target reduksi waste ≥25% tercapai.

### Sub-fitur

#### 5a. Input Waste Harian
Form pencatatan pembuangan bahan — gunakan `text-input` per field:
- Nama bahan
- Jumlah dibuang (dengan satuan)
- Alasan (Rusak / Kedaluwarsa / Sisa Produksi) — pill toggle `pricing-tab`

#### 5b. Waste Costing (Otomatis)
```
Nilai_Kerugian = Jumlah_Terbuang × Harga_Beli_per_Satuan
```
Harga beli bahan didefinisikan di master data dan dapat diedit oleh admin.

#### 5c. Success Metrics View
- **Grafik tren waste:** Line chart sederhana — sumbu X = tanggal, sumbu Y = nilai kerugian (Rp). Render di dalam `product-screenshot-card`.
- **Perbandingan periode:** Minggu ini vs. minggu lalu.
- **Indikator KPI:** `status-badge` hijau (`{colors.semantic-success}`) jika waste turun ≥25% dibanding baseline.

### Struktur Data Waste Log

```json
{
  "date": "2025-07-15",
  "items": [
    {
      "ingredient": "beras",
      "quantity": 500,
      "unit": "gram",
      "reason": "Sisa Produksi",
      "unit_price": 15000,
      "total_loss": 7500
    }
  ],
  "total_daily_loss": 7500
}
```

### Mekanisme
1. User mengisi form waste → data disimpan ke `waste_log[]` di localStorage.
2. Sistem menghitung `total_loss` secara otomatis (Waste Costing).
3. Dashboard (Modul 1) mengambil total akumulasi waste dari `waste_log[]`.
4. Grafik tren dirender dari seluruh entri `waste_log[]`.

---

## Glosarium Teknis

| Istilah | Definisi |
|---|---|
| **Moving Average** | Metode rata-rata bergerak untuk memuluskan fluktuasi data histori penjualan |
| **Buffer** | Margin cadangan ekstra di atas rata-rata untuk keamanan operasional (default: +10%) |
| **LocalStorage** | Mekanisme penyimpanan data di sisi klien (browser) — persisten tanpa server |
| **Stockout** | Kondisi kehabisan stok bahan/produk saat ada permintaan pelanggan |
| **Inventory Turnover** | Rasio seberapa sering stok bahan diganti/habis dalam satu periode |
| **Recipe Mapping** | Tabel relasi antara menu dengan kebutuhan bahan baku per porsi |
| **Condition Modifier** | Pengali bobot berdasarkan kondisi hari (Normal/Ramai/Hujan) |
| **Waste Costing** | Konversi jumlah bahan terbuang menjadi nilai kerugian dalam rupiah |
| **Red Alert** | Indikator visual merah (#e5484d) yang dipicu saat stok tidak mencukupi kebutuhan produksi |
| **Surface Ladder** | Sistem elevasi 4-level dari DESIGN.md — canvas → surface-1 → surface-2 → surface-3 |

---

## Batasan Scope MVP

> Fitur berikut **di luar scope MVP** dan tidak boleh diimplementasikan kecuali diminta secara eksplisit:
> - Integrasi backend / database server
> - Sistem autentikasi pengguna (login/register)
> - Multi-outlet / multi-tenant
> - Integrasi POS eksternal
> - Machine learning model selain Moving Average
> - Notifikasi push / email

---

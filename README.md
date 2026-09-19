# Otocafe POS — Frontend (v2.1)

Aplikasi kasir & manajemen **Otocafe**: penjualan, stok bahan baku, HPP, hutang pelanggan,
dan laporan laba rugi. Halaman ini adalah **frontend statis** — seluruh data diambil dari
Google Apps Script yang bertindak sebagai REST API di atas Google Sheets.

> Repositori ini **tidak memuat kredensial apa pun**. Alamat API memang publik; setiap
> permintaan tetap harus membawa token sesi yang hanya terbit setelah login berhasil.

## Struktur berkas

```
.
├── index.html          ← halaman tunggal (SPA)
├── css/
│   └── style.css       ← tema "Velvet Roast & Ember" (gelap & terang)
└── js/
    ├── config.js       ← ⚠️ SATU-SATUNYA berkas yang perlu diubah
    ├── core.js         ← state, utilitas angka, lapisan fetch, login
    ├── kasir.js        ← terminal kasir, keranjang, struk, riwayat
    ├── hutang.js       ← daftar hutang pelanggan & pelunasan
    ├── kelola.js       ← menu, stok, pengeluaran, pengguna, pengaturan
    ├── laporan.js      ← dashboard, grafik, laba rugi
    └── app.js          ← navigasi SPA & pemasangan event
```

## Cara memakai

1. Deploy `Kode.gs` sebagai Web App di [script.google.com](https://script.google.com)
   (Execute as: **Me**, Who has access: **Anyone**), lalu salin URL yang berakhiran `/exec`.
2. Buka `js/config.js`, ganti nilai `GAS_URL` dengan URL tersebut.
3. Unggah seluruh isi folder ini ke repositori GitHub, lalu aktifkan GitHub Pages
   (Settings → Pages → Deploy from a branch → `main` / `(root)`).

Langkah rincinya ada di **PANDUAN-DEPLOY.md**.

## Memperbarui setelah ada perubahan

```bash
git add .
git commit -m "Deskripsi singkat perubahan"
git push
```

GitHub Pages membangun ulang dalam 1–2 menit. Bila masih tampil versi lama,
tekan **Ctrl+Shift+R**.

## Peran pengguna

| Peran | Akses |
|-------|-------|
| Admin | Seluruh modul |
| Owner | Laporan, dashboard, dan melihat daftar hutang |
| Kasir | Kasir, riwayat transaksi hari ini miliknya, menerima pelunasan hutang |

## Catatan kecepatan (v2.1)

Login cukup 1 permintaan ke server, aplikasi yang sudah login tampil seketika dari data
terakhir, dan stok terbaru ikut dikirim bersama struk. Uji kecepatan koneksi ada di
**Atur → Informasi Sistem → Tes Kecepatan Koneksi**.

## Teknologi

Vanilla JavaScript (tanpa framework) · Bootstrap 5 · Chart.js · Plus Jakarta Sans

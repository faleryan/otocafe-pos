# Panduan Deploy Otocafe POS v2
### Backend di Google Apps Script · Frontend di GitHub Pages

Arsitektur berubah dari versi sebelumnya. Dulu aplikasi tinggal di dalam Apps Script;
sekarang dipisah menjadi dua bagian yang berbicara lewat HTTP:

```
┌──────────────────────────────────────────┐
│  FRONTEND — GitHub Pages                 │
│  https://USERNAME.github.io/NAMA-REPO/   │
│  index.html · css/ · js/                 │
└──────────────────────────────────────────┘
                  ↕  fetch() JSON
┌──────────────────────────────────────────┐
│  BACKEND — Google Apps Script Web App    │
│  .../exec  →  doGet & doPost (JSON)      │
│  Google Sheets + Google Drive            │
└──────────────────────────────────────────┘
```

**Kerjakan BAGIAN A lebih dulu.** Anda butuh URL `/exec` dari sana sebelum frontend bisa jalan.

---

# BAGIAN A — Backend (Google Apps Script)

## A1. Pasang kode

1. Buka **https://script.google.com** dengan akun Google milik Otocafe.
2. Klik **Proyek Baru**, lalu beri nama proyek: **Otocafe API**.
3. Hapus seluruh isi `Code.gs` bawaan, tempel seluruh isi berkas **`Kode.gs`**.
4. Ganti nama berkas itu menjadi **Kode** (klik tiga titik di samping nama berkas → Rename).

> Berkas HTML dari versi lama (`Index`, `Stylesheet`, `JavaScript`) **tidak diperlukan lagi**.
> Kalau Anda memakai proyek lama, hapus ketiganya — kini semua tampilan ada di GitHub Pages.

## A2. Jalankan setup

Hanya perlu **sekali** seumur hidup aplikasi.

1. Pada dropdown fungsi di toolbar, pilih **`setupAppEnvironment`**.
2. Klik **▶ Run**.
3. Saat diminta izin: **Review permissions** → pilih akun → **Advanced** →
   **Go to Otocafe API (unsafe)** → **Allow**.
   *(Peringatan ini wajar untuk script buatan sendiri yang belum diverifikasi Google.)*
4. Buka **Execution log**. Anda akan melihat link folder Drive, link spreadsheet,
   dan tiga akun login default.

> **Sudah pernah pakai versi lama?** Jangan jalankan `setupAppEnvironment()` lagi.
> Data Anda sudah ada dan akan tetap terbaca. Cukup lewati langkah A2.

## A3. Deploy sebagai Web App

1. **Deploy** → **New deployment**.
2. Klik ikon gerigi ⚙ → pilih **Web app**.
3. Isi:

   | Kolom | Nilai |
   |---|---|
   | Description | `Otocafe API v2` |
   | Execute as | **Me** |
   | Who has access | **Anyone** |

4. Klik **Deploy**, lalu **salin URL yang berakhiran `/exec`**.
   Simpan dulu di Notepad — ini yang dipakai di Bagian B.

> **"Anyone" apakah aman?** Ya. Yang terbuka hanyalah pintu; isinya tetap terkunci.
> Selain `ping`, `info`, dan `login`, semua action menolak permintaan tanpa token sesi
> yang sah. Password disimpan sebagai hash SHA-256 dan tidak pernah dikirim balik ke browser.
> Percobaan login dibatasi 7 kali, setelah itu akun terkunci 15 menit.
>
> Pengaturan ini **wajib "Anyone"** — kalau dibatasi, browser pengunjung akan menerima
> halaman login Google, bukan data, dan aplikasi menampilkan pesan error.

## A4. Uji backend

Tempel URL `/exec` Anda ke address bar browser, tambahkan `?action=ping`:

```
https://script.google.com/macros/s/XXXXX/exec?action=ping
```

Yang benar akan muncul seperti ini:

```json
{"success":true,"data":{"app":"Otocafe App","versi":"2.0","waktu":"..."},"message":"API aktif."}
```

Kalau yang muncul halaman login Google atau pesan izin → ulangi langkah A3,
pastikan **Who has access: Anyone**.

---

# BAGIAN B — Frontend (GitHub Pages)

## B0. Siapkan folder

Ekstrak berkas **`otocafe-pos.zip`**. Hasilnya satu folder bernama **`otocafe-pos`** berisi:

```
otocafe-pos\          ← 📌 INI folder kerjanya, di sinilah nanti `git init` dijalankan
├── index.html        ← wajib berada di lapis paling atas
├── README.md
├── PANDUAN-DEPLOY.md
├── .gitignore
├── .nojekyll
├── css\
│   └── style.css
└── js\
    ├── config.js
    ├── core.js
    ├── kasir.js
    ├── hutang.js
    ├── kelola.js
    ├── laporan.js
    └── app.js
```

> ⚠️ **Titik paling rawan di seluruh panduan ini.** `git init` harus dijalankan di dalam
> folder `otocafe-pos` — folder yang berisi `index.html` secara langsung. Kalau dijalankan
> satu tingkat di atasnya, semua perintah git tetap berhasil tanpa satu pun pesan error,
> tetapi situs Anda akan menampilkan **404**. GitHub Pages hanya melihat `index.html`
> yang ada di lapis teratas repositori.

## B1. Isi alamat API — lakukan SEBELUM push

Buka **`js/config.js`** dengan Notepad (atau editor teks apa pun), cari baris ini:

```js
const GAS_URL = 'https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT_ANDA/exec';
```

Ganti isi tanda kutip dengan URL `/exec` dari langkah A3, lalu simpan.

Kalau langkah ini terlewat, situs tetap tampil tetapi langsung memberi tahu
"Alamat API belum diatur" di halaman login.

## B2. Pasang Git

| Sistem | Cara |
|---|---|
| Windows | Unduh di https://git-scm.com/download/win, install dengan pengaturan default. Setelah itu buka **PowerShell** atau **Git Bash** dari Start Menu. |
| macOS | Buka Terminal, ketik `git --version` — bila belum ada, macOS menawarkan instalasi otomatis. |
| Linux | `sudo apt install git` |

Verifikasi:

```bash
git --version
```

## B3. Perkenalkan diri ke Git (sekali seumur hidup komputer)

```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@akun-github-anda.com"
```

`user.name` bebas — hanya label di riwayat perubahan, bukan username GitHub.

## B4. Buat repository di GitHub

1. Daftar/masuk di https://github.com.
   *Username yang dipilih akan jadi bagian alamat situs Anda: `username.github.io`.*
2. Klik tombol **+** di kanan atas → **New repository**.
3. Isi **Repository name**, misalnya `otocafe-pos`.
4. Pilih **Public** — GitHub Pages gratis hanya untuk repositori publik.
5. **JANGAN** centang *Add a README*, *.gitignore*, atau *license*.
   Mencentangnya membuat push pertama bentrok.
6. Klik **Create repository**. Biarkan halaman yang muncul tetap terbuka.

## B5. Masuk ke folder & pastikan posisinya benar

Cara tercepat di Windows: buka folder `otocafe-pos` di File Explorer,
klik address bar, ketik `powershell`, tekan Enter.

Atau ketik manual:

```bash
cd "C:\path\ke\otocafe-pos"
```

Lalu **periksa isinya** — jangan lewati langkah ini:

```powershell
dir
```
(di Git Bash / Mac / Linux: `ls -la`)

Yang **wajib** terlihat: `index.html`, folder `css`, folder `js`.

- Kalau yang muncul justru folder `otocafe-pos` lagi → Anda satu tingkat terlalu tinggi,
  jalankan `cd otocafe-pos` dulu.
- Kalau ada berkas `.gs` di situ → pindahkan keluar. Berkas itu milik Apps Script,
  bukan GitHub.

## B6. Kirim ke GitHub

Jalankan **satu per satu**, jangan sekaligus:

```bash
git init
```
Hasil normal: `Initialized empty Git repository in ...`

```bash
git add .
```
Ada **titik** di akhir — artinya "ambil semua berkas di folder ini". Tanpa output = berhasil.

```bash
git commit -m "Deploy pertama Otocafe POS"
```
Hasil normal: daftar berkas yang tercatat.

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
```
Ganti `USERNAME` dan `NAMA-REPO` sesuai milik Anda.

```bash
git push -u origin main
```

Saat diminta:
- **Username:** username GitHub Anda
- **Password:** **Personal Access Token**, bukan password akun (lihat B7)

> 💡 Ketika mengetik atau menempel token, **layar sama sekali tidak menampilkan apa pun** —
> tidak ada bintang, tidak ada karakter. Itu normal, bukan tanda gagal. Tempel lalu Enter.
> Di PowerShell: klik kanan untuk paste. Di Git Bash: Shift+Insert.

Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

## B7. Personal Access Token

GitHub tidak lagi menerima password akun untuk operasi git. Kalau muncul pesan
`Password authentication is not supported`, buat token:

1. Buka https://github.com/settings/tokens
2. **Generate new token** → **Generate new token (classic)**
3. Isi:
   - **Note:** `otocafe-deploy`
   - **Expiration:** `90 days` (atau `No expiration` bila tak ingin repot)
   - **Centang scope:** ✅ **repo**
4. **Generate token**, lalu **salin** token `ghp_...` — hanya tampil sekali, simpan di Notepad.
5. Ulangi `git push -u origin main`, tempel token sebagai password.

> Kalau terminal terasa menyulitkan, ada jalur visual: **GitHub Desktop**
> (https://desktop.github.com) → login lewat browser → **Add Local Repository** →
> pilih folder `otocafe-pos` → **Publish repository**.

## B8. Aktifkan GitHub Pages

1. Buka repositori Anda di github.com.
2. **Periksa dulu**: di halaman utama repo harus terlihat `index.html`, folder `css`,
   dan folder `js` — bukan folder `otocafe-pos` lagi. Kalau yang terlihat folder,
   lihat bagian **Perbaikan 1** di bawah.
3. Klik tab **Settings** → sidebar kiri **Pages**.
4. Isi:

   | Kolom | Nilai |
   |---|---|
   | Source | **Deploy from a branch** |
   | Branch | **main** · **/ (root)** |
   | Enforce HTTPS | ✅ dicentang |

5. **Save**, tunggu 1–2 menit, refresh halaman. Akan muncul:
   *"Your site is live at https://USERNAME.github.io/NAMA-REPO/"*

## B9. Uji aplikasi

Buka alamat itu. Yang seharusnya terjadi:

1. Halaman login tampil dengan nama cafe Anda di bagian atas
   *(nama ini diambil dari backend — kalau muncul, artinya frontend dan backend sudah tersambung)*
2. Masuk dengan `admin` / `admin123`
3. Menu, stok, dan laporan terisi data dari Google Sheets

Lalu **segera ganti ketiga password default** lewat **Atur → Keamanan Akun**.

---

# Cara memperbarui nanti

Setiap kali ada perubahan berkas frontend, dari folder `otocafe-pos`:

```bash
git add .
git commit -m "Deskripsi singkat perubahan"
git push
```

Untuk perubahan **backend**: tempel kode baru di Apps Script, lalu
**Deploy → Manage deployments → ikon pensil ✏️ → Version: New version → Deploy**.
URL tetap sama, jadi `config.js` tidak perlu diubah.

> Kalau halaman masih menampilkan versi lama: itu cache browser.
> Tekan **Ctrl+Shift+R**, atau buka di jendela Incognito.

---

# Pemecahan Masalah

### Perbaikan 1 — Situs 404, dan di repo terlihat folder alih-alih `index.html`

Penyebabnya `git init` dijalankan satu tingkat terlalu tinggi. Tidak perlu menghapus
repositori — cukup kirim ulang dari folder yang benar:

```powershell
cd "C:\path\ke\otocafe-pos"
dir
```
Pastikan `index.html` terlihat. Lalu:

```powershell
git init
git add .
git commit -m "Perbaikan: kirim dari folder yang benar"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main --force
```

`--force` menimpa isi repositori dengan versi lokal Anda. Aman di sini karena isi lama
memang struktur yang salah — tetapi Anda berhak tahu apa yang sedang dijalankan.

### Perbaikan 2 — Halaman tampil polos tanpa warna

Berarti `css/` dan `js/` tidak terbawa sebagai folder. Buka repo di GitHub dan periksa.
Kalau semua berkas rata di lapis atas, kirim ulang dari folder asli hasil ekstraksi ZIP
(struktur foldernya sudah benar di sana) dengan langkah Perbaikan 1.

### Masalah umum lainnya

| Yang terlihat | Penyebab | Solusi |
|---|---|---|
| "Alamat API belum diatur" | `js/config.js` belum diisi | Isi `GAS_URL`, lalu `git add . && git commit -m "isi config" && git push` |
| "Server mengembalikan halaman web, bukan data" | Deployment bukan "Anyone" | Ulangi A3 dengan **Who has access: Anyone** |
| "Tidak dapat menghubungi server" | URL salah, atau tidak ada internet | Uji `?action=ping` di browser (langkah A4) |
| Error CORS di Console (F12) | Deployment lama masih aktif | Buat **New version** di Apps Script, jangan New deployment |
| Login selalu salah padahal password benar | Akun terkunci sementara | Tunggu 15 menit, atau jalankan `resetCache` di Apps Script |
| `fatal: not a git repository` | Belum `git init`, atau salah folder | Cek `dir` dulu, pastikan `index.html` terlihat |
| `remote origin already exists` | Sudah pernah disambungkan | Lewati, langsung `git push`. Kalau URL salah: `git remote set-url origin <url>` |
| `src refspec main does not match any` | Belum ada commit | Jalankan `git add .` lalu `git commit -m "..."` |
| `Updates were rejected` | Repo GitHub berisi berkas yang tidak ada di lokal | `git pull --rebase origin main` lalu `git push` |
| `LF will be replaced by CRLF` | Perbedaan format baris Windows/Linux | **Abaikan** — ini peringatan, bukan error |
| Data lama muncul setelah diubah di Sheets | Cache server (maks. 30 menit) | Jalankan fungsi `resetCache` di Apps Script |

---

# Istilah singkat

- **Repository (repo)** — folder proyek di GitHub
- **Commit** — menyimpan perubahan disertai catatan, riwayatnya tercatat
- **Push** — mengirim commit dari komputer ke GitHub
- **Branch** — cabang/versi proyek; yang dipakai di sini `main`
- **Personal Access Token** — "password khusus" untuk git, menggantikan password akun
- **CORS** — aturan browser soal siapa boleh memanggil alamat lain; sudah ditangani
  aplikasi ini dengan mengirim permintaan sebagai `text/plain`

/**
 * ============================================================
 * OTOCAFE POS — config.js
 * ============================================================
 * SATU-SATUNYA berkas yang perlu Anda ubah sebelum deploy.
 *
 * Isi GAS_URL dengan URL Web App Apps Script Anda — yang berakhiran /exec,
 * bukan /dev. Cara mendapatkannya:
 *   Apps Script → Deploy → New deployment → Web app
 *   → Execute as: Me · Who has access: Anyone → Deploy → salin URL
 *
 * Berkas ini memang publik dan tidak memuat rahasia apa pun.
 * Alamat API bukan kunci keamanan: setiap permintaan tetap harus membawa
 * token sesi yang hanya didapat setelah login dengan password yang benar.
 */

// ⚠️ GANTI baris di bawah ini dengan URL /exec milik Anda
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxpIg8GVES2N3yntu8uVvfqb1Dzq39__vYId0f_CfTI4BupfiD7ECXY1yAAQ6-BmKDk/exec';

// Batas waktu tunggu balasan server (milidetik).
// Google Apps Script bisa lambat saat "dingin"; 45 detik cukup lapang.
const API_TIMEOUT_MS = 45000;

// Versi frontend — muncul di halaman Pengaturan, berguna saat memastikan
// browser tidak sedang menampilkan versi lama dari cache.
const APP_VERSION = '2.0.0';


/* ------------------------------------------------------------------
 * Jangan ubah bagian di bawah ini.
 *
 * `const` pada berkas <script> biasa TIDAK menempel ke objek `window`,
 * sehingga berkas lain tidak bisa memeriksanya lewat window.GAS_URL.
 * Tiga baris ini membuat nilainya benar-benar tersedia secara global —
 * sekaligus memudahkan pengecekan lewat Console browser bila ada masalah.
 * ------------------------------------------------------------------ */
window.GAS_URL        = GAS_URL;
window.API_TIMEOUT_MS = API_TIMEOUT_MS;
window.APP_VERSION    = APP_VERSION;

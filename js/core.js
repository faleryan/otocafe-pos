/**
 * ============================================================
 * OTOCAFE POS — core.js — state, utilitas, tema, lapisan API, autentikasi
 * ============================================================
 * Dimuat kedua (setelah config.js). Menyediakan objek APP, fungsi
 * format angka, notifikasi, apiCall(), serta alur login/boot aplikasi.
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 1: STATE APLIKASI
// ════════════════════════════════════════════════════════════

const APP = {
  token:    null,
  user:     null,
  config:   {},
  menu:     [],
  bahan:    [],
  resep:    [],
  kategori: [],
  cart:     [],
  kategoriAktif: 'Semua',
  cariMenu: '',
  tipeOrder: 'Dine-In',
  metodeBayar: 'QRIS',
  diskon: 0,
  charts: {},
  strukTerakhir: null,
  cacheRiwayat: [],
  cacheHutang: null,
  hutangFilter: 'Belum Lunas',
  cariHutang: '',
  kontakPelanggan: '',
  jatuhTempo: '',
  cachePengeluaran: [],
  cacheDashboard: null,
  cachePengguna: [],
  sheetOpen: false
};

const LS = { TOKEN: 'oto_token', THEME: 'oto_theme', CART: 'oto_cart', META: 'oto_cart_meta', BOOT: 'oto_boot' };

// Versi frontend. Ditaruh di sini (bukan di config.js) supaya pembaruan tidak
// pernah mengharuskan Anda menimpa config.js yang berisi alamat API Anda.
const VERSI_FRONTEND = '2.3.1';

// Catatan kecepatan permintaan terakhir — ditampilkan di halaman Pengaturan
const STAT_API = [];

// Hak akses navigasi per peran (cermin dari RBAC di backend)
const NAV_ACCESS = {
  kasir:       ['admin', 'kasir'],
  riwayat:     ['admin', 'owner', 'kasir'],
  menu:        ['admin'],
  stok:        ['admin'],
  pengeluaran: ['admin'],
  laporan:     ['admin', 'owner'],
  hutang:      ['admin', 'owner', 'kasir'],
  pengguna:    ['admin'],
  pengaturan:  ['admin', 'owner', 'kasir']
};

const NAV_LABEL = {
  kasir: 'Terminal Kasir', riwayat: 'Riwayat Transaksi', menu: 'Kelola Menu & Resep',
  stok: 'Stok & Bahan Baku', hutang: 'Daftar Hutang Pelanggan',
  pengeluaran: 'Pengeluaran', laporan: 'Dashboard & Laporan',
  pengguna: 'Pengguna & Hak Akses', pengaturan: 'Pengaturan'
};

const NAV_ICON = {
  kasir: 'bi-calculator', riwayat: 'bi-receipt', menu: 'bi-cup-straw', stok: 'bi-box-seam',
  hutang: 'bi-person-lines-fill', pengeluaran: 'bi-wallet2', laporan: 'bi-graph-up-arrow',
  pengguna: 'bi-people', pengaturan: 'bi-sliders'
};

const NAV_SHORT = {
  kasir: 'Kasir', riwayat: 'Riwayat', menu: 'Menu', stok: 'Stok', hutang: 'Hutang',
  pengeluaran: 'Biaya', laporan: 'Laporan', pengguna: 'Akun', pengaturan: 'Atur'
};

// ════════════════════════════════════════════════════════════
// BAGIAN 2: UTILITAS
// ════════════════════════════════════════════════════════════

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/**
 * ── LAPISAN API ──────────────────────────────────────────────
 * Pengganti google.script.run. Seluruh komunikasi kini lewat HTTP
 * ke Web App Apps Script yang mengembalikan JSON.
 *
 * Tiga hal yang wajib dipertahankan di sini:
 * 1. Content-Type HARUS 'text/plain;charset=utf-8'.
 *    'application/json' memicu preflight OPTIONS yang tidak dilayani
 *    Apps Script, sehingga permintaan gagal dengan error CORS.
 * 2. redirect: 'follow' — Apps Script membalas 302 ke googleusercontent
 *    sebelum mengirim JSON yang sebenarnya.
 * 3. Token sesi dikirim di dalam body, tidak pernah di query string.
 *
 * @param {string} action        nama action di router backend
 * @param {object} params        parameter action
 * @param {string} tokenKhusus   token alternatif (dipakai saat logout)
 * @return {Promise<{success:boolean,data:*,message:string}>}
 */
// Action yang aman diulang otomatis bila koneksi putus (hanya membaca data)
const AKSI_BOLEH_ULANG = { ping: 1, info: 1, bootstrap: 1, getTransaksi: 1, getRingkasanKasir: 1,
  getMutasiStok: 1, getPengeluaran: 1, getHutang: 1, getRiwayatBayarHutang: 1, getDashboardData: 1, getPengguna: 1 };

async function apiCall(action, params, tokenKhusus) {
  if (!window.GAS_URL || String(GAS_URL).indexOf('/exec') === -1) {
    throw new Error('Alamat API belum diatur. Buka berkas js/config.js lalu isi GAS_URL '
                  + 'dengan URL /exec hasil deploy Apps Script.');
  }

  const isi = JSON.stringify({
    action: action,
    token: (tokenKhusus !== undefined && tokenKhusus !== null) ? tokenKhusus : (APP.token || ''),
    params: params || {}
  });

  // Permintaan baca diulang SEKALI bila gagal di jaringan — sering terjadi saat
  // Apps Script "dingin" setelah lama tidak dipakai. Permintaan tulis (transaksi,
  // pembayaran) sengaja TIDAK diulang agar tidak tercatat dua kali.
  const bolehUlang = !!AKSI_BOLEH_ULANG[action];
  let percobaan = 0;

  while (true) {
    percobaan++;
    const mulai = (window.performance && performance.now) ? performance.now() : Date.now();
    const pembatal = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const pewaktu = pembatal ? setTimeout(() => pembatal.abort(), API_TIMEOUT_MS) : null;

    let res;
    try {
      res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: isi,
        redirect: 'follow',
        signal: pembatal ? pembatal.signal : undefined
      });
    } catch (err) {
      if (pewaktu) clearTimeout(pewaktu);
      if (bolehUlang && percobaan < 2) { await new Promise(r => setTimeout(r, 700)); continue; }
      if (err && err.name === 'AbortError') {
        throw new Error('Server tidak merespons lebih dari ' + Math.round(API_TIMEOUT_MS / 1000)
                      + ' detik. Periksa koneksi internet Anda.');
      }
      throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet, '
                    + 'atau pastikan alamat API di js/config.js sudah benar.');
    }
    if (pewaktu) clearTimeout(pewaktu);

    const teks = await res.text();
    catatKecepatan(action, mulai);
    try {
      return JSON.parse(teks);
    } catch (e) {
      if (/<html/i.test(teks)) {
        throw new Error('Server mengembalikan halaman web, bukan data. Biasanya karena deployment '
                      + 'Apps Script belum disetel "Who has access: Anyone", atau URL /exec salah.');
      }
      throw new Error('Balasan server tidak dapat dibaca. Coba muat ulang halaman.');
    }
  }
}

/** Simpan durasi permintaan (maks. 30 terakhir) untuk panel diagnostik. */
function catatKecepatan(action, mulai) {
  const selesai = (window.performance && performance.now) ? performance.now() : Date.now();
  STAT_API.push({ action: action, ms: Math.round(selesai - mulai), waktu: new Date() });
  if (STAT_API.length > 30) STAT_API.shift();
}

/** Rupiah fleksibel — desimal hanya tampil bila memang ada. */
function rupiah(n) {
  const v = Number(n) || 0;
  const negatif = v < 0, abs = Math.abs(v);
  const bulat = Math.floor(abs);
  const sisa = Math.round((abs - bulat) * 100);

  let teks = (sisa === 100 ? bulat + 1 : bulat).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (sisa > 0 && sisa < 100) {
    teks += ',' + (sisa % 10 === 0 ? String(sisa / 10) : String(sisa).padStart(2, '0'));
  }
  return (negatif ? '-' : '') + 'Rp ' + teks;
}

/** Angka umum (stok, porsi, resep) — sampai 3 desimal, nol di belakang dibuang. */
function angka(n, maksDesimal) {
  const d = (maksDesimal === undefined) ? 3 : maksDesimal;
  const v = Number(n) || 0;
  const negatif = v < 0, abs = Math.abs(v);
  const f = Math.pow(10, d);
  const bulatkanNilai = Math.round(abs * f) / f;
  const bulat = Math.floor(bulatkanNilai);

  let teks = bulat.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const pecahan = Math.round((bulatkanNilai - bulat) * f);
  if (pecahan > 0) {
    const desimal = String(pecahan).padStart(d, '0').replace(/0+$/, '');
    if (desimal) teks += ',' + desimal;
  }
  return (negatif ? '-' : '') + teks;
}

/** Pembacaan input angka yang memaafkan: "22.000", "22,5", "Rp 15rb" -> angka. */
function bacaAngka(nilai) {
  if (typeof nilai === 'number') return isNaN(nilai) ? 0 : nilai;
  let t = String(nilai === null || nilai === undefined ? '' : nilai).replace(/[^0-9.,\-]/g, '').trim();
  if (t === '' || t === '-') return 0;
  const adaTitik = t.indexOf('.') !== -1, adaKoma = t.indexOf(',') !== -1;
  if (adaTitik && adaKoma) t = t.replace(/\./g, '').replace(',', '.');
  else if (adaKoma) t = t.replace(',', '.');
  else if (adaTitik && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return isNaN(n) ? 0 : n;
}

/** Bulatkan ke 2 desimal tanpa galat floating point. */
function bulatkan(n, d) {
  const dd = (d === undefined) ? 2 : d;
  const f = Math.pow(10, dd);
  return Math.round(((Number(n) || 0) + Number.EPSILON) * f) / f;
}
function esc(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function debounce(fn, ms) {
  let t;
  return function () {
    const ctx = this, args = arguments;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(ctx, args), ms || 220);
  };
}
function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function initial(nama) {
  return String(nama || '?').trim().charAt(0).toUpperCase();
}

/** Simpan/ambil dari localStorage dengan aman (bisa diblokir di mode privat). */
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }

/** Notifikasi non-blocking. */
function toast(title, body, type) {
  type = type || 'info';
  const icons = { success: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
  const el = document.createElement('div');
  el.className = 'oto-toast toast-' + type;
  el.innerHTML =
    '<i class="bi ' + (icons[type] || icons.info) + '"></i>' +
    '<div><div class="t-title">' + esc(title) + '</div>' +
    (body ? '<div class="t-body">' + esc(body) + '</div>' : '') + '</div>';
  $('#toastStack').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, type === 'danger' ? 5200 : 3400);
}

/** Modal konfirmasi generik (menggantikan confirm() bawaan browser). */
let confirmModal = null;
function konfirmasi(judul, teks, onYes, labelYes) {
  if (!confirmModal) confirmModal = new bootstrap.Modal($('#modalKonfirmasi'));
  $('#confirmTitle').textContent = judul;
  $('#confirmText').textContent = teks;
  const btn = $('#btnConfirmYes');
  btn.textContent = labelYes || 'Ya, Lanjutkan';
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', () => { confirmModal.hide(); onYes(); });
  confirmModal.show();
}

function setLoadingBtn(btn, loading, textAsli) {
  if (!btn) return;
  if (loading) {
    btn.dataset.html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin-mini"></span> ' + (textAsli || 'Memproses…');
  } else {
    btn.disabled = false;
    if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
  }
}

function skeleton(container, rows) {
  const el = typeof container === 'string' ? $(container) : container;
  if (!el) return;
  el.innerHTML = Array(rows || 4).fill('<div class="skeleton-row"></div>').join('');
}

function emptyState(icon, judul, teks) {
  return '<div class="empty-state"><i class="bi ' + icon + '"></i><h5>' + esc(judul) + '</h5><p>' + esc(teks) + '</p></div>';
}

/** Tangani respons standar backend; deteksi sesi kedaluwarsa. */
function handleRes(res) {
  if (!res) throw new Error('Tidak ada respons dari server.');
  if (!res.success) {
    if (/[Ss]esi berakhir/.test(res.message || '') || (res.data && res.data.sessionExpired)) {
      paksaLogout('Sesi Anda telah berakhir. Silakan login kembali.');
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(res.message || 'Terjadi kesalahan.');
  }
  return res.data;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 3: TEMA (DARK / LIGHT MODE)
// ════════════════════════════════════════════════════════════

function terapkanTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  lsSet(LS.THEME, tema);
  const ikon = tema === 'dark' ? 'bi-sun' : 'bi-moon-stars';
  $$('#btnTheme i, #btnThemeMobile i').forEach(i => i.className = 'bi ' + ikon);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'dark' ? '#1B0D12' : '#FBF4EF');
  refreshChartTheme();
}

function toggleTema() {
  const now = document.documentElement.getAttribute('data-theme');
  terapkanTema(now === 'dark' ? 'light' : 'dark');
}

function warnaTema() {
  const cs = getComputedStyle(document.documentElement);
  const get = n => cs.getPropertyValue(n).trim();
  return {
    primary: get('--primary') || '#E0533C',
    secondary: get('--secondary') || '#F3A847',
    tertiary: get('--tertiary') || '#50B98B',
    text: get('--text') || '#FCEEE9',
    text2: get('--text-2') || '#C8A9A2',
    text3: get('--text-3') || '#8A6B69',
    grid: get('--border') || 'rgba(255,255,255,.08)',
    card: get('--card') || '#2D1B22'
  };
}

// ════════════════════════════════════════════════════════════
// BAGIAN 4: BOOT & AUTENTIKASI
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  terapkanTema(lsGet(LS.THEME, 'dark'));
  pasangEventGlobal();
  mulaiJam();

  // Cegat kesalahan paling umum: alamat API belum diisi setelah deploy
  if (!window.GAS_URL || GAS_URL.indexOf('GANTI_DENGAN') !== -1 || GAS_URL.indexOf('/exec') === -1) {
    return tampilkanLogin('Alamat API belum diatur. Buka berkas js/config.js, isi GAS_URL dengan '
                        + 'URL /exec hasil deploy Apps Script, lalu unggah ulang ke GitHub.');
  }

  const token = lsGet(LS.TOKEN, null);
  if (!token) {
    muatInfoPublik(); // kop cafe di halaman login, sekaligus "membangunkan" server
    return tampilkanLogin();
  }

  APP.token = token;

  // ── Tampil seketika dari data terakhir, lalu segarkan di belakang layar ──
  // Pengguna langsung bisa bekerja tanpa menunggu server; data diperbarui
  // begitu balasan datang (biasanya 1–3 detik kemudian).
  const tersimpan = bacaBootTersimpan(token);
  if (tersimpan) {
    terapkanBootstrap(tersimpan, false);
    masukAplikasi();
    segarkanBootstrapLatar();
    return;
  }

  $('#bootText').textContent = 'Memuat data cafe…';
  muatBootstrap()
    .then(() => masukAplikasi())
    .catch(err => {
      console.warn('Boot gagal:', err);
      lsDel(LS.TOKEN);
      tampilkanLogin(err && err.message !== 'SESSION_EXPIRED' ? err.message : '');
    });
});

/** Data awal terakhir yang tersimpan di perangkat — hanya untuk token yang sama. */
function bacaBootTersimpan(token) {
  try {
    const x = JSON.parse(lsGet(LS.BOOT, 'null'));
    if (x && x.token === token && x.data && x.data.user) return x.data;
  } catch (e) {}
  return null;
}

/** Segarkan data awal tanpa menghalangi pengguna. */
function segarkanBootstrapLatar() {
  apiCall('bootstrap').then(res => {
    handleRes(res); // sesi kedaluwarsa -> otomatis kembali ke login
    terapkanBootstrap(res.data, true);
    terapkanIdentitas();
    if (APP.navAktif === 'kasir') renderKasir();
    if (APP.navAktif === 'stok' && typeof renderBahan === 'function') renderBahan();
    if (APP.navAktif === 'menu' && typeof renderMenuAdmin === 'function') renderMenuAdmin();
    tandaiSinkron();
  }).catch(err => {
    if (err && err.message !== 'SESSION_EXPIRED') {
      toast('Koneksi lambat', 'Menampilkan data terakhir. ' + err.message, 'warning');
    }
  });
}

/**
 * Ambil identitas cafe (nama, tagline, logo) tanpa perlu login.
 * Dipakai agar halaman login sudah berkop Otocafe, dan sekaligus memberi
 * tahu lebih awal bila alamat API salah — sebelum pengguna mengetik password.
 */
function muatInfoPublik() {
  apiCall('info').then(res => {
    if (!res || !res.success || !res.data) return;
    const d = res.data;
    if (d.namaCafe) {
      $('.login-title').textContent = d.namaCafe;
      document.title = d.namaCafe + ' — POS';
    }
    if (d.tagline) $('.login-sub').textContent = d.tagline;
    if (d.logoUrl) {
      const kotak = $('.login-logo');
      const img = document.createElement('img');
      img.src = d.logoUrl;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit';
      img.onload = () => { kotak.innerHTML = ''; kotak.appendChild(img); };
    }
  }).catch(err => {
    // Tidak memblokir tampilan login — hanya memberi peringatan dini
    const box = $('#loginError');
    if (box && box.classList.contains('d-none')) {
      box.textContent = 'Tidak dapat menghubungi server: ' + err.message;
      box.classList.remove('d-none');
    }
  });
}

function tampilkanLogin(pesan) {
  $('#bootOverlay').classList.add('d-none');
  $('#appShell').classList.add('d-none');
  $('#loginScreen').classList.remove('d-none');
  if (pesan) {
    const box = $('#loginError');
    box.textContent = pesan;
    box.classList.remove('d-none');
  }
  setTimeout(() => $('#loginUser').focus(), 120);
}

function paksaLogout(pesan) {
  APP.token = null; APP.user = null;
  // Data milik sesi sebelumnya (mis. Admin) tidak boleh terbawa ke akun berikutnya
  APP.cacheHutang = null; APP.cacheDashboard = null; APP.cacheRiwayat = [];
  APP.cachePengeluaran = []; APP.cachePengguna = []; APP.strukTerakhir = null;
  lsDel(LS.TOKEN);
  lsDel(LS.BOOT); // data cafe tidak ditinggalkan di perangkat setelah keluar
  $('#appShell').classList.add('d-none');
  tampilkanLogin(pesan || '');
}

async function muatBootstrap() {
  const res = await apiCall('bootstrap');
  const data = handleRes(res);
  terapkanBootstrap(data, true);
  return data;
}

/**
 * Pasang data awal ke state aplikasi.
 * @param {object}  data    isi bootstrap dari server (atau dari penyimpanan lokal)
 * @param {boolean} simpan  simpan ke perangkat untuk tampilan seketika berikutnya
 */
function terapkanBootstrap(data, simpan) {
  APP.user     = data.user;
  APP.config   = data.config || {};
  APP.menu     = data.menu || [];
  APP.bahan    = data.bahan || [];
  APP.resep    = data.resep || [];
  APP.kategori = data.kategori || [];
  if (data.ringkasan) APP.ringkasan = data.ringkasan;

  if (simpan && APP.token) {
    lsSet(LS.BOOT, JSON.stringify({ token: APP.token, data: data, disimpan: Date.now() }));
  }
}

function masukAplikasi() {
  $('#bootOverlay').classList.add('d-none');
  $('#loginScreen').classList.add('d-none');
  $('#appShell').classList.remove('d-none');

  terapkanIdentitas();
  bangunNavigasi();
  pulihkanKeranjang();
  renderKasir();
  // Ringkasan shift sudah ikut di data awal — tidak perlu permintaan terpisah
  if (APP.ringkasan) tampilkanRingkasan(APP.ringkasan);
  else perbaruiRingkasanShift();
  tandaiSinkron();

  // Halaman awal sesuai peran
  const awal = APP.user.role === 'owner' ? 'laporan' : 'kasir';
  navigateTo(awal);
}

function terapkanIdentitas() {
  const c = APP.config;
  const nama = c.namaCafe || 'Otocafe';
  document.title = nama + ' — POS';
  $('#topCafeName').textContent = nama;
  $('#userName').textContent = APP.user.nama;
  $('#userRole').textContent = APP.user.role;
  $('#userAvatar').textContent = initial(APP.user.nama);
  $('#topRoleChip').textContent = APP.user.role;

  if (c.logoUrl) {
    const img = $('#railLogoImg');
    img.src = c.logoUrl;
    img.onload = () => { img.classList.remove('d-none'); $('#railLogoIcon').classList.add('d-none'); };
    img.onerror = () => { img.classList.add('d-none'); $('#railLogoIcon').classList.remove('d-none'); };
  }
}

/** Login — validasi HTML5 dulu, lalu server. */
function pasangLoginForm() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const btn = $('#btnLogin');
    const errBox = $('#loginError');
    errBox.classList.add('d-none');
    setLoadingBtn(btn, true, 'Memeriksa…');

    try {
      const res = await apiCall('login', { username: $('#loginUser').value.trim(), password: $('#loginPass').value });
      if (!res.success) throw new Error(res.message);

      APP.token = res.data.token;
      lsSet(LS.TOKEN, APP.token);
      $('#loginPass').value = '';

      // Backend v2.1 mengirim data awal bersama balasan login (1 perjalanan, bukan 3).
      // Bila backend masih versi lama, ambil terpisah seperti sebelumnya.
      if (res.data.bootstrap) terapkanBootstrap(res.data.bootstrap, true);
      else await muatBootstrap();
      masukAplikasi();
      toast('Selamat datang, ' + res.data.user.nama.split(' ')[0], 'Anda masuk sebagai ' + res.data.user.role + '.', 'success');
    } catch (err) {
      errBox.textContent = err.message || 'Login gagal.';
      errBox.classList.remove('d-none');
    } finally {
      setLoadingBtn(btn, false);
    }
  });

  $('#togglePass').addEventListener('click', () => {
    const inp = $('#loginPass');
    const ikon = $('#togglePass i');
    if (inp.type === 'password') { inp.type = 'text'; ikon.className = 'bi bi-eye-slash'; }
    else { inp.type = 'password'; ikon.className = 'bi bi-eye'; }
  });
}

function logout() {
  konfirmasi('Keluar Aplikasi', 'Keranjang yang belum dibayar akan tetap tersimpan di perangkat ini.', async () => {
    const t = APP.token;
    paksaLogout();
    try { await apiCall('logout', {}, t); } catch (e) {}
    toast('Sampai jumpa', 'Anda telah keluar dari aplikasi.', 'info');
  }, 'Ya, Keluar');
}

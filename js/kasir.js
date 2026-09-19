/**
 * ============================================================
 * OTOCAFE POS — kasir.js — terminal kasir, keranjang, struk, riwayat
 * ============================================================
 * Render daftar menu, keranjang optimistic (localStorage), proses
 * pembayaran termasuk metode Hutang, cetak struk, dan riwayat transaksi.
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 6: MODUL KASIR — RENDER MENU
// ════════════════════════════════════════════════════════════

function renderKasir() {
  renderHero();
  renderKategori();
  renderMenuGrid();
  renderKeranjang();
}

function deskripsiResep(idMenu) {
  const namaBahan = {};
  APP.bahan.forEach(b => namaBahan[b.id] = b);
  const items = APP.resep.filter(r => r.idMenu === idMenu).slice(0, 3)
    .map(r => (namaBahan[r.idBahan] ? namaBahan[r.idBahan].nama + ' ' + angka(r.jumlah) + namaSatuanSingkat(namaBahan[r.idBahan].satuan) : ''))
    .filter(Boolean);
  return items.length ? 'Resep: ' + items.join(', ') : 'Belum ada resep — HPP belum terhitung.';
}
function namaSatuanSingkat(s) {
  const map = { gram: 'g', ml: 'ml', pcs: ' pcs', liter: ' L', kg: ' kg' };
  return map[s] !== undefined ? map[s] : ' ' + s;
}

function statusStok(porsi) {
  if (porsi <= 0)  return { cls: 'badge-habis',   txt: 'Habis' };
  if (porsi <= 10) return { cls: 'badge-menipis', txt: 'Sisa ' + porsi };
  return { cls: 'badge-aman', txt: 'Stok Aman' };
}

function renderHero() {
  const aktif = APP.menu.filter(m => m.aktif);
  if (!aktif.length) { $('#heroBanner').innerHTML = ''; $('#heroBanner').style.display = 'none'; return; }
  $('#heroBanner').style.display = '';

  // Menu unggulan = harga tertinggi yang masih tersedia (atau menu pertama)
  const hero = aktif.slice().sort((a, b) => b.harga - a.harga).find(m => m.porsiTersedia > 0) || aktif[0];
  const margin = hero.harga > 0 ? ((hero.harga - hero.hpp) / hero.harga * 100) : 0;

  $('#heroBanner').innerHTML =
    '<div style="position:relative;z-index:1;min-width:0">' +
      '<div class="hero-badges">' +
        '<span class="chip badge-cream" style="padding:.35rem .85rem"><i class="bi bi-fire"></i> Menu Unggulan</span>' +
        '<span class="chip">Porsi siap: ' + (hero.porsiTersedia >= 999 ? '∞' : hero.porsiTersedia) + '</span>' +
      '</div>' +
      '<h2 class="hero-title">' + esc(hero.nama) + '</h2>' +
      '<p class="hero-desc">' + esc(deskripsiResep(hero.id)) + '</p>' +
      '<div class="hero-foot">' +
        '<div><div class="hero-price-label">Harga Satuan</div>' +
        '<div class="hero-price">' + rupiah(hero.harga) + '</div></div>' +
        '<button class="btn-ember" onclick="tambahKeKeranjang(\'' + hero.id + '\')"' +
          (hero.porsiTersedia <= 0 ? ' disabled' : '') + '>' +
          '<i class="bi bi-cart-plus"></i> Tambah Order</button>' +
      '</div>' +
    '</div>' +
    '<div class="hero-visual">' +
      (hero.foto ? '<img src="' + esc(hero.foto) + '" alt="" onerror="this.style.display=\'none\'">' : '<i class="bi bi-cup-hot"></i>') +
      '<span class="hero-hpp"><span class="dot-ok" style="animation:none"></span> HPP ' + rupiah(hero.hpp) +
        ' · Margin ' + margin.toFixed(0) + '%</span>' +
    '</div>';
}

function renderKategori() {
  const hitung = { Semua: APP.menu.filter(m => m.aktif).length };
  APP.menu.filter(m => m.aktif).forEach(m => hitung[m.kategori] = (hitung[m.kategori] || 0) + 1);

  const daftar = ['Semua'].concat(APP.kategori);
  $('#kategoriRail').innerHTML = daftar.map(k =>
    '<button class="chip chip-filter' + (k === APP.kategoriAktif ? ' active' : '') + '" data-kat="' + esc(k) + '">' +
      esc(k) + ' (' + (hitung[k] || 0) + ')</button>'
  ).join('');

  $$('#kategoriRail .chip-filter').forEach(b => {
    b.onclick = () => { APP.kategoriAktif = b.dataset.kat; renderKategori(); renderMenuGrid(); };
  });
}

/** Filter & pencarian dilakukan LOKAL dari APP.menu — 0ms, tanpa server. */
function menuTersaring() {
  const q = APP.cariMenu.toLowerCase().trim();
  return APP.menu.filter(m => {
    if (!m.aktif) return false;
    if (APP.kategoriAktif !== 'Semua' && m.kategori !== APP.kategoriAktif) return false;
    if (q && !(m.nama.toLowerCase().indexOf(q) !== -1 || m.kategori.toLowerCase().indexOf(q) !== -1)) return false;
    return true;
  });
}

function renderMenuGrid() {
  const list = menuTersaring();
  const total = APP.menu.filter(m => m.aktif).length;
  $('#menuMeta').textContent = APP.kategori.length + ' kategori · ' + total + ' menu aktif' +
    (list.length !== total ? ' · ' + list.length + ' ditampilkan' : '');

  if (!list.length) {
    $('#menuGrid').innerHTML = emptyState('bi-search',
      APP.cariMenu ? 'Menu tidak ditemukan' : 'Belum ada menu aktif',
      APP.cariMenu ? 'Coba kata kunci lain atau ganti kategori.' : 'Tambahkan menu melalui halaman Kelola Menu.');
    return;
  }

  $('#menuGrid').innerHTML = list.map(m => {
    const diKeranjang = APP.cart.find(c => c.idMenu === m.id);
    const st = statusStok(m.porsiTersedia);
    const habis = m.porsiTersedia <= 0;
    return '' +
      '<article class="menu-card' + (habis ? ' is-habis' : '') + '" data-id="' + m.id + '">' +
        (diKeranjang ? '<span class="qty-pill">' + angka(diKeranjang.qty) + '</span>' : '') +
        '<div class="menu-thumb">' +
          (m.foto ? '<img src="' + esc(m.foto) + '" alt="' + esc(m.nama) + '" loading="lazy" onerror="this.remove()">'
                  : '<i class="bi bi-cup-hot"></i>') +
          (m.badge ? '<span class="menu-badge badge-oto badge-dark">' + esc(m.badge) + '</span>' : '') +
          '<span class="menu-stock badge-oto ' + st.cls + '">' + st.txt + '</span>' +
        '</div>' +
        '<div class="menu-body">' +
          '<div class="menu-cat">' + esc(m.kategori) + '</div>' +
          '<h4 class="menu-name">' + esc(m.nama) + '</h4>' +
          '<p class="menu-recipe">' + esc(deskripsiResep(m.id)) + '</p>' +
        '</div>' +
        '<div class="menu-foot">' +
          '<div><div class="menu-price-label">Harga Satuan</div>' +
          '<div class="menu-price">' + rupiah(m.harga) + '</div></div>' +
          '<button class="add-disc" data-add="' + m.id + '"' + (habis ? ' disabled' : '') +
            ' aria-label="Tambah ' + esc(m.nama) + '"><i class="bi bi-plus-lg"></i></button>' +
        '</div>' +
      '</article>';
  }).join('');

  $$('#menuGrid [data-add]').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); tambahKeKeranjang(b.dataset.add); };
  });
  $$('#menuGrid .menu-card').forEach(c => {
    c.onclick = () => { if (!c.classList.contains('is-habis')) tambahKeKeranjang(c.dataset.id); };
  });
}

// ════════════════════════════════════════════════════════════
// BAGIAN 7: KERANJANG — OPTIMISTIC UI + LOCALSTORAGE
// ════════════════════════════════════════════════════════════

function pulihkanKeranjang() {
  try {
    APP.cart = JSON.parse(lsGet(LS.CART, '[]')) || [];
    const meta = JSON.parse(lsGet(LS.META, '{}')) || {};
    APP.tipeOrder   = meta.tipe   || 'Dine-In';
    APP.metodeBayar = meta.metode || 'QRIS';
    APP.diskon      = bacaAngka(meta.diskon);
    if (meta.pelanggan)  $('#inpPelanggan').value = meta.pelanggan;
    if (meta.meja)       $('#inpMeja').value = meta.meja;
    if (meta.kontak)     $('#inpKontak').value = meta.kontak;
    if (meta.jatuhTempo) $('#inpJatuhTempo').value = meta.jatuhTempo;
  } catch (e) { APP.cart = []; }

  // Bersihkan item yang menunya sudah tidak ada / nonaktif
  const idAktif = {};
  APP.menu.forEach(m => { if (m.aktif) idAktif[m.id] = m; });
  APP.cart = APP.cart.filter(c => idAktif[c.idMenu]);

  $$('#tipeToggle .type-btn').forEach(b => b.classList.toggle('active', b.dataset.tipe === APP.tipeOrder));
  $$('#payGrid .pay-btn').forEach(b => b.classList.toggle('active', b.dataset.pay === APP.metodeBayar));
  $('#slipTipe').textContent = APP.tipeOrder;
  perbaruiTampilanHutang();
  simpanKeranjang();
}

function simpanKeranjang() {
  lsSet(LS.CART, JSON.stringify(APP.cart));
  lsSet(LS.META, JSON.stringify({
    tipe: APP.tipeOrder, metode: APP.metodeBayar, diskon: APP.diskon,
    pelanggan: $('#inpPelanggan') ? $('#inpPelanggan').value : '',
    meja: $('#inpMeja') ? $('#inpMeja').value : '',
    kontak: $('#inpKontak') ? $('#inpKontak').value : '',
    jatuhTempo: $('#inpJatuhTempo') ? $('#inpJatuhTempo').value : ''
  }));
}

/** UI diperbarui INSTAN (0ms) — tidak menunggu server sama sekali. */
function tambahKeKeranjang(idMenu) {
  const m = APP.menu.find(x => x.id === idMenu);
  if (!m || !m.aktif) return;

  const ada = APP.cart.find(c => c.idMenu === idMenu);
  const qtyBaru = bulatkan((ada ? ada.qty : 0) + 1, 3);

  if (m.porsiTersedia < 999 && qtyBaru > m.porsiTersedia) {
    toast('Stok tidak cukup', 'Bahan baku hanya cukup untuk ' + m.porsiTersedia + ' porsi ' + m.nama + '.', 'warning');
    return;
  }

  if (ada) ada.qty = qtyBaru;
  else APP.cart.push({ idMenu: m.id, nama: m.nama, kategori: m.kategori, harga: m.harga, hpp: m.hpp, qty: 1 });

  simpanKeranjang();
  renderKeranjang();
  renderMenuGrid();
}

function ubahQty(idMenu, delta) {
  const item = APP.cart.find(c => c.idMenu === idMenu);
  if (!item) return;
  setQty(idMenu, bulatkan(item.qty + delta, 3));
}

/** Jumlah porsi bebas — boleh pecahan (mis. 0,5 untuk setengah porsi). */
function setQty(idMenu, nilai) {
  const item = APP.cart.find(c => c.idMenu === idMenu);
  if (!item) return;
  const m = APP.menu.find(x => x.id === idMenu);
  const baru = bulatkan(bacaAngka(nilai), 3);

  if (baru <= 0) return hapusDariKeranjang(idMenu);
  if (m && m.porsiTersedia < 999 && baru > m.porsiTersedia) {
    toast('Stok tidak cukup', 'Bahan baku hanya cukup untuk ' + angka(m.porsiTersedia) + ' porsi.', 'warning');
    item.qty = m.porsiTersedia;
  } else {
    item.qty = baru;
  }
  simpanKeranjang();
  renderKeranjang();
  renderMenuGrid();
}

function hapusDariKeranjang(idMenu) {
  APP.cart = APP.cart.filter(c => c.idMenu !== idMenu);
  simpanKeranjang();
  renderKeranjang();
  renderMenuGrid();
}

function kosongkanKeranjang(diam) {
  const lanjut = () => {
    APP.cart = []; APP.diskon = 0;
    $('#inpPelanggan').value = ''; $('#inpMeja').value = '';
    $('#inpKontak').value = ''; $('#inpJatuhTempo').value = '';
    simpanKeranjang(); renderKeranjang(); renderMenuGrid();
  };
  if (diam) return lanjut();
  if (!APP.cart.length) return;
  konfirmasi('Kosongkan Keranjang', 'Semua item pada pesanan ini akan dihapus.', lanjut, 'Ya, Kosongkan');
}

function hitungTotal() {
  const subtotal = bulatkan(APP.cart.reduce((s, c) => s + c.harga * c.qty, 0));
  const hpp      = bulatkan(APP.cart.reduce((s, c) => s + c.hpp * c.qty, 0));
  const diskon   = bulatkan(Math.min(Math.max(0, APP.diskon), subtotal));
  const persen   = bacaAngka(APP.config.pajakPersen);
  const pajak    = bulatkan((subtotal - diskon) * persen / 100);
  return { subtotal, hpp, diskon, pajak, persen,
           total: bulatkan(subtotal - diskon + pajak),
           qty: bulatkan(APP.cart.reduce((s, c) => s + c.qty, 0), 3) };
}

function renderKeranjang() {
  const t = hitungTotal();

  if (!APP.cart.length) {
    $('#slipItems').innerHTML =
      '<div class="slip-empty"><i class="bi bi-bag"></i><p>Keranjang masih kosong.<br>Pilih menu untuk memulai pesanan.</p></div>';
  } else {
    $('#slipItems').innerHTML = APP.cart.map(c =>
      '<div class="slip-item">' +
        '<div class="slip-item-top">' +
          '<div style="min-width:0">' +
            '<div class="slip-item-name">' + esc(c.nama) + '</div>' +
            '<div class="slip-item-note">' + esc(c.kategori) + ' · ' + rupiah(c.harga) + ' / porsi</div>' +
          '</div>' +
          '<div class="slip-item-price">' + rupiah(c.harga * c.qty) + '</div>' +
        '</div>' +
        '<div class="slip-item-bot">' +
          '<span class="slip-item-hpp"><i class="bi bi-box-seam"></i> HPP ' + rupiah(c.hpp * c.qty) + '</span>' +
          '<div class="stepper">' +
            '<button class="step-btn" data-minus="' + c.idMenu + '"><i class="bi bi-dash"></i></button>' +
            '<input type="number" class="qty-input" data-qty="' + c.idMenu + '" value="' + c.qty + '" min="0" step="any" aria-label="Jumlah porsi">' +
            '<button class="step-btn" data-plus="' + c.idMenu + '"><i class="bi bi-plus"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('');

    $$('#slipItems [data-minus]').forEach(b => b.onclick = () => ubahQty(b.dataset.minus, -1));
    $$('#slipItems [data-plus]').forEach(b => b.onclick = () => ubahQty(b.dataset.plus, 1));
    $$('#slipItems [data-qty]').forEach(i => {
      i.onchange = () => setQty(i.dataset.qty, i.value);
      i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } };
    });
  }

  $('#slipSummary').innerHTML =
    '<div class="sum-row"><span>Subtotal (' + angka(t.qty) + ' item)</span><b>' + rupiah(t.subtotal) + '</b></div>' +
    '<div class="sum-row discount"><span>Diskon</span>' +
      '<input type="number" class="disc-input" id="inpDiskon" min="0" step="any" value="' + (APP.diskon || 0) + '"></div>' +
    (t.persen > 0
      ? '<div class="sum-row"><span>Pajak / Service (' + t.persen + '%)</span><b>' + rupiah(t.pajak) + '</b></div>'
      : '') +
    '<div class="sum-row"><span>Estimasi HPP</span><b style="color:var(--text-3)">' + rupiah(t.hpp) + '</b></div>' +
    '<div class="sum-total"><span>Total Pembayaran</span><b>' + rupiah(t.total) + '</b></div>';

  const inp = $('#inpDiskon');
  if (inp) {
    inp.onchange = () => {
      APP.diskon = bulatkan(Math.max(0, bacaAngka(inp.value)));
      simpanKeranjang(); renderKeranjang();
    };
  }

  $('#btnBayar').disabled = APP.cart.length === 0;
  $('#slipNoOrder').textContent = APP.cart.length ? '#OTO-DRAFT' : '#OTO-BARU';
  $('#slipTipe').textContent = APP.tipeOrder;

  // FAB (mobile)
  $('#fabCount').textContent = angka(t.qty) + ' Item';
  $('#fabMeja').textContent = APP.tipeOrder + ($('#inpMeja').value ? ' · ' + $('#inpMeja').value : '');
  $('#fabTotal').textContent = rupiah(t.total);
  perbaruiFabVisibility(APP.navAktif);
}

/** Field kontak & jatuh tempo hanya relevan bila metode = Hutang. */
function perbaruiTampilanHutang() {
  const aktif = APP.metodeBayar === 'Hutang';
  const box = $('#hutangFields');
  if (box) box.classList.toggle('d-none', !aktif);

  const tombol = $('#btnBayar');
  if (tombol) {
    const label = tombol.querySelector('span');
    if (label) label.textContent = aktif ? 'Simpan sebagai Hutang' : 'Simpan & Cetak Struk';
    const ikon = tombol.querySelector('i');
    if (ikon) ikon.className = aktif ? 'bi bi-hourglass-split' : 'bi bi-printer';
  }

  const catatan = $('.slip-note');
  if (catatan) {
    catatan.innerHTML = aktif
      ? '<i class="bi bi-exclamation-circle"></i> <span>Stok tetap berkurang · pendapatan diakui saat pelunasan</span>'
      : '<i class="bi bi-check2-square"></i> <span>HPP resep &amp; stok bahan baku berkurang otomatis</span>';
  }
}

function perbaruiFabVisibility(nav) {
  const fab = $('#cartFab');
  if (!fab) return;
  const tampil = nav === 'kasir' && APP.cart.length > 0 && !APP.sheetOpen;
  fab.classList.toggle('d-none', !tampil);
}

function bukaSheet() {
  if (window.innerWidth > 991) return;
  APP.sheetOpen = true;
  $('#posSlip').classList.add('sheet-open');
  let bd = $('.sheet-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.className = 'sheet-backdrop';
    bd.onclick = tutupSheet;
    document.body.appendChild(bd);
  }
  requestAnimationFrame(() => bd.classList.add('show'));
  perbaruiFabVisibility(APP.navAktif);
}

function tutupSheet() {
  APP.sheetOpen = false;
  const slip = $('#posSlip');
  if (slip) slip.classList.remove('sheet-open');
  const bd = $('.sheet-backdrop');
  if (bd) bd.classList.remove('show');
  perbaruiFabVisibility(APP.navAktif);
}

// ════════════════════════════════════════════════════════════
// BAGIAN 8: CHECKOUT & STRUK
// ════════════════════════════════════════════════════════════

async function prosesBayar() {
  if (!APP.cart.length) return;

  const nama = $('#inpPelanggan').value.trim();

  // Hutang wajib punya identitas pelanggan agar bisa ditagih
  if (APP.metodeBayar === 'Hutang' && !nama) {
    toast('Nama pelanggan wajib diisi', 'Pembayaran Hutang harus mencantumkan nama pelanggan agar bisa ditagih.', 'warning');
    if (window.innerWidth <= 991 && !APP.sheetOpen) bukaSheet();
    $('#inpPelanggan').focus();
    return;
  }

  const btn = $('#btnBayar');
  setLoadingBtn(btn, true, 'Menyimpan transaksi…');

  const payload = {
    tipe: APP.tipeOrder,
    namaPelanggan: nama,
    noMeja: $('#inpMeja').value.trim(),
    kontakPelanggan: $('#inpKontak').value.trim(),
    jatuhTempo: $('#inpJatuhTempo').value || '',
    metodeBayar: APP.metodeBayar,
    diskon: APP.diskon,
    catatan: '',
    items: APP.cart.map(c => ({ idMenu: c.idMenu, nama: c.nama, qty: c.qty }))
  };

  try {
    const res = await apiCall('prosesTransaksi', { trx: payload });
    const struk = handleRes(res);

    APP.strukTerakhir = struk;
    kosongkanKeranjang(true);
    tutupSheet();
    tampilkanStruk(struk);
    toast(struk.hutang ? 'Tercatat sebagai hutang' : 'Transaksi berhasil', res.message,
          struk.hutang ? 'warning' : 'success');
    if (struk.hutang) APP.cacheHutang = null;

    // Backend v2.1 mengembalikan stok terbaru bersama struk -> perbarui porsi
    // tersedia & ringkasan shift secara lokal, tanpa 2 permintaan tambahan.
    if (struk.sinkron && struk.sinkron.stok) {
      terapkanStokTerbaru(struk.sinkron.stok);
      tambahRingkasanLokal(struk);
    } else {
      segarkanMasterDiamDiam();   // backend versi lama
      perbaruiRingkasanShift();
    }
    APP.cacheRiwayat = [];
    APP.cacheDashboard = null;
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      toast('Transaksi gagal', err.message, 'danger');
    }
  } finally {
    setLoadingBtn(btn, false);
  }
}

/** Refresh master data tanpa mengganggu pengguna (background sync). */
function segarkanMasterDiamDiam() {
  apiCall('bootstrap').then(res => {
    if (!res || !res.success) return;
    terapkanBootstrap(res.data, true);
    if (res.data.ringkasan) tampilkanRingkasan(res.data.ringkasan);
    if (APP.navAktif === 'kasir') { renderHero(); renderKategori(); renderMenuGrid(); }
    if (APP.navAktif === 'stok')  renderBahan();
    tandaiSinkron();
  }).catch(() => {});
}

/**
 * Pakai stok terbaru dari server (dikirim bersama struk) lalu hitung ulang
 * porsi tersedia tiap menu — rumusnya sama persis dengan hitungHppSemuaMenu di backend.
 */
function terapkanStokTerbaru(stokBaru) {
  APP.bahan.forEach(b => { if (stokBaru[b.id] !== undefined) b.stok = Number(stokBaru[b.id]); });
  hitungPorsiLokal();

  // Simpan juga ke data awal di perangkat agar tampilan seketika berikutnya akurat
  try {
    const x = JSON.parse(lsGet(LS.BOOT, 'null'));
    if (x && x.data) { x.data.bahan = APP.bahan; x.data.menu = APP.menu; lsSet(LS.BOOT, JSON.stringify(x)); }
  } catch (e) {}

  if (APP.navAktif === 'kasir') { renderHero(); renderKategori(); renderMenuGrid(); }
  if (APP.navAktif === 'stok' && typeof renderBahan === 'function') renderBahan();
  tandaiSinkron();
}

/** Porsi tersedia = bahan paling terbatas; menu tanpa resep dianggap selalu ada (999). */
function hitungPorsiLokal() {
  const stok = {};
  APP.bahan.forEach(b => stok[b.id] = Number(b.stok) || 0);
  const porsi = {};
  APP.resep.forEach(r => {
    const jml = Number(r.jumlah) || 0;
    if (jml <= 0) return;
    const mampu = Math.floor((stok[r.idBahan] || 0) / jml);
    if (porsi[r.idMenu] === undefined || mampu < porsi[r.idMenu]) porsi[r.idMenu] = mampu;
  });
  APP.menu.forEach(m => { m.porsiTersedia = (porsi[m.id] === undefined) ? 999 : porsi[m.id]; });
}

let strukModal = null;
function tampilkanStruk(s) {
  if (!strukModal) strukModal = new bootstrap.Modal($('#modalStruk'));
  const c = s.config || APP.config;
  const pakaiLogo = String(c.tampilLogoStruk || 'ya') === 'ya' && c.logoUrl;

  const baris = s.items.map(it =>
    '<div class="s-item">' +
      '<div class="s-item-name">' + esc(it.nama) + '</div>' +
      '<div class="s-row"><span>' + angka(it.qty) + ' x ' + angka(it.harga) + '</span>' +
      '<span>' + angka(it.harga * it.qty) + '</span></div>' +
      (it.catatan ? '<div style="font-size:10px">* ' + esc(it.catatan) + '</div>' : '') +
    '</div>'
  ).join('');

  $('#strukPaper').innerHTML =
    '<div class="s-center">' +
      (pakaiLogo ? '<img src="' + esc(c.logoUrl) + '" class="s-logo" onerror="this.remove()">' : '') +
      '<div class="s-title">' + esc(c.strukHeader || c.namaCafe || 'OTOCAFE') + '</div>' +
      '<div class="s-sub">' + esc(c.alamat || '') + '<br>' + esc(c.telepon || '') + '</div>' +
    '</div>' +
    '<div class="s-line"></div>' +
    '<div class="s-row"><span>No. Struk</span><span>' + esc(s.noStruk) + '</span></div>' +
    '<div class="s-row"><span>Tanggal</span><span>' + esc(s.tanggal) + '</span></div>' +
    '<div class="s-row"><span>Kasir</span><span>' + esc(s.kasir) + '</span></div>' +
    '<div class="s-row"><span>Tipe</span><span>' + esc(s.tipe) + (s.noMeja ? ' / ' + esc(s.noMeja) : '') + '</span></div>' +
    (s.namaPelanggan ? '<div class="s-row"><span>Pelanggan</span><span>' + esc(s.namaPelanggan) + '</span></div>' : '') +
    '<div class="s-line"></div>' +
    baris +
    '<div class="s-line"></div>' +
    '<div class="s-row"><span>Subtotal</span><span>' + angka(s.subtotal) + '</span></div>' +
    (s.diskon > 0 ? '<div class="s-row"><span>Diskon</span><span>-' + angka(s.diskon) + '</span></div>' : '') +
    (s.pajak > 0 ? '<div class="s-row"><span>Pajak ' + s.pajakPersen + '%</span><span>' + angka(s.pajak) + '</span></div>' : '') +
    '<div class="s-row s-total"><span>TOTAL</span><span>' + angka(s.total) + '</span></div>' +
    '<div class="s-row"><span>Bayar via</span><span>' + esc(s.metodeBayar) + '</span></div>' +
    (s.metodeBayar === 'Hutang'
      ? '<div class="s-line"></div><div class="s-center"><b>** BELUM LUNAS / HUTANG **</b></div>' +
        '<div class="s-row"><span>Atas nama</span><span>' + esc(s.namaPelanggan || '-') + '</span></div>' +
        '<div class="s-row"><span>Sisa hutang</span><span>' + angka(s.total) + '</span></div>'
      : '') +
    '<div class="s-line"></div>' +
    '<div class="s-center s-foot">' + esc(c.strukFooter || 'Terima kasih atas kunjungan Anda!') + '</div>';

  strukModal.show();
}

function strukKeTeks(s) {
  const c = s.config || APP.config;
  let t = '*' + (c.strukHeader || c.namaCafe || 'OTOCAFE') + '*\n';
  t += (c.alamat || '') + '\n\n';
  t += 'No. Struk : ' + s.noStruk + '\n';
  t += 'Tanggal   : ' + s.tanggal + '\n';
  t += 'Kasir     : ' + s.kasir + '\n';
  t += '--------------------------------\n';
  s.items.forEach(it => { t += it.nama + '\n  ' + angka(it.qty) + ' x ' + angka(it.harga) + ' = ' + angka(it.harga * it.qty) + '\n'; });
  t += '--------------------------------\n';
  t += 'Subtotal : ' + rupiah(s.subtotal) + '\n';
  if (s.diskon > 0) t += 'Diskon   : -' + rupiah(s.diskon) + '\n';
  if (s.pajak  > 0) t += 'Pajak    : ' + rupiah(s.pajak) + '\n';
  t += '*TOTAL    : ' + rupiah(s.total) + '*\n';
  t += 'Bayar via: ' + s.metodeBayar + '\n\n';
  t += (c.strukFooter || 'Terima kasih atas kunjungan Anda!');
  return t;
}

// ════════════════════════════════════════════════════════════
// BAGIAN 9: RIWAYAT TRANSAKSI
// ════════════════════════════════════════════════════════════

async function muatRiwayat(paksa) {
  const wrap = $('#riwayatList');
  const isAdmin = APP.user.role !== 'kasir';

  $('#riwayatScope').textContent = isAdmin
    ? 'Seluruh transaksi cafe · dapat difilter per tanggal'
    : 'Hanya transaksi hari ini milik Anda';

  if ($('#riwayatTools').childElementCount === 0 && isAdmin) {
    $('#riwayatTools').innerHTML =
      '<input type="date" id="trxDari" class="date-input">' +
      '<span class="text-muted-2">s/d</span>' +
      '<input type="date" id="trxSampai" class="date-input">' +
      '<button class="btn-ghost btn-sm-ember" id="btnFilterTrx"><i class="bi bi-funnel"></i> Filter</button>' +
      '<button class="btn-ghost btn-sm-ember" id="btnExportTrx"><i class="bi bi-download"></i> CSV</button>';
    $('#trxDari').value = todayIso();
    $('#trxSampai').value = todayIso();
    $('#btnFilterTrx').onclick = () => muatRiwayat(true);
    $('#btnExportTrx').onclick = exportRiwayatCsv;
  }

  if (APP.cacheRiwayat.length && !paksa) return renderRiwayat(APP.cacheRiwayat);

  skeleton(wrap, 5);
  try {
    const filter = isAdmin ? { dari: $('#trxDari') ? $('#trxDari').value : '', sampai: $('#trxSampai') ? $('#trxSampai').value : '' } : {};
    const res = await apiCall('getTransaksi', { filter: filter });
    APP.cacheRiwayat = handleRes(res);
    renderRiwayat(APP.cacheRiwayat);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      wrap.innerHTML = emptyState('bi-exclamation-triangle', 'Gagal memuat', err.message);
    }
  }
}

function renderRiwayat(data) {
  const wrap = $('#riwayatList');

  const omzet = data.reduce((s, t) => s + t.total, 0);
  const hpp   = data.reduce((s, t) => s + t.hpp, 0);
  const item  = bulatkan(data.reduce((s, t) => s + t.items.reduce((a, i) => a + Number(i.qty || 0), 0), 0), 3);

  $('#riwayatSummary').innerHTML =
    kpiCard('Total Omzet', rupiah(omzet), 'bi-cash-coin', 'secondary') +
    kpiCard('Jumlah Struk', data.length, 'bi-receipt', 'primary') +
    kpiCard('Porsi Terjual', angka(item), 'bi-cup-hot', 'tertiary') +
    kpiCard('Laba Kotor', rupiah(omzet - hpp), 'bi-graph-up-arrow', 'tertiary');

  if (!data.length) {
    wrap.innerHTML = emptyState('bi-receipt', 'Belum ada transaksi', 'Transaksi akan muncul di sini setelah pembayaran diproses.');
    return;
  }

  const isAdmin = APP.user.role === 'admin';
  wrap.innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>No. Struk</th><th>Waktu</th><th>Kasir</th><th>Item</th>' +
      '<th class="td-num">Total</th><th class="td-num">Laba</th><th>Bayar</th><th class="td-act">Aksi</th>' +
    '</tr></thead><tbody>' +
    data.map(t => {
      const ringkas = t.items.map(i => angka(i.qty) + '× ' + i.nama).join(', ');
      return '<tr>' +
        '<td class="td-main">' + esc(t.noStruk) + '<div class="menu-cat">' + esc(t.tipe) + (t.noMeja ? ' · ' + esc(t.noMeja) : '') + '</div></td>' +
        '<td>' + esc(t.tanggal) + '</td>' +
        '<td>' + esc(t.kasir) + '</td>' +
        '<td style="max-width:260px"><div class="menu-recipe" style="min-height:auto">' + esc(ringkas) + '</div></td>' +
        '<td class="td-num td-main">' + rupiah(t.total) + '</td>' +
        '<td class="td-num" style="color:var(--tertiary)">' + rupiah(t.total - t.hpp) + '</td>' +
        '<td><span class="badge-oto ' + (t.metodeBayar === 'Hutang' ? 'badge-telat' : 'badge-menipis') + '">' +
          esc(t.metodeBayar) + '</span></td>' +
        '<td class="td-act">' +
          '<button class="act-btn" data-struk="' + t.id + '" title="Lihat struk"><i class="bi bi-receipt"></i></button>' +
          (isAdmin ? '<button class="act-btn act-danger" data-batal="' + t.id + '" title="Batalkan"><i class="bi bi-x-circle"></i></button>' : '') +
        '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';

  $$('#riwayatList [data-struk]').forEach(b => b.onclick = () => {
    const t = data.find(x => x.id === b.dataset.struk);
    if (!t) return;
    APP.strukTerakhir = {
      noStruk: t.noStruk, tanggal: t.tanggal, kasir: t.kasir, tipe: t.tipe,
      namaPelanggan: t.namaPelanggan, noMeja: t.noMeja, items: t.items,
      subtotal: t.subtotal, diskon: t.diskon, pajak: t.pajak,
      pajakPersen: Number(APP.config.pajakPersen) || 0,
      total: t.total, metodeBayar: t.metodeBayar, config: APP.config
    };
    tampilkanStruk(APP.strukTerakhir);
  });

  $$('#riwayatList [data-batal]').forEach(b => b.onclick = () => {
    const t = data.find(x => x.id === b.dataset.batal);
    konfirmasi('Batalkan Transaksi', 'Struk ' + t.noStruk + ' akan dihapus dan stok bahan baku dikembalikan. Tindakan ini tidak dapat dibatalkan.', async () => {
      try {
        const res = await apiCall('batalkanTransaksi', { id: t.id });
        handleRes(res);
        toast('Berhasil', res.message, 'success');
        APP.cacheRiwayat = []; APP.cacheDashboard = null;
        muatRiwayat(true);
        segarkanMasterDiamDiam();
        perbaruiRingkasanShift();
      } catch (err) {
        if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
      }
    }, 'Ya, Batalkan');
  });
}

function exportRiwayatCsv() {
  const data = APP.cacheRiwayat;
  if (!data.length) return toast('Tidak ada data', 'Belum ada transaksi untuk diekspor.', 'warning');
  const head = ['No Struk', 'Tanggal', 'Kasir', 'Tipe', 'Meja', 'Item', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'HPP', 'Laba', 'Metode'];
  const rows = data.map(t => [
    t.noStruk, t.tanggal, t.kasir, t.tipe, t.noMeja,
    t.items.map(i => i.qty + 'x ' + i.nama).join(' | '),
    t.subtotal, t.diskon, t.pajak, t.total, t.hpp, t.total - t.hpp, t.metodeBayar
  ]);
  unduhCsv('transaksi-otocafe-' + todayIso() + '.csv', head, rows);
}

function unduhCsv(namaFile, head, rows) {
  const csv = [head].concat(rows)
    .map(r => r.map(c => '"' + String(c === null || c === undefined ? '' : c).replace(/"/g, '""') + '"').join(';'))
    .join('\n');
  try {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = namaFile;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
    toast('Berhasil', 'File ' + namaFile + ' diunduh.', 'success');
  } catch (e) {
    toast('Gagal mengunduh', 'Browser memblokir unduhan. Coba buka aplikasi di tab baru.', 'danger');
  }
}

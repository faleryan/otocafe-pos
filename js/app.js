/**
 * ============================================================
 * OTOCAFE POS — app.js — navigasi SPA, ringkasan shift, pemasangan event
 * ============================================================
 * Dimuat terakhir. Mengatur perpindahan halaman tanpa reload dan
 * menghubungkan seluruh tombol ke fungsinya.
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 5: NAVIGASI SPA (0ms — tanpa panggilan server)
// ════════════════════════════════════════════════════════════

function bangunNavigasi() {
  const role = APP.user.role;

  // Rail (desktop)
  $$('#railNav .rail-btn').forEach(btn => {
    const nav = btn.dataset.nav;
    const boleh = (NAV_ACCESS[nav] || []).indexOf(role) !== -1;
    btn.classList.toggle('hidden-role', !boleh);
    btn.onclick = () => navigateTo(nav);
  });

  // Bottom nav (mobile) — maksimal 5 menu terpenting
  const urutan = ['kasir', 'riwayat', 'hutang', 'menu', 'stok', 'pengeluaran', 'laporan', 'pengguna', 'pengaturan'];
  const tersedia = urutan.filter(n => (NAV_ACCESS[n] || []).indexOf(role) !== -1);
  const utama = tersedia.slice(0, 4);
  const sisa  = tersedia.slice(4);

  let html = utama.map(n =>
    '<button class="bn-btn" data-nav="' + n + '"><i class="bi ' + NAV_ICON[n] + '"></i><span>' + NAV_SHORT[n] + '</span></button>'
  ).join('');

  if (sisa.length) {
    html += '<button class="bn-btn" data-nav="__more"><i class="bi bi-three-dots"></i><span>Lainnya</span></button>';
  }
  const bn = $('#bottomNav');
  bn.innerHTML = html;
  $$('.bn-btn', bn).forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.nav === '__more') return tampilkanMenuLainnya(sisa);
      navigateTo(btn.dataset.nav);
    };
  });
  bn.dataset.sisa = JSON.stringify(sisa);
}

function tampilkanMenuLainnya(sisa) {
  const body = sisa.map(n =>
    '<button class="btn-ghost w-100 mb-2" data-go="' + n + '"><i class="bi ' + NAV_ICON[n] + '"></i> ' + NAV_LABEL[n] + '</button>'
  ).join('');
  $('#previewTitle').textContent = 'Menu Lainnya';
  $('#previewBody').innerHTML = '<div class="text-start">' + body + '</div>';
  $('#previewDownload').classList.add('d-none');
  const m = new bootstrap.Modal($('#modalPreview'));
  m.show();
  $$('#previewBody [data-go]').forEach(b => b.onclick = () => { m.hide(); navigateTo(b.dataset.go); });
}

/**
 * SATU-SATUNYA cara berpindah halaman.
 * Tidak ada window.location, tidak ada ?page=, URL tidak pernah berubah.
 */
function navigateTo(nav) {
  if (!APP.user) return;
  if ((NAV_ACCESS[nav] || []).indexOf(APP.user.role) === -1) {
    toast('Akses ditolak', 'Peran "' + APP.user.role + '" tidak memiliki akses ke halaman ini.', 'warning');
    return;
  }

  // Tampilkan section target, sembunyikan sisanya (instan)
  $$('.section').forEach(s => s.classList.toggle('active', s.id === 'section-' + nav));
  $$('#railNav .rail-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === nav));
  $$('#bottomNav .bn-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === nav));

  $('#topPageLabel').textContent = NAV_LABEL[nav] || '';
  $('#topbarSearchWrap').style.display = (nav === 'kasir') ? '' : 'none';
  tutupSheet();
  perbaruiFabVisibility(nav);
  window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });

  APP.navAktif = nav;

  // Muat data khusus halaman (hanya bila belum ada di cache lokal)
  if (nav === 'riwayat')      muatRiwayat();
  if (nav === 'hutang')       muatHutang();
  if (nav === 'menu')         renderMenuAdmin();
  if (nav === 'stok')         renderBahan();
  if (nav === 'pengeluaran')  muatPengeluaran();
  if (nav === 'laporan')      muatDashboard();
  if (nav === 'pengguna')     muatPengguna();
  if (nav === 'pengaturan')   isiFormPengaturan();
}

// ════════════════════════════════════════════════════════════
// BAGIAN 16: RINGKASAN SHIFT & JAM
// ════════════════════════════════════════════════════════════

/** Ambil ringkasan shift dari server (dipakai bila data lokal perlu diselaraskan). */
function perbaruiRingkasanShift() {
  apiCall('getRingkasanKasir').then(res => {
    if (!res || !res.success) return;
    tampilkanRingkasan(res.data);
  }).catch(() => {});
}

/** Tulis ringkasan shift ke pil di topbar. */
function tampilkanRingkasan(d) {
  if (!d) return;
  APP.ringkasan = d;
  $('#shiftOmzet').textContent = rupiah(d.kasMasuk !== undefined ? d.kasMasuk : d.omzet);
  $('#shiftTrx').textContent = d.jmlTrx + ' struk · ' + angka(d.jmlItem) + ' porsi' +
    (d.hutangBaru > 0 ? ' · hutang ' + rupiah(d.hutangBaru) : '');
  const pill = $('#shiftPill');
  if (pill) pill.title = 'Kas masuk hari ini' +
    (d.hutangBaru > 0 ? ' (omzet ' + rupiah(d.omzet) + ', ' + rupiah(d.hutangBaru) + ' berupa hutang)' : '');
}

/**
 * Perbarui ringkasan shift secara lokal setelah transaksi berhasil — tanpa
 * menunggu server. Angkanya dihitung dari struk yang baru saja dikonfirmasi
 * server, jadi tetap akurat; penyelarasan penuh terjadi saat data awal dimuat ulang.
 */
function tambahRingkasanLokal(struk) {
  const d = Object.assign({ omzet: 0, jmlTrx: 0, jmlItem: 0, hutangBaru: 0, pelunasan: 0, kasMasuk: 0 },
                          APP.ringkasan || {});
  const total = Number(struk.total) || 0;
  const porsi = (struk.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0);
  d.omzet    = bulatkan(d.omzet + total);
  d.jmlTrx   = d.jmlTrx + 1;
  d.jmlItem  = bulatkan(d.jmlItem + porsi, 3);
  if (struk.metodeBayar === 'Hutang') d.hutangBaru = bulatkan(d.hutangBaru + total);
  d.kasMasuk = bulatkan(d.omzet - d.hutangBaru + (d.pelunasan || 0));
  d.rataStruk = d.jmlTrx ? bulatkan(d.omzet / d.jmlTrx) : 0;
  tampilkanRingkasan(d);
}

function mulaiJam() {
  const tick = () => {
    const d = new Date();
    const el = $('#clockNow');
    if (el) el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  tick();
  setInterval(tick, 20000);
}

function tandaiSinkron() {
  const el = $('#lastSync');
  if (el) el.textContent = 'baru saja';
  clearTimeout(tandaiSinkron._t);
  let detik = 0;
  clearInterval(tandaiSinkron._i);
  tandaiSinkron._i = setInterval(() => {
    detik += 15;
    if (!el) return;
    el.textContent = detik < 60 ? detik + ' dtk lalu' : Math.floor(detik / 60) + ' mnt lalu';
  }, 15000);
}

// ════════════════════════════════════════════════════════════
// BAGIAN 17: EVENT BINDING GLOBAL
// ════════════════════════════════════════════════════════════

function pasangEventGlobal() {
  pasangLoginForm();

  // Tema & logout
  $('#btnTheme').onclick = toggleTema;
  $('#btnThemeMobile').onclick = toggleTema;
  $('#btnLogout').onclick = logout;

  // Pencarian menu — debounce, difilter LOKAL tanpa panggilan server
  $('#globalSearch').addEventListener('input', debounce((e) => {
    APP.cariMenu = e.target.value;
    renderMenuGrid();
  }, 180));

  // Keranjang
  $('#btnClearCart').onclick = () => kosongkanKeranjang();
  $('#btnBayar').onclick = prosesBayar;
  $('#cartFab').onclick = bukaSheet;

  $$('#tipeToggle .type-btn').forEach(b => b.onclick = () => {
    APP.tipeOrder = b.dataset.tipe;
    $$('#tipeToggle .type-btn').forEach(x => x.classList.toggle('active', x === b));
    simpanKeranjang(); renderKeranjang();
  });

  $$('#payGrid .pay-btn').forEach(b => b.onclick = () => {
    APP.metodeBayar = b.dataset.pay;
    $$('#payGrid .pay-btn').forEach(x => x.classList.toggle('active', x === b));
    perbaruiTampilanHutang();
    simpanKeranjang();
    if (APP.metodeBayar === 'Hutang' && !$('#inpPelanggan').value.trim()) {
      toast('Isi nama pelanggan', 'Hutang perlu nama pelanggan agar bisa ditagih nanti.', 'info');
      $('#inpPelanggan').focus();
    }
  });

  $('#inpPelanggan').addEventListener('input', debounce(simpanKeranjang, 400));
  $('#inpMeja').addEventListener('input', debounce(() => { simpanKeranjang(); renderKeranjang(); }, 400));
  $('#inpKontak').addEventListener('input', debounce(simpanKeranjang, 400));
  $('#inpJatuhTempo').addEventListener('change', simpanKeranjang);

  // ── Daftar Hutang ──
  $$('#hutangFilterRail .chip-filter').forEach(b => b.onclick = () => {
    APP.hutangFilter = b.dataset.status;
    $$('#hutangFilterRail .chip-filter').forEach(x => x.classList.toggle('active', x === b));
    muatHutang(true);
  });
  $('#searchHutang').addEventListener('input', debounce((e) => {
    APP.cariHutang = e.target.value.trim();
    muatHutang(true);
  }, 320));
  $('#btnExportHutang').onclick = exportHutangCsv;
  $('#btnSimpanBayarHutang').onclick = simpanBayarHutangHandler;
  $$('#bayarMetodeGrid .pay-btn').forEach(b => b.onclick = () => {
    metodePelunasan = b.dataset.pay;
    $$('#bayarMetodeGrid .pay-btn').forEach(x => x.classList.toggle('active', x === b));
  });

  // Struk
  // Cetak langsung ke printer Bluetooth bila sudah diatur; bila belum, dialog cetak biasa
  $('#btnStrukPrint').onclick  = () => cetakStruk(APP.strukTerakhir);
  $('#btnStrukDialog').onclick = () => window.print();
  pasangPanelPrinter();
  $('#btnStrukWa').onclick = () => {
    if (!APP.strukTerakhir) return;
    const teks = encodeURIComponent(strukKeTeks(APP.strukTerakhir));
    window.open('https://wa.me/?text=' + teks, '_blank');
  };

  // Menu admin
  $('#btnTambahMenu').onclick = () => bukaFormMenu(null);
  $('#btnSimpanMenu').onclick = simpanMenuHandler;
  $('#btnTambahResep').onclick = () => tambahBarisResep();
  $('#menuHarga').addEventListener('input', debounce(hitungHppForm, 160));
  $('#menuFoto').addEventListener('input', debounce(perbaruiPreviewFoto, 350));
  $('#btnPilihFoto').onclick = () => $('#menuFotoFile').click();
  $('#btnHapusFoto').onclick = () => { $('#menuFoto').value = ''; perbaruiPreviewFoto(); };
  $('#menuFotoFile').onchange = (e) => {
    unggahGambar(e.target.files[0], 'menuFoto', perbaruiPreviewFoto, 'menuFotoPreview', 'Foto menu');
    e.target.value = '';
  };
  $('#searchMenuAdmin').addEventListener('input', debounce(renderMenuAdmin, 180));

  // Stok
  $('#btnTambahBahan').onclick = () => bukaFormBahan(null);
  $('#btnSimpanBahan').onclick = simpanBahanHandler;
  $('#btnSimpanMutasi').onclick = simpanMutasiHandler;
  $('#btnRiwayatStok').onclick = bukaRiwayatStok;
  $('#searchBahan').addEventListener('input', debounce(renderBahan, 180));
  $$('#mutasiTipeToggle .type-btn').forEach(b => b.onclick = () => {
    $$('#mutasiTipeToggle .type-btn').forEach(x => x.classList.toggle('active', x === b));
    $('#mutasiKeluarWrap').style.display = b.dataset.tipe === 'Masuk' ? '' : 'none';
  });

  // Pengeluaran
  $('#btnTambahKeluar').onclick = () => bukaFormKeluar(null);
  $('#btnSimpanKeluar').onclick = simpanKeluarHandler;
  $('#keluarDari').onchange = () => muatPengeluaran(true);
  $('#keluarSampai').onchange = () => muatPengeluaran(true);

  // Laporan
  $$('#periodeRail .chip-filter').forEach(b => b.onclick = () => {
    periodeAktif = b.dataset.periode;
    bulanAktif = '';
    $('#pilihBulan').value = '';
    $('.bulan-picker').classList.remove('aktif');
    $$('#periodeRail .chip-filter').forEach(x => x.classList.toggle('active', x === b));
    muatDashboard(true);
  });

  // Riwayat bulan tertentu — mis. melihat kembali bulan lalu
  $('#pilihBulan').onchange = (e) => {
    const nilai = e.target.value;
    if (!nilai) {
      periodeAktif = '7hari'; bulanAktif = '';
      $$('#periodeRail .chip-filter').forEach(x => x.classList.toggle('active', x.dataset.periode === '7hari'));
    } else {
      periodeAktif = 'bulan'; bulanAktif = nilai;
      $$('#periodeRail .chip-filter').forEach(x => x.classList.remove('active'));
    }
    $('.bulan-picker').classList.toggle('aktif', !!nilai);
    muatDashboard(true);
  };
  $('#btnUnduhLaporan').onclick = exportLaporanCsv;

  // Pengguna
  $('#btnTambahUser').onclick = () => bukaFormUser(null);
  $('#btnSimpanUser').onclick = simpanUserHandler;

  // Pengaturan
  $('#btnPilihLogo').onclick = () => $('#logoFile').click();
  $('#btnHapusLogo').onclick = () => {
    $('#setLogo').value = '';
    perbaruiPreviewLogo();
    toast('Logo dihapus', 'Klik "Simpan Pengaturan" untuk menerapkan perubahan.', 'info');
  };
  $('#logoFile').onchange = (e) => {
    unggahGambar(e.target.files[0], 'setLogo', perbaruiPreviewLogo, 'logoPreview', 'Logo cafe');
    e.target.value = '';
  };

  $('#formPengaturan').addEventListener('submit', simpanPengaturanHandler);
  $('#formStruk').addEventListener('submit', simpanPengaturanHandler);
  $('#formPassword').addEventListener('submit', gantiPasswordHandler);
  $('#btnPreviewStruk').onclick = previewStrukContoh;

  // Kembalikan tombol unduh pratinjau setelah dipakai untuk "Menu Lainnya"
  $('#modalPreview').addEventListener('hidden.bs.modal', () => {
    $('#previewDownload').classList.remove('d-none');
  });

  // Pintasan keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); $('#globalSearch').focus(); $('#globalSearch').select(); }
    if (e.key === 'Escape' && APP.sheetOpen) tutupSheet();
  });

  // Tutup bottom-sheet saat layar dilebarkan ke desktop
  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth > 991 && APP.sheetOpen) tutupSheet();
    perbaruiFabVisibility(APP.navAktif);
  }, 200));
}


// ════════════════════════════════════════════════════════════
// BAGIAN 18: EKSPOR KE GLOBAL
// ════════════════════════════════════════════════════════════
// Beberapa fungsi dipanggil dari atribut onclick pada HTML yang
// dibangun secara dinamis, sehingga harus tersedia di window.
window.tambahKeKeranjang = tambahKeKeranjang;
window.navigateTo        = navigateTo;

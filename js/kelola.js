/**
 * ============================================================
 * OTOCAFE POS — kelola.js — menu, stok, pengeluaran, pengguna, pengaturan
 * ============================================================
 * Seluruh modul administratif. Sebagian besar hanya dapat diakses
 * peran Admin (dibatasi juga di sisi server).
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 10: KELOLA MENU & RESEP (Admin)
// ════════════════════════════════════════════════════════════

let menuModal = null;

function renderMenuAdmin() {
  const q = ($('#searchMenuAdmin').value || '').toLowerCase().trim();
  const list = APP.menu.filter(m => !q || m.nama.toLowerCase().indexOf(q) !== -1 || m.kategori.toLowerCase().indexOf(q) !== -1);
  const wrap = $('#menuAdminList');

  // Isi datalist kategori untuk form
  $('#listKategori').innerHTML = APP.kategori.map(k => '<option value="' + esc(k) + '">').join('');

  if (!list.length) {
    wrap.innerHTML = emptyState('bi-cup-straw', 'Belum ada menu', 'Klik "Menu Baru" untuk menambahkan menu pertama.');
    return;
  }

  wrap.innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th style="width:60px"></th><th>Menu</th><th>Kategori</th>' +
      '<th class="td-num">Harga</th><th class="td-num">HPP</th><th class="td-num">Margin</th>' +
      '<th class="td-num">Porsi</th><th>Status</th><th class="td-act">Aksi</th>' +
    '</tr></thead><tbody>' +
    list.map(m => {
      const margin = m.harga > 0 ? ((m.harga - m.hpp) / m.harga * 100) : 0;
      const kelas = margin >= 50 ? 'delta-up' : (margin >= 25 ? 'delta-flat' : 'delta-down');
      const st = statusStok(m.porsiTersedia);
      return '<tr>' +
        '<td><div class="row-thumb">' +
          (m.foto ? '<img src="' + esc(m.foto) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.remove()">'
                  : '<i class="bi bi-cup-hot"></i>') + '</div></td>' +
        '<td class="td-main">' + esc(m.nama) + (m.badge ? ' <span class="badge-oto badge-menipis">' + esc(m.badge) + '</span>' : '') + '</td>' +
        '<td>' + esc(m.kategori) + '</td>' +
        '<td class="td-num td-main">' + rupiah(m.harga) + '</td>' +
        '<td class="td-num">' + rupiah(m.hpp) + '</td>' +
        '<td class="td-num ' + kelas + '">' + margin.toFixed(0) + '%</td>' +
        '<td class="td-num"><span class="badge-oto ' + st.cls + '">' + (m.porsiTersedia >= 999 ? '∞' : m.porsiTersedia) + '</span></td>' +
        '<td>' + (m.aktif ? '<span class="badge-oto badge-aman">Aktif</span>' : '<span class="badge-oto badge-habis">Nonaktif</span>') + '</td>' +
        '<td class="td-act">' +
          '<button class="act-btn" data-edit="' + m.id + '" title="Ubah"><i class="bi bi-pencil"></i></button>' +
          '<button class="act-btn" data-toggle="' + m.id + '" title="' + (m.aktif ? 'Nonaktifkan' : 'Aktifkan') + '">' +
            '<i class="bi ' + (m.aktif ? 'bi-toggle-on' : 'bi-toggle-off') + '"></i></button>' +
          '<button class="act-btn act-danger" data-hapus="' + m.id + '" title="Hapus"><i class="bi bi-trash3"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';

  $$('#menuAdminList [data-edit]').forEach(b => b.onclick = () => bukaFormMenu(b.dataset.edit));
  $$('#menuAdminList [data-toggle]').forEach(b => b.onclick = async () => {
    const m = APP.menu.find(x => x.id === b.dataset.toggle);
    try {
      const res = await apiCall('toggleStatusMenu', { id: m.id, aktif: !m.aktif });
      handleRes(res);
      m.aktif = !m.aktif;
      toast('Berhasil', res.message, 'success');
      renderMenuAdmin(); renderKasir();
    } catch (err) { if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger'); }
  });
  $$('#menuAdminList [data-hapus]').forEach(b => b.onclick = () => {
    const m = APP.menu.find(x => x.id === b.dataset.hapus);
    konfirmasi('Hapus Menu', 'Menu "' + m.nama + '" beserta resepnya akan dihapus permanen. Transaksi lama tidak terpengaruh.', async () => {
      try {
        const res = await apiCall('hapusMenu', { id: m.id });
        handleRes(res);
        toast('Berhasil', res.message, 'success');
        await segarkanMaster();
        renderMenuAdmin();
      } catch (err) { if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger'); }
    }, 'Ya, Hapus');
  });
}

function bukaFormMenu(id) {
  if (!menuModal) menuModal = new bootstrap.Modal($('#modalMenu'));
  const m = id ? APP.menu.find(x => x.id === id) : null;

  $('#modalMenuTitle').textContent = m ? 'Ubah Menu' : 'Menu Baru';
  $('#menuId').value       = m ? m.id : '';
  $('#menuNama').value     = m ? m.nama : '';
  $('#menuKategori').value = m ? m.kategori : '';
  $('#menuHarga').value    = m ? m.harga : '';
  $('#menuBadge').value    = m ? m.badge : '';
  $('#menuFoto').value     = m ? m.foto : '';
  $('#menuAktif').checked  = m ? m.aktif : true;
  perbaruiPreviewFoto();

  const daftar = m ? APP.resep.filter(r => r.idMenu === m.id) : [];
  $('#resepRows').innerHTML = '';
  if (daftar.length) daftar.forEach(r => tambahBarisResep(r.idBahan, r.jumlah));
  else tambahBarisResep();

  hitungHppForm();
  menuModal.show();
}

function tambahBarisResep(idBahan, jumlah) {
  const row = document.createElement('div');
  row.className = 'resep-row';
  row.innerHTML =
    '<select class="r-bahan">' +
      '<option value="">— Pilih bahan baku —</option>' +
      APP.bahan.map(b => '<option value="' + b.id + '"' + (b.id === idBahan ? ' selected' : '') + '>' +
        esc(b.nama) + ' (' + esc(b.satuan) + ' · ' + rupiah(b.harga) + ')</option>').join('') +
    '</select>' +
    '<input type="number" class="r-jumlah" min="0" step="0.1" placeholder="Jumlah" value="' + (jumlah !== undefined ? jumlah : '') + '">' +
    '<button type="button" class="act-btn act-danger r-del"><i class="bi bi-x-lg"></i></button>';
  $('#resepRows').appendChild(row);

  $('.r-del', row).onclick = () => { row.remove(); hitungHppForm(); };
  $('.r-bahan', row).onchange = hitungHppForm;
  $('.r-jumlah', row).oninput = debounce(hitungHppForm, 160);
}

function bacaResepForm() {
  return $$('#resepRows .resep-row').map(row => ({
    idBahan: $('.r-bahan', row).value,
    jumlah: bacaAngka($('.r-jumlah', row).value)
  })).filter(r => r.idBahan && r.jumlah > 0);
}

function hitungHppForm() {
  const harga = bacaAngka($('#menuHarga').value);
  const items = bacaResepForm();
  const hpp = items.reduce((s, r) => {
    const b = APP.bahan.find(x => x.id === r.idBahan);
    return s + (b ? b.harga * r.jumlah : 0);
  }, 0);
  const margin = harga > 0 ? ((harga - hpp) / harga * 100) : 0;
  const kelas = margin >= 50 ? 'delta-up' : (margin >= 25 ? 'delta-flat' : 'delta-down');

  $('#hppPreview').innerHTML = items.length
    ? 'HPP otomatis dari ' + items.length + ' bahan: <span class="hpp-num">' + rupiah(hpp) + '</span>' +
      (harga > 0 ? ' · Laba per porsi <b>' + rupiah(harga - hpp) + '</b> · Margin <span class="hpp-margin ' + kelas + '">' + margin.toFixed(1) + '%</span>' : '')
    : 'Belum ada bahan pada resep — HPP menu ini akan dihitung sebagai Rp 0.';
}

function perbaruiPreviewFoto() {
  const url = $('#menuFoto').value.trim();
  $('#menuFotoPreview').innerHTML = url
    ? '<img src="' + esc(url) + '" alt="" onerror="this.parentNode.innerHTML=\'<i class=&quot;bi bi-image&quot;></i>\'">'
    : '<i class="bi bi-image"></i>';
}

async function simpanMenuHandler() {
  const form = $('#formMenu');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = $('#btnSimpanMenu');
  setLoadingBtn(btn, true, 'Menyimpan…');
  try {
    const obj = {
      id: $('#menuId').value || '',
      nama: $('#menuNama').value.trim(),
      kategori: $('#menuKategori').value.trim(),
      harga: bacaAngka($('#menuHarga').value),
      badge: $('#menuBadge').value.trim(),
      foto: $('#menuFoto').value.trim(),
      aktif: $('#menuAktif').checked
    };
    const res = await apiCall('simpanMenu', { menu: obj, resep: bacaResepForm() });
    handleRes(res);
    menuModal.hide();
    toast('Berhasil', res.message, 'success');
    await segarkanMaster();
    renderMenuAdmin();
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally {
    setLoadingBtn(btn, false);
  }
}

/**
 * Unggah gambar ke Google Drive (base64 -> backend).
 * Dipakai untuk foto menu dan logo cafe — cukup satu fungsi.
 *
 * @param {File} file        berkas gambar dari input
 * @param {string} inputId   id input (tersembunyi/terlihat) penampung URL hasil
 * @param {function} render  fungsi yang menggambar ulang pratinjau
 * @param {string} previewId id elemen pratinjau (untuk indikator memuat)
 * @param {string} label     nama yang muncul pada notifikasi
 */
function unggahGambar(file, inputId, render, previewId, label) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast('File terlalu besar', 'Ukuran maksimal 5 MB.', 'warning');
  if (!/^image\//.test(file.type)) return toast('Format tidak didukung', 'Pilih file gambar (JPG/PNG/WebP).', 'warning');

  const box = $('#' + previewId);
  if (box) box.innerHTML = '<div class="spin-ring" style="width:24px;height:24px;border-width:2px;margin:0"></div>';

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64 = reader.result.split(',')[1];
      const res = await apiCall('uploadFile', { base64: base64, nama: file.name, mime: file.type });
      const data = handleRes(res);
      $('#' + inputId).value = data.url;
      render();
      toast('Berhasil', label + ' berhasil diunggah ke Google Drive.', 'success');
    } catch (err) {
      render();
      if (err.message !== 'SESSION_EXPIRED') toast('Gagal unggah', err.message, 'danger');
    }
  };
  reader.onerror = () => { render(); toast('Gagal', 'File tidak dapat dibaca.', 'danger'); };
  reader.readAsDataURL(file);
}

/** Pratinjau logo cafe pada halaman Pengaturan. */
function perbaruiPreviewLogo() {
  const url = ($('#setLogo').value || '').trim();
  $('#logoPreview').innerHTML = url
    ? '<img src="' + esc(url) + '" alt="Logo cafe" onerror="this.parentNode.innerHTML=\'<i class=&quot;bi bi-image&quot;></i>\'">'
    : '<i class="bi bi-image"></i>';
}

/** Ambil ulang master data dari server dan render ulang bagian terkait. */
async function segarkanMaster() {
  try {
    await muatBootstrap();
    renderKasir();
    tandaiSinkron();
  } catch (e) {}
}

// ════════════════════════════════════════════════════════════
// BAGIAN 11: STOK & BAHAN BAKU (Admin)
// ════════════════════════════════════════════════════════════

let bahanModal = null, mutasiModal = null, riwayatStokModal = null;

function renderBahan() {
  const q = ($('#searchBahan').value || '').toLowerCase().trim();
  const list = APP.bahan.filter(b => !q || b.nama.toLowerCase().indexOf(q) !== -1);
  const kritis = APP.bahan.filter(b => b.stok <= b.stokMin);

  $('#stokAlert').innerHTML = kritis.length
    ? '<div class="login-error" style="background:var(--secondary-soft);color:var(--secondary);border-color:rgba(243,168,71,.3);margin-bottom:1rem">' +
      '<i class="bi bi-exclamation-triangle-fill"></i> ' + kritis.length + ' bahan baku berada di bawah stok minimum: <b>' +
      esc(kritis.slice(0, 4).map(b => b.nama).join(', ')) + (kritis.length > 4 ? ', dan lainnya' : '') + '</b></div>'
    : '';

  if (!list.length) {
    $('#bahanList').innerHTML = emptyState('bi-box-seam', 'Belum ada bahan baku', 'Tambahkan bahan baku agar HPP menu dapat dihitung otomatis.');
    return;
  }

  $('#bahanList').innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>Bahan Baku</th><th>Satuan</th><th class="td-num">Stok</th><th class="td-num">Min.</th>' +
      '<th class="td-num">Harga/Satuan</th><th class="td-num">Nilai Stok</th><th>Status</th><th class="td-act">Aksi</th>' +
    '</tr></thead><tbody>' +
    list.map(b => {
      const habis = b.stok <= 0, menipis = b.stok <= b.stokMin;
      const st = habis ? ['badge-habis', 'Habis'] : (menipis ? ['badge-menipis', 'Menipis'] : ['badge-aman', 'Aman']);
      return '<tr>' +
        '<td class="td-main">' + esc(b.nama) + '</td>' +
        '<td>' + esc(b.satuan) + '</td>' +
        '<td class="td-num td-main">' + angka(b.stok) + '</td>' +
        '<td class="td-num">' + angka(b.stokMin) + '</td>' +
        '<td class="td-num">' + rupiah(b.harga) + '</td>' +
        '<td class="td-num">' + rupiah(b.stok * b.harga) + '</td>' +
        '<td><span class="badge-oto ' + st[0] + '">' + st[1] + '</span></td>' +
        '<td class="td-act">' +
          '<button class="act-btn" data-mutasi="' + b.id + '" title="Tambah / kurangi stok"><i class="bi bi-arrow-down-up"></i></button>' +
          '<button class="act-btn" data-editb="' + b.id + '" title="Ubah"><i class="bi bi-pencil"></i></button>' +
          '<button class="act-btn act-danger" data-hapusb="' + b.id + '" title="Hapus"><i class="bi bi-trash3"></i></button>' +
        '</td></tr>';
    }).join('') +
    '</tbody></table>' +
    '<div class="info-block" style="margin-top:1rem">Total nilai persediaan: <b>' +
      rupiah(APP.bahan.reduce((s, b) => s + b.stok * b.harga, 0)) + '</b></div>';

  $$('#bahanList [data-editb]').forEach(b => b.onclick = () => bukaFormBahan(b.dataset.editb));
  $$('#bahanList [data-mutasi]').forEach(b => b.onclick = () => bukaFormMutasi(b.dataset.mutasi));
  $$('#bahanList [data-hapusb]').forEach(b => b.onclick = () => {
    const bahan = APP.bahan.find(x => x.id === b.dataset.hapusb);
    konfirmasi('Hapus Bahan Baku', 'Bahan "' + bahan.nama + '" akan dihapus permanen.', async () => {
      try {
        const res = await apiCall('hapusBahan', { id: bahan.id });
        handleRes(res);
        toast('Berhasil', res.message, 'success');
        await segarkanMaster(); renderBahan();
      } catch (err) { if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger'); }
    }, 'Ya, Hapus');
  });
}

function bukaFormBahan(id) {
  if (!bahanModal) bahanModal = new bootstrap.Modal($('#modalBahan'));
  const b = id ? APP.bahan.find(x => x.id === id) : null;
  $('#modalBahanTitle').textContent = b ? 'Ubah Bahan Baku' : 'Bahan Baku Baru';
  $('#bahanId').value      = b ? b.id : '';
  $('#bahanNama').value    = b ? b.nama : '';
  $('#bahanSatuan').value  = b ? b.satuan : '';
  $('#bahanStok').value    = b ? b.stok : 0;
  $('#bahanStokMin').value = b ? b.stokMin : 0;
  $('#bahanHarga').value   = b ? b.harga : '';
  bahanModal.show();
}

async function simpanBahanHandler() {
  const form = $('#formBahan');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = $('#btnSimpanBahan');
  setLoadingBtn(btn, true, 'Menyimpan…');
  try {
    const res = await apiCall('simpanBahan', { bahan: {
      id: $('#bahanId').value || '',
      nama: $('#bahanNama').value.trim(),
      satuan: $('#bahanSatuan').value.trim(),
      stok: bacaAngka($('#bahanStok').value),
      stokMin: bacaAngka($('#bahanStokMin').value),
      harga: bacaAngka($('#bahanHarga').value)
    } });
    handleRes(res);
    bahanModal.hide();
    toast('Berhasil', res.message, 'success');
    await segarkanMaster(); renderBahan();
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

function bukaFormMutasi(id) {
  if (!mutasiModal) mutasiModal = new bootstrap.Modal($('#modalMutasi'));
  const b = APP.bahan.find(x => x.id === id);
  if (!b) return;
  $('#mutasiIdBahan').value = b.id;
  $('#mutasiSatuan').textContent = b.satuan;
  $('#mutasiJumlah').value = '';
  $('#mutasiKet').value = '';
  $('#mutasiInfo').innerHTML =
    '<b>' + esc(b.nama) + '</b><br>Stok saat ini: <b>' + angka(b.stok) + ' ' + esc(b.satuan) + '</b> · ' +
    'Minimum: ' + angka(b.stokMin) + ' · Harga: ' + rupiah(b.harga) + ' / ' + esc(b.satuan);
  $$('#mutasiTipeToggle .type-btn').forEach((btn, i) => btn.classList.toggle('active', i === 0));
  $('#mutasiKeluarWrap').style.display = '';
  $('#mutasiCatatKeluar').checked = true;
  mutasiModal.show();
}

async function simpanMutasiHandler() {
  const form = $('#formMutasi');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const tipe = $('#mutasiTipeToggle .type-btn.active').dataset.tipe;
  const btn = $('#btnSimpanMutasi');
  setLoadingBtn(btn, true, 'Memproses…');
  try {
    const res = await apiCall('mutasiStok', {
      idBahan: $('#mutasiIdBahan').value,
      tipe: tipe,
      jumlah: bacaAngka($('#mutasiJumlah').value),
      keterangan: $('#mutasiKet').value.trim(),
      catatPengeluaran: tipe === 'Masuk' && $('#mutasiCatatKeluar').checked
    });
    handleRes(res);
    mutasiModal.hide();
    toast('Berhasil', res.message, 'success');
    APP.cachePengeluaran = []; APP.cacheDashboard = null;
    await segarkanMaster(); renderBahan();
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

async function bukaRiwayatStok() {
  if (!riwayatStokModal) riwayatStokModal = new bootstrap.Modal($('#modalRiwayatStok'));
  $('#mutasiListBody').innerHTML = '<div class="loading-inline"><div class="spin-ring"></div>Memuat riwayat…</div>';
  riwayatStokModal.show();
  try {
    const res = await apiCall('getMutasiStok');
    const data = handleRes(res);
    $('#mutasiListBody').innerHTML = data.length
      ? '<div class="data-wrap"><table class="data-table"><thead><tr><th>Waktu</th><th>Bahan</th><th>Tipe</th>' +
        '<th class="td-num">Jumlah</th><th>Keterangan</th><th>Oleh</th></tr></thead><tbody>' +
        data.map(m => '<tr><td>' + esc(m.tanggal) + '</td><td class="td-main">' + esc(m.nama) + '</td>' +
          '<td><span class="badge-oto ' + (m.tipe === 'Masuk' ? 'badge-aman' : 'badge-habis') + '">' + esc(m.tipe) + '</span></td>' +
          '<td class="td-num">' + angka(m.jumlah) + '</td><td>' + esc(m.keterangan) + '</td><td>' + esc(m.oleh) + '</td></tr>').join('') +
        '</tbody></table></div>'
      : emptyState('bi-clock-history', 'Belum ada mutasi', 'Riwayat penambahan & pengurangan stok akan tampil di sini.');
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') $('#mutasiListBody').innerHTML = emptyState('bi-exclamation-triangle', 'Gagal memuat', err.message);
  }
}

// ════════════════════════════════════════════════════════════
// BAGIAN 12: PENGELUARAN (Admin)
// ════════════════════════════════════════════════════════════

let keluarModal = null;

async function muatPengeluaran(paksa) {
  if (!$('#keluarDari').value) {
    const d = new Date(); d.setDate(d.getDate() - 29);
    $('#keluarDari').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    $('#keluarSampai').value = todayIso();
  }
  if (APP.cachePengeluaran.length && !paksa) return renderPengeluaran(APP.cachePengeluaran);

  skeleton('#keluarList', 4);
  try {
    const res = await apiCall('getPengeluaran', { filter: { dari: $('#keluarDari').value, sampai: $('#keluarSampai').value } });
    APP.cachePengeluaran = handleRes(res);
    renderPengeluaran(APP.cachePengeluaran);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') $('#keluarList').innerHTML = emptyState('bi-exclamation-triangle', 'Gagal memuat', err.message);
  }
}

function renderPengeluaran(data) {
  const total = data.reduce((s, d) => s + d.jumlah, 0);
  const perKat = {};
  data.forEach(d => perKat[d.kategori] = (perKat[d.kategori] || 0) + d.jumlah);
  const topKat = Object.keys(perKat).sort((a, b) => perKat[b] - perKat[a])[0];

  $('#keluarSummary').innerHTML =
    kpiCard('Total Pengeluaran', rupiah(total), 'bi-wallet2', 'primary') +
    kpiCard('Jumlah Catatan', data.length, 'bi-journal-text', 'secondary') +
    kpiCard('Kategori Terbesar', topKat ? topKat : '—', 'bi-pie-chart', 'tertiary',
            topKat ? rupiah(perKat[topKat]) : '');

  $('#keluarList').innerHTML = data.length
    ? '<table class="data-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th>' +
      '<th class="td-num">Jumlah</th><th>Oleh</th><th class="td-act">Aksi</th></tr></thead><tbody>' +
      data.map(d => '<tr>' +
        '<td>' + esc(d.tanggal) + '</td>' +
        '<td><span class="badge-oto badge-menipis">' + esc(d.kategori) + '</span></td>' +
        '<td>' + esc(d.keterangan || '—') + '</td>' +
        '<td class="td-num td-main">' + rupiah(d.jumlah) + '</td>' +
        '<td>' + esc(d.oleh) + '</td>' +
        '<td class="td-act">' +
          '<button class="act-btn" data-editk="' + d.id + '"><i class="bi bi-pencil"></i></button>' +
          '<button class="act-btn act-danger" data-hapusk="' + d.id + '"><i class="bi bi-trash3"></i></button>' +
        '</td></tr>').join('') +
      '</tbody></table>'
    : emptyState('bi-wallet2', 'Belum ada pengeluaran', 'Catat pengeluaran agar laba rugi terhitung akurat.');

  $$('#keluarList [data-editk]').forEach(b => b.onclick = () => bukaFormKeluar(b.dataset.editk));
  $$('#keluarList [data-hapusk]').forEach(b => b.onclick = () => {
    const d = data.find(x => x.id === b.dataset.hapusk);
    konfirmasi('Hapus Pengeluaran', 'Catatan "' + (d.keterangan || d.kategori) + '" senilai ' + rupiah(d.jumlah) + ' akan dihapus.', async () => {
      try {
        const res = await apiCall('hapusPengeluaran', { id: d.id });
        handleRes(res);
        toast('Berhasil', res.message, 'success');
        APP.cacheDashboard = null;
        muatPengeluaran(true);
      } catch (err) { if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger'); }
    }, 'Ya, Hapus');
  });
}

function bukaFormKeluar(id) {
  if (!keluarModal) keluarModal = new bootstrap.Modal($('#modalKeluar'));
  const d = id ? APP.cachePengeluaran.find(x => x.id === id) : null;
  $('#modalKeluarTitle').textContent = d ? 'Ubah Pengeluaran' : 'Catat Pengeluaran';
  $('#keluarId').value       = d ? d.id : '';
  $('#keluarTanggal').value  = d ? d.tanggalIso : todayIso();
  $('#keluarKategori').value = d ? d.kategori : '';
  $('#keluarJumlah').value   = d ? d.jumlah : '';
  $('#keluarKet').value      = d ? d.keterangan : '';
  keluarModal.show();
}

async function simpanKeluarHandler() {
  const form = $('#formKeluar');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = $('#btnSimpanKeluar');
  setLoadingBtn(btn, true, 'Menyimpan…');
  try {
    const res = await apiCall('simpanPengeluaran', { pengeluaran: {
      id: $('#keluarId').value || '',
      tanggal: $('#keluarTanggal').value,
      kategori: $('#keluarKategori').value,
      jumlah: bacaAngka($('#keluarJumlah').value),
      keterangan: $('#keluarKet').value.trim()
    } });
    handleRes(res);
    keluarModal.hide();
    toast('Berhasil', res.message, 'success');
    APP.cacheDashboard = null;
    muatPengeluaran(true);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

// ════════════════════════════════════════════════════════════
// BAGIAN 14: PENGGUNA (Admin)
// ════════════════════════════════════════════════════════════

let userModal = null;

async function muatPengguna(paksa) {
  renderRbacTable();
  if (APP.cachePengguna.length && !paksa) return renderPengguna(APP.cachePengguna);
  skeleton('#penggunaList', 3);
  try {
    const res = await apiCall('getPengguna');
    APP.cachePengguna = handleRes(res);
    renderPengguna(APP.cachePengguna);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') $('#penggunaList').innerHTML = emptyState('bi-people', 'Gagal memuat', err.message);
  }
}

function renderPengguna(data) {
  const labelRole = { admin: 'Admin', owner: 'Owner', kasir: 'Kasir' };
  $('#penggunaList').innerHTML =
    '<table class="data-table"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Status</th><th class="td-act">Aksi</th></tr></thead><tbody>' +
    data.map(u => '<tr>' +
      '<td class="td-main">' + esc(u.nama) + (u.id === APP.user.id ? ' <span class="badge-oto badge-menipis">Anda</span>' : '') + '</td>' +
      '<td>' + esc(u.username) + '</td>' +
      '<td><span class="badge-oto ' + (u.role === 'admin' ? 'badge-habis' : u.role === 'owner' ? 'badge-menipis' : 'badge-aman') + '">' +
        esc(labelRole[u.role] || u.role) + '</span></td>' +
      '<td>' + (u.aktif ? '<span class="badge-oto badge-aman">Aktif</span>' : '<span class="badge-oto badge-habis">Nonaktif</span>') + '</td>' +
      '<td class="td-act">' +
        '<button class="act-btn" data-editu="' + u.id + '"><i class="bi bi-pencil"></i></button>' +
        (u.id === APP.user.id ? '' : '<button class="act-btn act-danger" data-hapusu="' + u.id + '"><i class="bi bi-trash3"></i></button>') +
      '</td></tr>').join('') +
    '</tbody></table>';

  $$('#penggunaList [data-editu]').forEach(b => b.onclick = () => bukaFormUser(b.dataset.editu));
  $$('#penggunaList [data-hapusu]').forEach(b => b.onclick = () => {
    const u = data.find(x => x.id === b.dataset.hapusu);
    konfirmasi('Hapus Pengguna', 'Akun "' + u.nama + '" (' + u.username + ') akan dihapus permanen.', async () => {
      try {
        const res = await apiCall('hapusPengguna', { id: u.id });
        handleRes(res);
        toast('Berhasil', res.message, 'success');
        muatPengguna(true);
      } catch (err) { if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger'); }
    }, 'Ya, Hapus');
  });
}

function renderRbacTable() {
  const modul = [
    ['Kasir (input transaksi)', 1, 0, 1],
    ['Kelola Menu & Resep', 1, 0, 0],
    ['Kelola Stok & Bahan Baku', 1, 0, 0],
    ['Kelola Pengeluaran', 1, 0, 0],
    ['Laporan & Dashboard Lengkap', 1, 1, 0],
    ['Riwayat Transaksi Sendiri', 1, 1, 1],
    ['Kelola Pengguna', 1, 0, 0],
    ['Pengaturan Cafe & Struk', 1, 0, 0]
  ];
  const mark = v => v ? '<i class="bi bi-check-circle-fill yes-mark"></i>' : '<i class="bi bi-dash-circle no-mark"></i>';
  $('#rbacTable').innerHTML =
    '<div class="data-wrap"><table class="data-table"><thead><tr><th>Modul</th>' +
    '<th class="td-num">Admin</th><th class="td-num">Owner</th><th class="td-num">Kasir</th></tr></thead><tbody>' +
    modul.map(m => '<tr><td>' + esc(m[0]) + '</td><td class="td-num">' + mark(m[1]) +
      '</td><td class="td-num">' + mark(m[2]) + '</td><td class="td-num">' + mark(m[3]) + '</td></tr>').join('') +
    '</tbody></table></div>';
}

function bukaFormUser(id) {
  if (!userModal) userModal = new bootstrap.Modal($('#modalUser'));
  const u = id ? APP.cachePengguna.find(x => x.id === id) : null;
  $('#modalUserTitle').textContent = u ? 'Ubah Pengguna' : 'Pengguna Baru';
  $('#userId').value       = u ? u.id : '';
  $('#userNama').value     = u ? u.nama : '';
  $('#userUsername').value = u ? u.username : '';
  $('#userRoleSel').value  = u ? u.role : 'kasir';
  $('#userAktif').checked  = u ? u.aktif : true;
  $('#userPassword').value = '';
  $('#userPassword').required = !u;
  $('#userPassHint').textContent = u ? '' : '*';
  $('#userPassNote').textContent = u ? 'Kosongkan bila tidak ingin mengubah password.' : 'Minimal 6 karakter.';
  userModal.show();
}

async function simpanUserHandler() {
  const form = $('#formUser');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = $('#btnSimpanUser');
  setLoadingBtn(btn, true, 'Menyimpan…');
  try {
    const res = await apiCall('simpanPengguna', { pengguna: {
      id: $('#userId').value || '',
      nama: $('#userNama').value.trim(),
      username: $('#userUsername').value.trim(),
      role: $('#userRoleSel').value,
      password: $('#userPassword').value,
      aktif: $('#userAktif').checked
    } });
    handleRes(res);
    userModal.hide();
    toast('Berhasil', res.message, 'success');
    muatPengguna(true);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

// ════════════════════════════════════════════════════════════
// BAGIAN 15: PENGATURAN
// ════════════════════════════════════════════════════════════

function isiFormPengaturan() {
  const c = APP.config;
  const adminOnly = APP.user.role === 'admin';

  // Sembunyikan panel yang bukan hak akses peran ini
  renderPanelPrinter();   // panel printer tampil untuk semua peran

  const panels = $$('#section-pengaturan .panel');
  if (panels[0]) panels[0].style.display = adminOnly ? '' : 'none';
  if (panels[1]) panels[1].style.display = adminOnly ? '' : 'none';

  $('#setNamaCafe').value    = c.namaCafe || '';
  $('#setTagline').value     = c.tagline || '';
  $('#setAlamat').value      = c.alamat || '';
  $('#setTelepon').value     = c.telepon || '';
  $('#setLogo').value        = c.logoUrl || '';
  perbaruiPreviewLogo();
  $('#setPajak').value       = c.pajakPersen || 0;
  $('#setStrukHeader').value = c.strukHeader || '';
  $('#setStrukFooter').value = c.strukFooter || '';
  $('#setLogoStruk').checked = String(c.tampilLogoStruk || 'ya') === 'ya';

  const alamatApi = String(window.GAS_URL || '');
  const apiPendek = alamatApi.length > 52
    ? alamatApi.substring(0, 34) + '…' + alamatApi.slice(-12)
    : alamatApi;

  $('#infoPenyimpanan').innerHTML =
    '<b>Informasi Sistem</b><br>' +
    'Masuk sebagai <b>' + esc(APP.user.nama) + '</b> (' + esc(APP.user.role) + ')<br>' +
    'Versi frontend: <b>' + esc(typeof VERSI_FRONTEND !== 'undefined' ? VERSI_FRONTEND : '-') + '</b><br>' +
    'Backend: Apps Script REST API<br>' +
    '<span style="word-break:break-all;font-size:11px;color:var(--text-3)">' + esc(apiPendek) + '</span><br>' +
    'Database: Google Sheets <b>DB_Otocafe</b><br>' +
    'Menu aktif: <b>' + APP.menu.filter(m => m.aktif).length + '</b> · Bahan baku: <b>' + APP.bahan.length + '</b><br>' +
    'Mode tampilan: <b>' + (document.documentElement.getAttribute('data-theme') === 'dark' ? 'Gelap' : 'Terang') + '</b>' +
    '<div class="divider" style="margin:.9rem 0"></div>' +
    '<b>Kecepatan Server</b><br>' +
    '<span id="statKecepatan">' + ringkasKecepatan() + '</span>' +
    '<button type="button" class="btn-ghost btn-sm-ember w-100 mt-2" id="btnTesKoneksi">' +
      '<i class="bi bi-speedometer2"></i> Tes Kecepatan Koneksi</button>' +
    '<div id="hasilTesKoneksi" class="mt-2"></div>';

  const tombolTes = $('#btnTesKoneksi');
  if (tombolTes) tombolTes.onclick = tesKecepatanKoneksi;
}

async function simpanPengaturanHandler(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = form.querySelector('button[type="submit"]');
  setLoadingBtn(btn, true, 'Menyimpan…');

  const isStruk = form.id === 'formStruk';
  const payload = isStruk ? {
    strukHeader: $('#setStrukHeader').value.trim(),
    strukFooter: $('#setStrukFooter').value.trim(),
    tampilLogoStruk: $('#setLogoStruk').checked ? 'ya' : 'tidak'
  } : {
    namaCafe: $('#setNamaCafe').value.trim(),
    tagline: $('#setTagline').value.trim(),
    alamat: $('#setAlamat').value.trim(),
    telepon: $('#setTelepon').value.trim(),
    logoUrl: $('#setLogo').value.trim(),
    pajakPersen: String(bacaAngka($('#setPajak').value))
  };

  try {
    const res = await apiCall('simpanPengaturan', { pengaturan: payload });
    APP.config = handleRes(res);
    toast('Berhasil', res.message, 'success');
    terapkanIdentitas();
    renderKeranjang();
    isiFormPengaturan();
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

async function gantiPasswordHandler(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  if ($('#passBaru').value !== $('#passUlang').value) {
    return toast('Tidak cocok', 'Konfirmasi password baru tidak sama.', 'warning');
  }
  const btn = form.querySelector('button[type="submit"]');
  setLoadingBtn(btn, true, 'Memproses…');
  try {
    const res = await apiCall('gantiPassword', { passwordLama: $('#passLama').value, passwordBaru: $('#passBaru').value });
    handleRes(res);
    form.reset();
    toast('Berhasil', res.message, 'success');
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

function previewStrukContoh() {
  const contoh = {
    noStruk: 'OTO-2026-0001',
    tanggal: new Date().toLocaleDateString('id-ID') + ' ' + new Date().toTimeString().substring(0, 5),
    kasir: APP.user.nama, tipe: 'Dine-In', namaPelanggan: 'Pelanggan Contoh', noMeja: 'Meja 04',
    items: [
      { nama: 'Kopi Susu Aren Otocafe', harga: 22000, qty: 2 },
      { nama: 'Almond Butter Croissant', harga: 24000, qty: 1 }
    ],
    subtotal: 68000, diskon: 0,
    pajak: bulatkan(68000 * bacaAngka($('#setPajak').value) / 100),
    pajakPersen: bacaAngka($('#setPajak').value),
    total: bulatkan(68000 + 68000 * bacaAngka($('#setPajak').value) / 100),
    metodeBayar: 'QRIS',
    config: Object.assign({}, APP.config, {
      namaCafe: $('#setNamaCafe').value, alamat: $('#setAlamat').value, telepon: $('#setTelepon').value,
      logoUrl: $('#setLogo').value, strukHeader: $('#setStrukHeader').value,
      strukFooter: $('#setStrukFooter').value, tampilLogoStruk: $('#setLogoStruk').checked ? 'ya' : 'tidak'
    })
  };
  APP.strukTerakhir = contoh;
  tampilkanStruk(contoh);
}


// ════════════════════════════════════════════════════════════
// BAGIAN 15B: DIAGNOSTIK KECEPATAN
// ════════════════════════════════════════════════════════════

/** Ringkasan durasi permintaan yang sudah terjadi di sesi ini. */
function ringkasKecepatan() {
  if (!STAT_API.length) return '<span class="text-muted-2">Belum ada data permintaan.</span>';
  const arr = STAT_API.map(x => x.ms).sort((a, b) => a - b);
  const median = arr[Math.floor(arr.length / 2)];
  const terlambat = STAT_API.slice().sort((a, b) => b.ms - a.ms)[0];
  return 'Median <b>' + angka(median) + ' ms</b> dari ' + arr.length + ' permintaan terakhir<br>' +
         '<span style="font-size:11px;color:var(--text-3)">Paling lambat: ' + esc(terlambat.action) +
         ' (' + angka(terlambat.ms) + ' ms)</span>';
}

/**
 * Kirim 3 ping berturut-turut. Ping pertama sering lebih lambat karena server
 * Apps Script "bangun" dulu (cold start); ping ke-2 dan ke-3 mencerminkan
 * kecepatan normal jaringan + Google.
 */
async function tesKecepatanKoneksi() {
  const btn = $('#btnTesKoneksi'), out = $('#hasilTesKoneksi');
  setLoadingBtn(btn, true, 'Menguji…');
  const hasil = [];
  try {
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const res = await apiCall('ping');
      if (!res || !res.success) throw new Error((res && res.message) || 'Ping gagal');
      hasil.push(Math.round(performance.now() - t0));
    }
    const normal = Math.round((hasil[1] + hasil[2]) / 2);
    const nilai = normal < 1200 ? ['Baik', 'var(--tertiary)']
                : normal < 2500 ? ['Wajar untuk Apps Script', 'var(--secondary)']
                : ['Lambat — periksa jaringan', 'var(--danger)'];
    out.innerHTML = '<div class="mutasi-info" style="margin:0">' +
      'Ping: ' + hasil.map(ms => angka(ms) + ' ms').join(' · ') + '<br>' +
      'Kecepatan normal: <b style="color:' + nilai[1] + '">' + angka(normal) + ' ms — ' + nilai[0] + '</b>' +
      (hasil[0] > normal * 1.8 ? '<br><span style="font-size:11px">Ping pertama lebih lambat: server sedang "bangun" (wajar).</span>' : '') +
      '</div>';
    $('#statKecepatan').innerHTML = ringkasKecepatan();
  } catch (err) {
    out.innerHTML = '<div class="login-error" style="margin:0">' + esc(err.message) + '</div>';
  } finally {
    setLoadingBtn(btn, false);
  }
}

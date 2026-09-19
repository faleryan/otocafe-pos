/**
 * ============================================================
 * OTOCAFE POS — hutang.js — daftar hutang pelanggan & pelunasan
 * ============================================================
 * Piutang cafe: daftar, detail, pencatatan pelunasan (boleh dicicil),
 * dan ekspor CSV.
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 9B: DAFTAR HUTANG PELANGGAN (PIUTANG CAFE)
// ════════════════════════════════════════════════════════════

let bayarHutangModal = null, detailHutangModal = null;
let metodePelunasan = 'Tunai';

async function muatHutang(paksa) {
  if (APP.cacheHutang && !paksa) return renderHutang(APP.cacheHutang);

  skeleton('#hutangList', 4);
  try {
    const res = await apiCall('getHutang', { filter: { status: APP.hutangFilter, cari: APP.cariHutang } });
    APP.cacheHutang = handleRes(res);
    renderHutang(APP.cacheHutang);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      $('#hutangList').innerHTML = emptyState('bi-exclamation-triangle', 'Gagal memuat', err.message);
    }
  }
}

function renderHutang(payload) {
  const data = payload.data || [];
  const r = payload.ringkasan || {};

  $('#hutangSummary').innerHTML =
    kpiCard('Piutang Belum Tertagih', rupiah(r.belumLunas), 'bi-hourglass-split', 'secondary',
            r.jmlBelumLunas + ' catatan hutang aktif') +
    kpiCard('Sudah Tertagih', rupiah(r.totalTertagih), 'bi-check2-circle', 'tertiary',
            'Sudah masuk pendapatan') +
    kpiCard('Total Nilai Hutang', rupiah(r.totalPiutang), 'bi-journal-text', 'primary',
            r.jmlHutang + ' transaksi hutang') +
    kpiCard('Lewat Jatuh Tempo', r.jmlTerlambat, 'bi-alarm', r.jmlTerlambat > 0 ? 'primary' : 'tertiary',
            r.jmlTerlambat > 0 ? 'Perlu ditagih segera' : 'Tidak ada tunggakan lewat tempo');

  // Pelanggan dengan sisa hutang terbesar
  const top = r.topPelanggan || [];
  $('#panelTopNunggak').style.display = top.length ? '' : 'none';
  if (top.length) {
    const maks = top[0].sisa || 1;
    $('#topNunggakList').innerHTML =
      '<table class="data-table"><thead><tr><th>Pelanggan</th><th class="td-num">Sisa Hutang</th><th style="width:40%">Proporsi</th></tr></thead><tbody>' +
      top.map(t => '<tr><td class="td-main">' + esc(t.nama) + '</td>' +
        '<td class="td-num" style="color:var(--secondary)">' + rupiah(t.sisa) + '</td>' +
        '<td><div class="pay-bar"><span style="width:' + (t.sisa / maks * 100).toFixed(1) +
          '%;background:var(--secondary)"></span></div></td></tr>').join('') +
      '</tbody></table>';
  }

  if (!data.length) {
    $('#hutangList').innerHTML = emptyState('bi-emoji-smile',
      APP.hutangFilter === 'Belum Lunas' ? 'Tidak ada hutang aktif' : 'Belum ada data',
      APP.hutangFilter === 'Belum Lunas'
        ? 'Semua pelanggan sudah melunasi hutangnya. 🎉'
        : 'Hutang tercatat otomatis saat kasir memilih metode pembayaran "Hutang".');
    return;
  }

  $('#hutangList').innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>Pelanggan</th><th>No. Struk</th><th>Tanggal</th><th>Jatuh Tempo</th>' +
      '<th class="td-num">Nilai</th><th class="td-num">Dibayar</th><th class="td-num">Sisa</th>' +
      '<th>Status</th><th class="td-act">Aksi</th>' +
    '</tr></thead><tbody>' +
    data.map(h => {
      const persen = h.jumlah > 0 ? (h.dibayar / h.jumlah * 100) : 0;
      const badge = h.status === 'Lunas'
        ? '<span class="badge-oto badge-aman">Lunas</span>'
        : (h.terlambat
            ? '<span class="badge-oto badge-telat">Lewat Tempo</span>'
            : (h.status === 'Sebagian'
                ? '<span class="badge-oto badge-sebagian">Sebagian</span>'
                : '<span class="badge-oto badge-menipis">Belum Lunas</span>'));
      return '<tr' + (h.terlambat ? ' class="row-telat"' : '') + '>' +
        '<td class="td-main">' + esc(h.nama) +
          (h.kontak ? '<div class="menu-cat">' + esc(h.kontak) + '</div>' : '') + '</td>' +
        '<td>' + esc(h.noStruk) + '</td>' +
        '<td>' + esc(h.tanggal) + '</td>' +
        '<td>' + (h.jatuhTempo ? esc(h.jatuhTempo) : '<span class="text-muted-2">—</span>') + '</td>' +
        '<td class="td-num">' + rupiah(h.jumlah) + '</td>' +
        '<td class="td-num" style="color:var(--tertiary)">' + rupiah(h.dibayar) +
          '<div class="pay-bar"><span style="width:' + persen.toFixed(1) + '%"></span></div></td>' +
        '<td class="td-num td-main" style="color:' + (h.sisa > 0 ? 'var(--secondary)' : 'var(--tertiary)') + '">' +
          rupiah(h.sisa) + '</td>' +
        '<td>' + badge + '</td>' +
        '<td class="td-act">' +
          '<button class="act-btn" data-detail="' + h.id + '" title="Detail & riwayat"><i class="bi bi-eye"></i></button>' +
          (payload.bolehBayar && h.sisa > 0
            ? '<button class="act-btn" data-bayar="' + h.id + '" title="Terima pembayaran"><i class="bi bi-cash-stack"></i></button>' : '') +
          (payload.bolehHapus && h.dibayar === 0
            ? '<button class="act-btn act-danger" data-hapush="' + h.id + '" title="Hapus catatan"><i class="bi bi-trash3"></i></button>' : '') +
        '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>';

  $$('#hutangList [data-bayar]').forEach(b => b.onclick = () => bukaBayarHutang(b.dataset.bayar));
  $$('#hutangList [data-detail]').forEach(b => b.onclick = () => bukaDetailHutang(b.dataset.detail));
  $$('#hutangList [data-hapush]').forEach(b => b.onclick = () => {
    const h = data.find(x => x.id === b.dataset.hapush);
    konfirmasi('Hapus Catatan Hutang',
      'Catatan hutang ' + h.nama + ' (' + h.noStruk + ') senilai ' + rupiah(h.jumlah) + ' akan dihapus. ' +
      'Transaksi penjualannya tetap ada dan stok tidak dikembalikan.', async () => {
      try {
        const res = await apiCall('hapusHutang', { id: h.id });
        handleRes(res);
        toast('Berhasil', res.message, 'success');
        APP.cacheHutang = null; APP.cacheDashboard = null;
        muatHutang(true);
      } catch (err) { if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger'); }
    }, 'Ya, Hapus');
  });
}

function cariHutangDiCache(id) {
  return (APP.cacheHutang && APP.cacheHutang.data || []).find(x => x.id === id);
}

function bukaBayarHutang(id) {
  const h = cariHutangDiCache(id);
  if (!h) return;
  if (!bayarHutangModal) bayarHutangModal = new bootstrap.Modal($('#modalBayarHutang'));

  $('#bayarIdHutang').value = h.id;
  $('#bayarJumlah').value = h.sisa;
  $('#bayarCatatan').value = '';
  metodePelunasan = 'Tunai';
  $$('#bayarMetodeGrid .pay-btn').forEach(b => b.classList.toggle('active', b.dataset.pay === 'Tunai'));

  $('#bayarInfoHutang').innerHTML =
    '<b>' + esc(h.nama) + '</b>' + (h.kontak ? ' · ' + esc(h.kontak) : '') + '<br>' +
    'Struk ' + esc(h.noStruk) + ' · ' + esc(h.tanggal) + '<br>' +
    'Nilai hutang <b>' + rupiah(h.jumlah) + '</b> · sudah dibayar <b>' + rupiah(h.dibayar) + '</b><br>' +
    'Sisa yang harus dilunasi: <b style="color:var(--secondary)">' + rupiah(h.sisa) + '</b>';

  // Tombol nominal cepat — pembayaran boleh dicicil berapa pun
  const opsi = [h.sisa, h.sisa / 2, 50000, 100000]
    .map(v => bulatkan(v))
    .filter((v, i, arr) => v > 0 && v <= h.sisa && arr.indexOf(v) === i);
  $('#bayarCepat').innerHTML = opsi.map(v =>
    '<button type="button" class="quick-amount" data-nominal="' + v + '">' +
      (v === h.sisa ? 'Lunas · ' : '') + rupiah(v) + '</button>').join('');
  $$('#bayarCepat .quick-amount').forEach(b =>
    b.onclick = () => { $('#bayarJumlah').value = b.dataset.nominal; });

  if (detailHutangModal) detailHutangModal.hide();
  bayarHutangModal.show();
}

async function simpanBayarHutangHandler() {
  const form = $('#formBayarHutang');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const jumlah = bacaAngka($('#bayarJumlah').value);
  if (jumlah <= 0) return toast('Nominal tidak valid', 'Jumlah pembayaran harus lebih dari 0.', 'warning');

  const btn = $('#btnSimpanBayarHutang');
  setLoadingBtn(btn, true, 'Menyimpan…');
  try {
    const res = await apiCall('bayarHutang', {
      idHutang: $('#bayarIdHutang').value,
      jumlah: jumlah,
      metode: metodePelunasan,
      catatan: $('#bayarCatatan').value.trim()
    });
    handleRes(res);
    bayarHutangModal.hide();
    toast(res.data.status === 'Lunas' ? 'Hutang lunas' : 'Pembayaran dicatat', res.message, 'success');

    APP.cacheHutang = null; APP.cacheDashboard = null;
    muatHutang(true);
    perbaruiRingkasanShift();
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

async function bukaDetailHutang(id) {
  const h = cariHutangDiCache(id);
  if (!h) return;
  if (!detailHutangModal) detailHutangModal = new bootstrap.Modal($('#modalDetailHutang'));

  const bolehUbah = APP.cacheHutang.bolehBayar;
  $('#btnSimpanUbahHutang').style.display = bolehUbah ? '' : 'none';
  $('#btnBayarDariDetail').style.display = (bolehUbah && h.sisa > 0) ? '' : 'none';
  $('#btnBayarDariDetail').onclick = () => bukaBayarHutang(h.id);
  $('#btnSimpanUbahHutang').onclick = () => simpanUbahHutang(h.id);

  $('#detailHutangBody').innerHTML =
    '<div class="detail-grid">' +
      '<div class="detail-cell"><div class="dc-label">Pelanggan</div><div class="dc-value">' + esc(h.nama) + '</div></div>' +
      '<div class="detail-cell"><div class="dc-label">No. Struk</div><div class="dc-value">' + esc(h.noStruk) + '</div></div>' +
      '<div class="detail-cell"><div class="dc-label">Nilai Hutang</div><div class="dc-value">' + rupiah(h.jumlah) + '</div></div>' +
      '<div class="detail-cell"><div class="dc-label">Sudah Dibayar</div><div class="dc-value" style="color:var(--tertiary)">' + rupiah(h.dibayar) + '</div></div>' +
      '<div class="detail-cell"><div class="dc-label">Sisa</div><div class="dc-value" style="color:var(--secondary)">' + rupiah(h.sisa) + '</div></div>' +
      '<div class="detail-cell"><div class="dc-label">Status</div><div class="dc-value">' + esc(h.status) +
        (h.tanggalLunas ? '<div class="menu-cat">Lunas ' + esc(h.tanggalLunas) + '</div>' : '') + '</div></div>' +
    '</div>' +

    (bolehUbah ? '<div class="row g-3 mb-3">' +
      '<div class="col-md-6"><div class="field-group mb-0"><label class="field-label">Kontak / WhatsApp</label>' +
        '<div class="field-wrap"><i class="bi bi-telephone"></i>' +
        '<input type="text" class="field-input" id="detKontak" value="' + esc(h.kontak) + '" maxlength="25"></div></div></div>' +
      '<div class="col-md-6"><div class="field-group mb-0"><label class="field-label">Jatuh Tempo</label>' +
        '<div class="field-wrap"><i class="bi bi-calendar3"></i>' +
        '<input type="date" class="field-input" id="detJatuhTempo" value="' + esc(h.jatuhTempo) + '"></div></div></div>' +
      '<div class="col-12"><div class="field-group mb-0"><label class="field-label">Catatan</label>' +
        '<div class="field-wrap"><i class="bi bi-chat-left-text"></i>' +
        '<input type="text" class="field-input" id="detCatatan" value="' + esc(h.catatan) + '" maxlength="100"></div></div></div>' +
    '</div>' : '') +

    '<h6 class="panel-title">Riwayat Pelunasan</h6>' +
    '<div id="riwayatBayarBox"><div class="loading-inline"><div class="spin-ring"></div>Memuat riwayat…</div></div>';

  detailHutangModal.show();

  try {
    const res = await apiCall('getRiwayatBayarHutang', { idHutang: h.id });
    const list = handleRes(res);
    $('#riwayatBayarBox').innerHTML = list.length
      ? '<div class="data-wrap"><table class="data-table"><thead><tr><th>Tanggal</th>' +
        '<th class="td-num">Jumlah</th><th>Metode</th><th>Catatan</th><th>Diterima Oleh</th></tr></thead><tbody>' +
        list.map(b => '<tr><td>' + esc(b.tanggal) + '</td>' +
          '<td class="td-num td-main" style="color:var(--tertiary)">' + rupiah(b.jumlah) + '</td>' +
          '<td><span class="badge-oto badge-menipis">' + esc(b.metode) + '</span></td>' +
          '<td>' + esc(b.catatan || '—') + '</td><td>' + esc(b.oleh) + '</td></tr>').join('') +
        '</tbody></table></div>'
      : '<div class="info-block">Belum ada pembayaran untuk hutang ini.</div>';
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      $('#riwayatBayarBox').innerHTML = '<div class="info-block">Gagal memuat riwayat: ' + esc(err.message) + '</div>';
    }
  }
}

async function simpanUbahHutang(id) {
  const btn = $('#btnSimpanUbahHutang');
  setLoadingBtn(btn, true, 'Menyimpan…');
  try {
    const res = await apiCall('ubahHutang', { hutang: {
      id: id,
      kontak: $('#detKontak') ? $('#detKontak').value.trim() : '',
      jatuhTempo: $('#detJatuhTempo') ? $('#detJatuhTempo').value : '',
      catatan: $('#detCatatan') ? $('#detCatatan').value.trim() : ''
    } });
    handleRes(res);
    detailHutangModal.hide();
    toast('Berhasil', res.message, 'success');
    APP.cacheHutang = null;
    muatHutang(true);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') toast('Gagal', err.message, 'danger');
  } finally { setLoadingBtn(btn, false); }
}

function exportHutangCsv() {
  const data = (APP.cacheHutang && APP.cacheHutang.data) || [];
  if (!data.length) return toast('Tidak ada data', 'Belum ada hutang untuk diekspor.', 'warning');
  const head = ['Pelanggan', 'Kontak', 'No Struk', 'Tanggal', 'Jatuh Tempo', 'Nilai', 'Dibayar', 'Sisa', 'Status', 'Catatan'];
  const rows = data.map(h => [h.nama, h.kontak, h.noStruk, h.tanggal, h.jatuhTempo,
                              h.jumlah, h.dibayar, h.sisa, h.status, h.catatan]);
  unduhCsv('hutang-otocafe-' + todayIso() + '.csv', head, rows);
}

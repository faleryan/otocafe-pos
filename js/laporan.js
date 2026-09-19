/**
 * ============================================================
 * OTOCAFE POS — laporan.js — dashboard, grafik, dan laporan laba rugi
 * ============================================================
 * KPI, panel persamaan pendapatan kotor, grafik tren minimalis,
 * filter bulan, serta ekspor CSV laporan.
 */

// ════════════════════════════════════════════════════════════
// BAGIAN 13: DASHBOARD & LAPORAN
// ════════════════════════════════════════════════════════════

function kpiCard(label, value, ikon, warna, sub) {
  const bg = { primary: 'var(--primary-soft)', secondary: 'var(--secondary-soft)', tertiary: 'var(--tertiary-soft)' }[warna] || 'var(--primary-soft)';
  const fg = { primary: 'var(--primary)', secondary: 'var(--secondary)', tertiary: 'var(--tertiary)' }[warna] || 'var(--primary)';
  return '<div class="kpi-card">' +
    '<div class="kpi-top"><span class="kpi-label">' + esc(label) + '</span>' +
    '<span class="kpi-icon" style="background:' + bg + ';color:' + fg + '"><i class="bi ' + ikon + '"></i></span></div>' +
    '<div class="kpi-value">' + value + '</div>' +
    (sub ? '<div class="kpi-delta delta-flat">' + sub + '</div>' : '') +
    '</div>';
}

let periodeAktif = '7hari';
let bulanAktif = '';   // diisi 'YYYY-MM' saat pengguna membuka riwayat bulan tertentu

async function muatDashboard(paksa) {
  if (APP.cacheDashboard && !paksa) return renderDashboard(APP.cacheDashboard);

  skeleton('#kpiRow', 1);
  $('#insightList').innerHTML = '<li>Menghitung analisis…</li>';
  try {
    const res = await apiCall('getDashboardData', {
      periode: periodeAktif,
      dari: periodeAktif === 'bulan' ? bulanAktif : '',
      sampai: ''
    });
    APP.cacheDashboard = handleRes(res);
    renderDashboard(APP.cacheDashboard);
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') {
      $('#kpiRow').innerHTML = emptyState('bi-exclamation-triangle', 'Gagal memuat dashboard', err.message);
    }
  }
}

function renderDashboard(d) {
  const k = d.kpi;
  $('#laporanPeriode').textContent = 'Periode ' + d.dari + ' s/d ' + d.sampai;

  isiPilihanBulan(d.daftarBulan, d.bulanAktif);

  // ── Panel persamaan: Omzet − Pengeluaran = Pendapatan Kotor ──
  $('#kpiHero').innerHTML =
    '<div class="kpi-hero">' +
      '<div class="kh-cell">' +
        '<div class="kh-label"><i class="bi bi-cash-coin"></i> Omzet Penjualan</div>' +
        '<div class="kh-value">' + rupiah(k.omzet) + '</div>' +
        '<div class="kh-sub">' + k.jmlTrx + ' transaksi · ' + angka(k.jmlItem) + ' porsi</div>' +
      '</div>' +
      '<div class="kh-op kh-op-minus" aria-hidden="true"></div>' +
      '<div class="kh-cell kh-minus">' +
        '<div class="kh-label"><i class="bi bi-wallet2"></i> Pengeluaran</div>' +
        '<div class="kh-value">' + rupiah(k.pengeluaran) + '</div>' +
        '<div class="kh-sub">Biaya operasional periode ini</div>' +
      '</div>' +
      '<div class="kh-op kh-op-equal" aria-hidden="true"></div>' +
      '<div class="kh-cell kh-result">' +
        '<div class="kh-label"><i class="bi bi-cash-stack"></i> Pendapatan Kotor</div>' +
        '<div class="kh-value">' + rupiah(k.pendapatanKotor) + '</div>' +
        '<div class="kh-sub">' + k.marginPendapatanKotor.toFixed(1) + '% dari omzet · sebelum HPP bahan baku</div>' +
      '</div>' +
    '</div>';

  $('#kpiRow').innerHTML =
    kpiCard('Pendapatan Diterima', rupiah(k.pendapatanDiterima), 'bi-wallet-fill', 'tertiary',
            'Kas masuk' + (k.pelunasan > 0 ? ' · termasuk pelunasan ' + rupiah(k.pelunasan) : '')) +
    kpiCard('Piutang Belum Tertagih', rupiah(k.piutangOutstanding), 'bi-hourglass-split',
            k.piutangOutstanding > 0 ? 'primary' : 'tertiary',
            k.piutangOutstanding > 0 ? k.jmlPelangganNunggak + ' catatan hutang aktif' : 'Tidak ada tunggakan') +
    kpiCard('HPP Terjual', rupiah(k.hpp), 'bi-box-seam', 'primary', 'Biaya bahan baku') +
    kpiCard('Laba Kotor', rupiah(k.labaKotor), 'bi-graph-up', 'tertiary', 'Omzet − HPP · ' + k.marginKotor.toFixed(1) + '%') +
    kpiCard('Laba Bersih', rupiah(k.labaBersih), 'bi-piggy-bank', k.labaBersih >= 0 ? 'tertiary' : 'primary',
            'Setelah HPP & pengeluaran · ' + k.marginBersih.toFixed(1) + '%') +
    kpiCard('Rata-rata Struk', rupiah(k.rataStruk), 'bi-receipt', 'secondary', 'Per transaksi');

  $('#insightList').innerHTML = (d.insights || []).map(i => '<li>' + esc(i) + '</li>').join('') ||
    '<li>Belum ada cukup data untuk dianalisis.</li>';

  renderChartTren(d.seri);
  renderChartTerlaris(d.terlaris);
  renderChartDonat('chartMetode', d.perMetode);
  renderChartDonat('chartKeluar', d.perKategoriKeluar);
  renderLabaRugi(d);
  renderStokKritis(d.stokKritis);
}

/** Isi dropdown riwayat bulan dari data yang benar-benar ada. */
function isiPilihanBulan(daftar, aktif) {
  const sel = $('#pilihBulan');
  if (!sel || !daftar) return;

  const tandaSekarang = daftar.map(b => b.nilai).join('|');
  if (sel.dataset.isi !== tandaSekarang) {
    sel.innerHTML = '<option value="">Riwayat bulan…</option>' +
      daftar.map(b => '<option value="' + esc(b.nilai) + '">' + esc(b.label) + '</option>').join('');
    sel.dataset.isi = tandaSekarang;
  }
  sel.value = aktif || '';
  $('.bulan-picker').classList.toggle('aktif', !!aktif);
}

function renderLabaRugi(d) {
  const k = d.kpi;
  const baris = [
    ['Penjualan (Omzet)', k.omzet, 'td-main'],
    ['Pengeluaran Operasional', -k.pengeluaran, ''],
    ['Pendapatan Kotor (Omzet − Pengeluaran)', k.pendapatanKotor, 'td-main'],
    ['— Setelah Memperhitungkan Bahan Baku —', null, 'baris-pemisah'],
    ['Harga Pokok Penjualan (HPP)', -k.hpp, ''],
    ['Laba Kotor (Omzet − HPP)', k.labaKotor, 'td-main'],
    ['Laba Bersih (Omzet − HPP − Pengeluaran)', k.labaBersih, 'td-main'],
    ['— Arus Kas —', null, 'baris-pemisah'],
    ['Penjualan yang jadi Hutang (belum diterima)', -k.piutangBaru, ''],
    ['Pelunasan Hutang Diterima', k.pelunasan, ''],
    ['Pendapatan Diterima (kas masuk)', k.pendapatanDiterima, 'td-main'],
    ['Piutang Belum Tertagih (akumulasi)', k.piutangOutstanding, '']
  ];
  $('#labaRugiTable').innerHTML =
    '<table class="data-table"><thead><tr><th>Komponen</th><th class="td-num">Nilai</th><th class="td-num">% Omzet</th></tr></thead><tbody>' +
    baris.map(b => {
      if (b[1] === null) {
        return '<tr><td colspan="3" style="background:var(--surface);color:var(--text-3);' +
               'font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700">' +
               esc(b[0].replace(/—/g, '').trim()) + '</td></tr>';
      }
      const pct = k.omzet > 0 ? (Math.abs(b[1]) / k.omzet * 100).toFixed(1) + '%' : '—';
      const positifBagus = /^Laba|^Pendapatan|Pelunasan/.test(b[0]);
      const warna = b[1] < 0 ? 'color:var(--danger)'
                  : (positifBagus ? 'color:var(--tertiary)'
                  : (/Piutang/.test(b[0]) ? 'color:var(--secondary)' : ''));
      return '<tr><td class="' + b[2] + '">' + esc(b[0]) + '</td>' +
        '<td class="td-num ' + b[2] + '" style="' + warna + '">' + rupiah(b[1]) + '</td>' +
        '<td class="td-num">' + pct + '</td></tr>';
    }).join('') +
    '</tbody></table>';
}

function renderStokKritis(list) {
  $('#stokKritisList').innerHTML = (list && list.length)
    ? '<table class="data-table"><thead><tr><th>Bahan</th><th class="td-num">Stok</th><th class="td-num">Minimum</th><th>Status</th></tr></thead><tbody>' +
      list.map(s => '<tr><td class="td-main">' + esc(s.nama) + '</td>' +
        '<td class="td-num">' + angka(s.stok) + ' ' + esc(s.satuan) + '</td>' +
        '<td class="td-num">' + angka(s.min) + ' ' + esc(s.satuan) + '</td>' +
        '<td><span class="badge-oto ' + (s.stok <= 0 ? 'badge-habis' : 'badge-menipis') + '">' +
          (s.stok <= 0 ? 'Habis' : 'Perlu restock') + '</span></td></tr>').join('') +
      '</tbody></table>'
    : '<div class="info-block" style="color:var(--tertiary)"><i class="bi bi-check-circle-fill"></i> Seluruh bahan baku berada di atas batas stok minimum.</div>';
}

function hancurkanChart(id) {
  if (APP.charts[id]) { APP.charts[id].destroy(); delete APP.charts[id]; }
}

/**
 * Tren penjualan & laba — gaya minimalis.
 * Tanpa blok gradien tebal, tanpa garis bantu vertikal, label seperlunya saja,
 * supaya bentuk grafiknya yang bicara.
 */
function renderChartTren(seri) {
  const el = $('#chartTren'); if (!el) return;
  hancurkanChart('tren');
  const w = warnaTema();

  // Isian sangat tipis: memberi bobot pada garis omzet tanpa mendominasi
  const isian = el.getContext('2d').createLinearGradient(0, 0, 0, 260);
  isian.addColorStop(0, hexKeRgba(w.primary, 0.12));
  isian.addColorStop(1, hexKeRgba(w.primary, 0));

  // Pada rentang panjang, tampilkan label tanggal seperlunya saja
  const maksLabel = window.innerWidth < 768 ? 4 : 7;
  const langkah = Math.max(1, Math.ceil(seri.length / maksLabel));

  APP.charts.tren = new Chart(el, {
    type: 'line',
    data: {
      labels: seri.map(s => s.label),
      datasets: [
        { label: 'Omzet', data: seri.map(s => s.omzet),
          borderColor: w.primary, backgroundColor: isian,
          borderWidth: 2, fill: true, tension: .35,
          pointRadius: 0, pointHoverRadius: 4,
          pointHoverBackgroundColor: w.primary, pointHoverBorderColor: w.card, pointHoverBorderWidth: 2 },
        { label: 'Laba Kotor', data: seri.map(s => s.laba),
          borderColor: w.tertiary, backgroundColor: 'transparent',
          borderWidth: 1.5, borderDash: [4, 4], fill: false, tension: .35,
          pointRadius: 0, pointHoverRadius: 4,
          pointHoverBackgroundColor: w.tertiary, pointHoverBorderColor: w.card, pointHoverBorderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 4, left: 0, bottom: 0 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: w.card, titleColor: w.text, bodyColor: w.text2,
          borderColor: w.grid, borderWidth: 1, padding: 10, cornerRadius: 10,
          displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true,
          titleFont: { size: 11, family: 'Plus Jakarta Sans', weight: '700' },
          bodyFont: { size: 11.5, family: 'Plus Jakarta Sans' },
          callbacks: { label: c => '  ' + c.dataset.label + ': ' + rupiah(c.parsed.y) }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: w.text3, font: { size: 10, family: 'Plus Jakarta Sans' },
            maxRotation: 0, autoSkip: false, padding: 6,
            callback: function (v, i) {
              return (i % langkah === 0 || i === seri.length - 1) ? this.getLabelForValue(v) : '';
            }
          }
        },
        y: {
          grid: { color: w.grid, drawTicks: false, lineWidth: 1 },
          border: { display: false, dash: [3, 4] },
          ticks: {
            color: w.text3, font: { size: 10, family: 'Plus Jakarta Sans' },
            padding: 10, maxTicksLimit: 4,
            callback: v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + ' jt'
                          : (v >= 1000 ? Math.round(v / 1000) + ' rb' : v)
          }
        }
      }
    }
  });
}

/** Ubah warna token (#RRGGBB atau rgb()) jadi rgba dengan transparansi tertentu. */
function hexKeRgba(warna, alpha) {
  const c = String(warna).trim();
  if (c.charAt(0) === '#') {
    const h = c.length === 4
      ? c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3)
      : c.substring(1, 7);
    const n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }
  const angka3 = c.match(/\d+/g);
  return angka3 ? 'rgba(' + angka3[0] + ',' + angka3[1] + ',' + angka3[2] + ',' + alpha + ')' : c;
}

function renderChartTerlaris(list) {
  const el = $('#chartTerlaris'); if (!el) return;
  hancurkanChart('terlaris');
  const w = warnaTema();
  const data = (list || []).slice(0, 6);

  APP.charts.terlaris = new Chart(el, {
    type: 'bar',
    data: {
      labels: data.map(d => d.nama.length > 18 ? d.nama.substring(0, 17) + '…' : d.nama),
      datasets: [{ label: 'Porsi', data: data.map(d => d.qty), backgroundColor: w.secondary,
                   borderRadius: 8, borderSkipped: false, barThickness: 16 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: w.card, titleColor: w.text, bodyColor: w.text2,
          borderColor: w.grid, borderWidth: 1, padding: 10, cornerRadius: 10,
          callbacks: { label: c => ' ' + c.parsed.x + ' porsi' }
        }
      },
      scales: {
        x: { grid: { color: w.grid }, border: { display: false }, ticks: { color: w.text3, font: { size: 10 }, precision: 0 } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: w.text2, font: { size: 10.5, family: 'Plus Jakarta Sans' } } }
      }
    }
  });
}

function renderChartDonat(canvasId, obj) {
  const el = $('#' + canvasId); if (!el) return;
  hancurkanChart(canvasId);
  const w = warnaTema();
  const labels = Object.keys(obj || {});
  const values = labels.map(k => obj[k]);
  const box = el.parentNode;

  // Buang pesan "kosong" dari render sebelumnya (canvas TIDAK pernah dihapus)
  const lama = box.querySelector('.chart-empty');
  if (lama) lama.remove();

  if (!labels.length) {
    el.style.display = 'none';
    const kosong = document.createElement('div');
    kosong.className = 'empty-state chart-empty';
    kosong.style.padding = '2rem 1rem';
    kosong.innerHTML = '<i class="bi bi-pie-chart"></i><p>Belum ada data pada periode ini.</p>';
    box.appendChild(kosong);
    return;
  }
  el.style.display = '';

  const palet = [w.primary, w.secondary, w.tertiary, '#9B6BC9', '#4FA3C7', '#D98E7A', '#7A9E6F', '#C77D4F'];
  APP.charts[canvasId] = new Chart(el, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: palet, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: w.text2, boxWidth: 9, boxHeight: 9, usePointStyle: true,
                  pointStyle: 'circle', padding: 12, font: { size: 10.5, family: 'Plus Jakarta Sans' } } },
        tooltip: {
          backgroundColor: w.card, titleColor: w.text, bodyColor: w.text2,
          borderColor: w.grid, borderWidth: 1, padding: 10, cornerRadius: 10,
          callbacks: {
            label: c => {
              const tot = c.dataset.data.reduce((a, b) => a + b, 0);
              const p = tot ? (c.parsed / tot * 100).toFixed(0) : 0;
              return ' ' + c.label + ': ' + rupiah(c.parsed) + ' (' + p + '%)';
            }
          }
        }
      }
    }
  });
}

/** Saat tema berganti, chart digambar ulang dengan warna yang sesuai. */
function refreshChartTheme() {
  if (APP.cacheDashboard && APP.navAktif === 'laporan') {
    setTimeout(() => renderDashboard(APP.cacheDashboard), 60);
  }
}

function exportLaporanCsv() {
  const d = APP.cacheDashboard;
  if (!d) return toast('Belum ada data', 'Muat dashboard terlebih dahulu.', 'warning');
  const head = ['Tanggal', 'Omzet', 'HPP', 'Laba Kotor', 'Jumlah Transaksi'];
  const rows = d.seri.map(s => [s.tanggal, s.omzet, s.hpp, s.laba, s.trx]);
  rows.push([]);
  rows.push(['RINGKASAN PERIODE', d.dari + ' s/d ' + d.sampai]);
  rows.push(['Omzet Penjualan', d.kpi.omzet]);
  rows.push(['Pengeluaran Operasional', d.kpi.pengeluaran]);
  rows.push(['Pendapatan Kotor (Omzet - Pengeluaran)', d.kpi.pendapatanKotor]);
  rows.push(['HPP Terjual', d.kpi.hpp]);
  rows.push(['Laba Kotor (Omzet - HPP)', d.kpi.labaKotor]);
  rows.push(['Laba Bersih', d.kpi.labaBersih]);
  rows.push(['Pendapatan Diterima (kas)', d.kpi.pendapatanDiterima]);
  rows.push(['Piutang Belum Tertagih', d.kpi.piutangOutstanding]);
  const namaFile = (periodeAktif === 'bulan' && bulanAktif)
    ? 'laporan-otocafe-' + bulanAktif + '.csv'
    : 'laporan-otocafe-' + d.dari + '_' + d.sampai + '.csv';
  unduhCsv(namaFile, head, rows);
}

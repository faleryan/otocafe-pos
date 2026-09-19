/**
 * ============================================================
 * OTOCAFE POS — printer.js
 * ============================================================
 * Cetak struk LANGSUNG ke printer thermal Bluetooth dari browser,
 * tanpa aplikasi perantara.
 *
 * Dua jalur, dipilih otomatis:
 *  1. Web Serial  -> Bluetooth "klasik" (profil SPP). Jenis printer
 *                    thermal 58 mm yang paling umum. Chrome Android 138+.
 *  2. Web Bluetooth -> Bluetooth Low Energy (BLE). Printer yang lebih baru.
 *
 * Tidak didukung di iPhone/iPad (semua browser iOS memakai mesin Safari
 * yang tidak menyediakan kedua API ini). Di perangkat seperti itu aplikasi
 * otomatis kembali ke dialog cetak biasa (window.print).
 *
 * Pengaturan printer disimpan di perangkat (localStorage), bukan di akun,
 * karena pasangan Bluetooth memang milik HP/tablet tempat printer dipasangkan.
 */

// ════════════════════════════════════════════════════════════
// BAGIAN P1: KONSTANTA
// ════════════════════════════════════════════════════════════

// Profil Serial Port (SPP) — standar Bluetooth klasik untuk printer thermal
const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

// Layanan BLE yang lazim dipakai printer thermal ESC/POS.
// Browser hanya mengizinkan akses ke layanan yang disebut di sini.
const LAYANAN_BLE_PRINTER = [
  '000018f0-0000-1000-8000-00805f9b34fb',   // umum pada printer 58 mm (karakteristik 2af1)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',   // banyak printer mini Tiongkok
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',   // modul ISSC / Microchip
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',   // modul HM-10 / JDY
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb'
];

const LS_PRINTER = 'oto_printer';   // { jenis, nama, bleId, lebar, otomatis }

// Status koneksi selama halaman terbuka
const PRINTER = {
  port: null,          // SerialPort (jalur klasik)
  perangkat: null,     // BluetoothDevice (jalur BLE)
  karakteristik: null, // BluetoothRemoteGATTCharacteristic tempat menulis
  sibuk: false
};


// ════════════════════════════════════════════════════════════
// BAGIAN P2: PENGATURAN PRINTER (per perangkat)
// ════════════════════════════════════════════════════════════

function bacaSetelanPrinter() {
  try {
    const s = JSON.parse(lsGet(LS_PRINTER, 'null'));
    if (s && typeof s === 'object') return Object.assign({ lebar: 32, otomatis: false }, s);
  } catch (e) {}
  return { jenis: '', nama: '', bleId: '', lebar: 32, otomatis: false };
}

function simpanSetelanPrinter(s) {
  lsSet(LS_PRINTER, JSON.stringify(s));
}

/** Kemampuan browser ini. */
function dukunganBluetooth() {
  return {
    serial: !!(navigator.serial && navigator.serial.requestPort),
    ble: !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
    aman: window.isSecureContext !== false   // Bluetooth hanya jalan di HTTPS
  };
}

function printerSiap() {
  const s = bacaSetelanPrinter();
  return !!s.jenis;
}


// ════════════════════════════════════════════════════════════
// BAGIAN P3: PENYUSUN PERINTAH ESC/POS
// ════════════════════════════════════════════════════════════
// ESC/POS adalah "bahasa" standar printer thermal kasir. Teks dikirim apa
// adanya, sedangkan tebal/rata tengah/ukuran huruf diatur lewat kode khusus.

const ESC = 0x1B, GS = 0x1D, LF = 0x0A;

/**
 * Printer thermal umumnya hanya mengenal karakter ASCII dasar.
 * Karakter lain diganti padanan terdekat agar tidak tercetak sebagai sampah.
 */
function keAscii(teks) {
  return String(teks === null || teks === undefined ? '' : teks)
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")      // tanda kutip tunggal miring
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')      // tanda kutip ganda miring
    .replace(/[\u2013\u2014\u2212]/g, '-')            // tanda pisah panjang & minus
    .replace(/\u2026/g, '...')                        // elipsis
    .replace(/[\u00B7\u2022]/g, '-')                  // titik tengah & bullet
    .replace(/\u00D7/g, 'x')                          // tanda kali
    .replace(/\u00A0/g, ' ')                          // spasi tak terputus
    .normalize('NFD').replace(/[\u0300-\u036F]/g, '') // huruf beraksen: e-akut -> e
    .replace(/[^\x20-\x7E\n]/g, '?');
}

/** Pecah teks panjang menjadi beberapa baris selebar kertas, memutus di spasi. */
function bungkusTeks(teks, lebar) {
  const kata = keAscii(teks).split(/\s+/).filter(Boolean);
  const baris = [];
  let kini = '';
  kata.forEach(k => {
    while (k.length > lebar) {                 // kata lebih panjang dari kertas
      if (kini) { baris.push(kini); kini = ''; }
      baris.push(k.slice(0, lebar)); k = k.slice(lebar);
    }
    if (!kini) kini = k;
    else if ((kini + ' ' + k).length <= lebar) kini += ' ' + k;
    else { baris.push(kini); kini = k; }
  });
  if (kini) baris.push(kini);
  return baris.length ? baris : [''];
}

/** Satu baris dua kolom: kiri rata kiri, kanan rata kanan. */
function barisKiriKanan(kiri, kanan, lebar) {
  kiri = keAscii(kiri); kanan = keAscii(kanan);
  const ruang = lebar - kanan.length - 1;
  if (kiri.length > ruang) {
    // label terlalu panjang: kiri di baris sendiri, nilai di baris berikutnya
    return bungkusTeks(kiri, lebar).concat([' '.repeat(Math.max(0, lebar - kanan.length)) + kanan]);
  }
  return [kiri + ' '.repeat(lebar - kiri.length - kanan.length) + kanan];
}

/** Pengumpul byte ESC/POS dengan antarmuka yang enak dibaca. */
function PenyusunStruk(lebar) {
  this.lebar = lebar || 32;
  this.byte = [];
  this.teksPratinjau = [];     // salinan teks polos, untuk pengujian & pratinjau
}
PenyusunStruk.prototype = {
  raw(arr)       { arr.forEach(b => this.byte.push(b & 0xFF)); return this; },
  mulai()        { return this.raw([ESC, 0x40]); },                        // ESC @  reset printer
  rata(posisi)   { return this.raw([ESC, 0x61, { kiri: 0, tengah: 1, kanan: 2 }[posisi] || 0]); },
  tebal(ya)      { return this.raw([ESC, 0x45, ya ? 1 : 0]); },             // ESC E
  besar(ya)      { return this.raw([GS, 0x21, ya ? 0x11 : 0x00]); },        // GS ! lebar & tinggi ganda
  tinggi(ya)     { return this.raw([GS, 0x21, ya ? 0x01 : 0x00]); },        // GS ! tinggi ganda saja
  teks(s) {
    const t = keAscii(s);
    for (let i = 0; i < t.length; i++) this.byte.push(t.charCodeAt(i));
    return this;
  },
  baris(s) {
    this.teks(s || '');
    this.byte.push(LF);
    this.teksPratinjau.push(keAscii(s || ''));
    return this;
  },
  garis(ch)      { return this.baris((ch || '-').repeat(this.lebar)); },
  kolom(kiri, kanan) { barisKiriKanan(kiri, kanan, this.lebar).forEach(b => this.baris(b)); return this; },
  bungkus(s, indent) {
    const n = indent || 0;
    bungkusTeks(s, this.lebar - n).forEach(b => this.baris(' '.repeat(n) + b));
    return this;
  },
  tengah(s, lebarEfektif) {
    const w = lebarEfektif || this.lebar;
    this.rata('tengah');
    bungkusTeks(s, w).forEach(b => {
      this.teks(b); this.byte.push(LF);
      // pratinjau: huruf lebar-ganda digambar dengan spasi di antara huruf
      const tampil = (w < this.lebar) ? b.split('').join(' ') : b;
      const kiri = Math.floor((this.lebar - tampil.length) / 2);
      this.teksPratinjau.push(' '.repeat(Math.max(0, kiri)) + tampil);
    });
    return this.rata('kiri');
  },
  /** Judul huruf besar (lebar & tinggi ganda): hanya muat setengah lebar kertas. */
  judul(s) {
    this.tebal(true).besar(true);
    this.tengah(s, Math.floor(this.lebar / 2));
    return this.besar(false).tebal(false);
  },
  maju(n)        { return this.raw([ESC, 0x64, n || 3]); },                 // ESC d n  gulung kertas
  potong()       { return this.raw([GS, 0x56, 0x42, 0x00]); },             // GS V  potong (diabaikan printer tanpa pisau)
  hasil()        { return new Uint8Array(this.byte); }
};

/** Angka gaya Indonesia tanpa "Rp" — hemat tempat di kertas 58 mm. */
function angkaStruk(n) {
  return angka(n, 2);
}

/**
 * Susun struk menjadi perintah ESC/POS.
 * Sumber datanya sama persis dengan pratinjau struk di layar.
 */
function susunStrukEscPos(s, lebar) {
  const c = s.config || APP.config || {};
  const p = new PenyusunStruk(lebar || 32);

  p.mulai();

  // ── Kop ──
  p.judul(c.strukHeader || c.namaCafe || 'OTOCAFE');
  if (c.alamat)  p.tengah(c.alamat);
  if (c.telepon) p.tengah(c.telepon);
  p.garis();

  // ── Identitas transaksi ──
  p.kolom('No', s.noStruk || '-');
  p.kolom('Tanggal', s.tanggal || '-');
  p.kolom('Kasir', s.kasir || '-');
  p.kolom('Tipe', (s.tipe || '-') + (s.noMeja ? ' / ' + s.noMeja : ''));
  if (s.namaPelanggan) p.kolom('Pelanggan', s.namaPelanggan);
  p.garis();

  // ── Daftar item ──
  (s.items || []).forEach(it => {
    p.bungkus(it.nama);
    p.kolom('  ' + angkaStruk(it.qty) + ' x ' + angkaStruk(it.harga), angkaStruk((Number(it.harga) || 0) * (Number(it.qty) || 0)));
    if (it.catatan) p.bungkus('* ' + it.catatan, 2);
  });
  p.garis();

  // ── Rincian pembayaran ──
  p.kolom('Subtotal', angkaStruk(s.subtotal));
  if (Number(s.diskon) > 0) p.kolom('Diskon', '-' + angkaStruk(s.diskon));
  if (Number(s.pajak) > 0)  p.kolom('Pajak ' + angka(s.pajakPersen) + '%', angkaStruk(s.pajak));
  p.tebal(true).tinggi(true).kolom('TOTAL', 'Rp ' + angkaStruk(s.total)).tinggi(false).tebal(false);
  p.kolom('Bayar', s.metodeBayar || '-');

  // ── Penanda hutang ──
  if (s.metodeBayar === 'Hutang') {
    p.garis();
    p.tebal(true).tengah('** BELUM LUNAS / HUTANG **').tebal(false);
    p.kolom('Atas nama', s.namaPelanggan || '-');
    p.kolom('Sisa hutang', 'Rp ' + angkaStruk(s.total));
  }

  // ── Penutup ──
  p.garis();
  p.tengah(c.strukFooter || 'Terima kasih atas kunjungan Anda!');
  p.maju(4).potong();

  return p;
}

/** Struk uji coba untuk memastikan printer tersambung & lebar kertas pas. */
function susunStrukUji(lebar) {
  const p = new PenyusunStruk(lebar);
  const c = APP.config || {};
  p.mulai();
  p.judul('TES PRINTER');
  p.tengah(c.namaCafe || 'Otocafe');
  p.garis('=');
  p.baris('Lebar kertas : ' + (lebar >= 48 ? '80 mm' : '58 mm') + ' (' + lebar + ' huruf)');
  p.baris('Waktu        : ' + new Date().toLocaleString('id-ID'));
  p.garis();
  p.baris('1234567890'.repeat(Math.ceil(lebar / 10)).slice(0, lebar));
  p.kolom('Kiri', 'Kanan');
  p.tebal(true).baris('Huruf tebal').tebal(false);
  p.tinggi(true).baris('Huruf tinggi').tinggi(false);
  p.garis();
  p.tengah('Bila baris angka di atas tidak');
  p.tengah('terpotong, lebar kertas sudah tepat.');
  p.maju(4).potong();
  return p;
}


// ════════════════════════════════════════════════════════════
// BAGIAN P4: KONEKSI — BLUETOOTH KLASIK (Web Serial / SPP)
// ════════════════════════════════════════════════════════════

/** Cari port Bluetooth SPP yang sudah pernah diizinkan — tanpa dialog. */
async function cariPortTersimpan() {
  if (!navigator.serial || !navigator.serial.getPorts) return null;
  const ports = await navigator.serial.getPorts();
  const bt = ports.filter(pt => {
    try { const i = pt.getInfo(); return !i.usbVendorId && (!i.bluetoothServiceClassId || String(i.bluetoothServiceClassId).toLowerCase() === SPP_UUID); }
    catch (e) { return false; }
  });
  return bt[0] || ports[0] || null;
}

async function bukaPort(port) {
  if (!port.writable) {
    // Kecepatan (baud) diabaikan pada Bluetooth, tapi wajib diisi oleh API
    await port.open({ baudRate: 9600 });
  }
  return port;
}

async function tulisSerial(data) {
  if (!PRINTER.port) {
    PRINTER.port = await cariPortTersimpan();
    if (!PRINTER.port) throw new Error('Printer belum dihubungkan di perangkat ini. Buka Atur → Printer Struk.');
  }
  await bukaPort(PRINTER.port);

  const writer = PRINTER.port.writable.getWriter();
  try {
    // Kirim bertahap agar penyangga printer murah tidak meluap
    for (let i = 0; i < data.length; i += 256) {
      await writer.write(data.slice(i, i + 256));
      await jeda(12);
    }
  } finally {
    writer.releaseLock();
  }
}


// ════════════════════════════════════════════════════════════
// BAGIAN P5: KONEKSI — BLUETOOTH LOW ENERGY (Web Bluetooth)
// ════════════════════════════════════════════════════════════

/** Temukan karakteristik yang bisa ditulisi di antara layanan printer. */
async function cariKarakteristikTulis(server) {
  const layanan = await server.getPrimaryServices().catch(() => []);
  for (const l of layanan) {
    const daftar = await l.getCharacteristics().catch(() => []);
    for (const k of daftar) {
      if (k.properties && (k.properties.writeWithoutResponse || k.properties.write)) return k;
    }
  }
  return null;
}

async function sambungBle(perangkat) {
  const server = perangkat.gatt.connected ? perangkat.gatt : await perangkat.gatt.connect();
  const k = await cariKarakteristikTulis(server);
  if (!k) throw new Error('Printer tersambung, tetapi tidak menyediakan jalur cetak yang dikenali. '
                        + 'Coba mode Bluetooth biasa.');
  PRINTER.perangkat = perangkat;
  PRINTER.karakteristik = k;
  return k;
}

/** Sambung ulang printer BLE yang sudah pernah diizinkan — tanpa dialog (bila browser mendukung). */
async function cariBleTersimpan(setelan) {
  if (PRINTER.perangkat) return PRINTER.perangkat;
  if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return null;
  const daftar = await navigator.bluetooth.getDevices();
  return daftar.find(d => d.id === setelan.bleId) || null;
}

async function tulisBle(data, setelan) {
  let k = PRINTER.karakteristik;
  if (!k || !PRINTER.perangkat || !PRINTER.perangkat.gatt.connected) {
    const perangkat = await cariBleTersimpan(setelan);
    if (!perangkat) {
      throw new Error('Sambungan printer terputus setelah halaman dimuat ulang. '
                    + 'Buka Atur → Printer Struk → Hubungkan Printer.');
    }
    k = await sambungBle(perangkat);
  }
  const tanpaBalasan = k.properties.writeWithoutResponse && k.writeValueWithoutResponse;
  // Paket BLE kecil: 100 byte aman untuk hampir semua printer
  for (let i = 0; i < data.length; i += 100) {
    const potong = data.slice(i, i + 100);
    if (tanpaBalasan) await k.writeValueWithoutResponse(potong);
    else await k.writeValue(potong);
    await jeda(20);
  }
}


// ════════════════════════════════════════════════════════════
// BAGIAN P6: ALUR MENGHUBUNGKAN & MENCETAK
// ════════════════════════════════════════════════════════════

function jeda(ms) { return new Promise(r => setTimeout(r, ms)); }

function batasWaktu(janji, ms, pesan) {
  return Promise.race([janji, new Promise((_, tolak) => setTimeout(() => tolak(new Error(pesan)), ms))]);
}

/**
 * Pilih printer lewat dialog browser. WAJIB dipanggil langsung dari klik
 * tombol — browser menolak membuka dialog Bluetooth tanpa sentuhan pengguna.
 * @param {'serial'|'ble'} [paksaJenis]
 */
async function hubungkanPrinter(paksaJenis) {
  const d = dukunganBluetooth();
  if (!d.aman) throw new Error('Cetak Bluetooth hanya berjalan di alamat https://.');
  const jenis = paksaJenis || (d.serial ? 'serial' : (d.ble ? 'ble' : ''));
  if (!jenis) {
    throw new Error('Browser ini belum mendukung cetak Bluetooth langsung. Gunakan Google Chrome '
                  + 'versi terbaru di Android. (iPhone/iPad tidak didukung.)');
  }

  const setelan = bacaSetelanPrinter();

  if (jenis === 'serial') {
    let port;
    try {
      port = await navigator.serial.requestPort({
        allowedBluetoothServiceClassIds: [SPP_UUID],
        filters: [{ bluetoothServiceClassId: SPP_UUID }]
      });
    } catch (e) {
      if (e && e.name === 'NotFoundError') {
        throw new Error('Tidak ada printer yang dipilih. Pastikan printer menyala dan sudah '
                      + 'dipasangkan di Pengaturan → Bluetooth HP/tablet.');
      }
      throw e;
    }
    PRINTER.port = port;
    await batasWaktu(bukaPort(port), 15000, 'Printer tidak merespons. Pastikan printer menyala dan dekat.');
    Object.assign(setelan, { jenis: 'serial', nama: 'Printer Bluetooth', bleId: '' });
  } else {
    let perangkat;
    try {
      perangkat = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: LAYANAN_BLE_PRINTER
      });
    } catch (e) {
      if (e && e.name === 'NotFoundError') throw new Error('Tidak ada printer yang dipilih.');
      throw e;
    }
    await batasWaktu(sambungBle(perangkat), 15000, 'Printer tidak merespons. Pastikan printer menyala dan dekat.');
    Object.assign(setelan, { jenis: 'ble', nama: perangkat.name || 'Printer BLE', bleId: perangkat.id });
  }

  simpanSetelanPrinter(setelan);
  return setelan;
}

/** Kirim byte ke printer sesuai jalur yang tersimpan. */
async function kirimKePrinter(data) {
  const setelan = bacaSetelanPrinter();
  if (!setelan.jenis) throw new Error('Printer belum diatur. Buka Atur → Printer Struk.');
  if (PRINTER.sibuk) throw new Error('Printer sedang mencetak, tunggu sebentar.');

  PRINTER.sibuk = true;
  try {
    const kerja = setelan.jenis === 'serial' ? tulisSerial(data) : tulisBle(data, setelan);
    await batasWaktu(kerja, 20000, 'Printer tidak merespons. Pastikan printer menyala, kertas terpasang, dan jaraknya dekat.');
  } catch (err) {
    // Tutup sambungan yang mungkin macet supaya percobaan berikutnya membuka ulang dari awal.
    // Izin printer tetap tersimpan, jadi tidak perlu memilih printer lagi.
    try { if (PRINTER.port && PRINTER.port.writable) await PRINTER.port.close(); } catch (e) {}
    PRINTER.karakteristik = null;
    throw err;
  } finally {
    PRINTER.sibuk = false;
  }
}

/**
 * Cetak struk. Dipakai tombol "Cetak Struk" dan cetak otomatis setelah bayar.
 * Bila printer Bluetooth belum diatur atau tidak didukung perangkat ini,
 * kembali ke dialog cetak browser seperti sebelumnya.
 */
async function cetakStruk(struk, opsi) {
  opsi = opsi || {};
  if (!struk) return;

  const d = dukunganBluetooth();
  if (!printerSiap() || (!d.serial && !d.ble)) {
    if (opsi.otomatis) return;           // cetak otomatis tanpa printer: tidak ada yang dilakukan
    window.print();
    return;
  }

  const setelan = bacaSetelanPrinter();
  const btn = $('#btnStrukPrint');
  if (btn && !opsi.otomatis) setLoadingBtn(btn, true, 'Mencetak…');
  try {
    await kirimKePrinter(susunStrukEscPos(struk, setelan.lebar).hasil());
    toast('Struk tercetak', (setelan.nama || 'Printer') + ' · ' + (struk.noStruk || ''), 'success');
  } catch (err) {
    toast('Gagal mencetak', err.message + ' Anda tetap bisa memakai tombol "Dialog Cetak".', 'danger');
  } finally {
    if (btn && !opsi.otomatis) setLoadingBtn(btn, false);
  }
}


// ════════════════════════════════════════════════════════════
// BAGIAN P7: PANEL PENGATURAN PRINTER
// ════════════════════════════════════════════════════════════

function renderPanelPrinter() {
  const kotak = $('#printerStatus');
  if (!kotak) return;
  const d = dukunganBluetooth();
  const s = bacaSetelanPrinter();

  $$('#lebarKertasToggle .type-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.lebar) === Number(s.lebar)));
  $('#cetakOtomatis').checked = !!s.otomatis;

  let status, warna, ikon;
  if (!d.serial && !d.ble) {
    status = 'Perangkat/browser ini tidak mendukung cetak Bluetooth langsung. Struk akan dicetak '
           + 'lewat dialog cetak biasa. Gunakan Google Chrome di Android untuk cetak langsung.';
    warna = 'var(--secondary)'; ikon = 'bi-exclamation-triangle';
  } else if (s.jenis) {
    status = '<b>' + esc(s.nama) + '</b> — ' + (s.jenis === 'serial' ? 'Bluetooth biasa' : 'Bluetooth LE') +
             ' · kertas ' + (Number(s.lebar) >= 48 ? '80 mm' : '58 mm');
    warna = 'var(--tertiary)'; ikon = 'bi-check-circle-fill';
  } else {
    status = 'Belum ada printer. Pasangkan printer dulu di <b>Pengaturan → Bluetooth</b> HP/tablet, '
           + 'lalu tekan <b>Hubungkan Printer</b>.';
    warna = 'var(--text-2)'; ikon = 'bi-bluetooth';
  }
  kotak.innerHTML = '<i class="bi ' + ikon + '" style="color:' + warna + '"></i><span>' + status + '</span>';

  const adaApi = d.serial || d.ble;
  $('#btnPilihPrinter').disabled = !adaApi;
  $('#btnPilihPrinter').innerHTML = '<i class="bi bi-bluetooth"></i> ' + (s.jenis ? 'Ganti Printer' : 'Hubungkan Printer');
  $('#btnTesCetak').disabled = !s.jenis;
  $('#btnLupakanPrinter').style.display = s.jenis ? '' : 'none';
  // Mode BLE ditawarkan sebagai cadangan bila printer tidak muncul di daftar Bluetooth biasa
  $('#btnPrinterBle').style.display = (d.serial && d.ble) ? '' : 'none';
}

function pasangPanelPrinter() {
  if (!$('#panelPrinter')) return;

  $('#btnPilihPrinter').onclick = () => jalankanHubungkan();
  $('#btnPrinterBle').onclick   = () => jalankanHubungkan('ble');

  $('#btnTesCetak').onclick = async () => {
    const btn = $('#btnTesCetak');
    setLoadingBtn(btn, true, 'Mencetak…');
    try {
      await kirimKePrinter(susunStrukUji(bacaSetelanPrinter().lebar).hasil());
      toast('Tes cetak terkirim', 'Periksa hasil cetakan di printer.', 'success');
    } catch (err) {
      toast('Tes cetak gagal', err.message, 'danger');
    } finally {
      setLoadingBtn(btn, false);
      renderPanelPrinter();
    }
  };

  $('#btnLupakanPrinter').onclick = async () => {
    try { if (PRINTER.port && PRINTER.port.writable) await PRINTER.port.close(); } catch (e) {}
    try { if (PRINTER.perangkat && PRINTER.perangkat.gatt.connected) PRINTER.perangkat.gatt.disconnect(); } catch (e) {}
    try { if (PRINTER.port && PRINTER.port.forget) await PRINTER.port.forget(); } catch (e) {}
    Object.assign(PRINTER, { port: null, perangkat: null, karakteristik: null });
    const s = bacaSetelanPrinter();
    simpanSetelanPrinter({ jenis: '', nama: '', bleId: '', lebar: s.lebar, otomatis: false });
    toast('Printer dilupakan', 'Struk kembali dicetak lewat dialog cetak biasa.', 'info');
    renderPanelPrinter();
  };

  $$('#lebarKertasToggle .type-btn').forEach(b => b.onclick = () => {
    const s = bacaSetelanPrinter(); s.lebar = Number(b.dataset.lebar); simpanSetelanPrinter(s);
    renderPanelPrinter();
  });

  $('#cetakOtomatis').onchange = (e) => {
    const s = bacaSetelanPrinter(); s.otomatis = e.target.checked; simpanSetelanPrinter(s);
  };
}

async function jalankanHubungkan(jenis) {
  const btn = jenis === 'ble' ? $('#btnPrinterBle') : $('#btnPilihPrinter');
  setLoadingBtn(btn, true, 'Mencari printer…');
  try {
    const s = await hubungkanPrinter(jenis);
    toast('Printer terhubung', s.nama + ' siap dipakai. Coba "Tes Cetak".', 'success');
  } catch (err) {
    if (!(err && err.name === 'NotAllowedError' && /cancel/i.test(err.message))) {
      toast('Gagal menghubungkan', err.message, 'danger');
    }
  } finally {
    setLoadingBtn(btn, false);
    renderPanelPrinter();
  }
}

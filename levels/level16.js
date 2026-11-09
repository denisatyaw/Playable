'use strict';

// ── LEVEL 16: Hamster Power (Generator Wheel & Electric Bridges) ───────────────
// Dimensi: 2600 x 600 px (65 Kolom x 15 Baris, Tile: 40px)
// Fitur Utama: Roda Hamster (Generator Wheel) & Jembatan Listrik (Electric Bridges).
//
// 💡 LOGIKA PUZZLE & ALUR PERJALANAN MENUJU TITIK AKHIR:
// 1. TEBING AWAL (x: 0 - 960):
//    - Tempat spawn pemain dan Roda Generator Hamster (x: 640).
// 2. JURANG LISTRIK (x: 960 - 1920):
//    - Terdapat jurang dalam yang memisahkan tebing awal dari pintu akhir.
//    - Di tengah jurang terdapat Pulau Batu Kunci (x: 1280 - 1440) tempat Kunci Emas bertengger.
//    - Terdapat 2 bentangan Jembatan Listrik:
//      * Jembatan 1 (x: 960 - 1280): Menghubungkan tebing awal ke Pulau Kunci.
//      * Jembatan 2 (x: 1440 - 1920): Menghubungkan Pulau Kunci ke Tebing Akhir.
// 3. MEKANIK LISTRIK RODA HAMSTER (ANTI-NGEBUT & SANTAI):
//    - Pemain berlari di roda hamster untuk mengisi daya baterai generator (0% → 100%).
//    - Pengisian berlangsung stabil & teratur (~4 detik lari stabil).
//    - Saat berdaya listrik, kedua Jembatan Listrik menyala solid bercahaya neon biru.
//    - Rekan setim dapat menyeberang dengan aman, mengambil Kunci di Pulau Tengah,
//      dan menyeberang ke Tebing Akhir.
// 4. SISTEM PENGUNCI PERMANEN (SEMUA PEMAIN BISA MENYEBERANG):
//    - OVERCHARGE LATCH: Jika generator dipacu mencapai 100%, generator & jembatan
//      otomatis TERKUNCI PERMANEN! Seluruh pelari bisa keluar roda dan menyeberang bersama.
//    - SAKLAR CADANGAN: Di tebing akhir terdapat tombol [KUNCI JEMBATAN] (x: 2000).
//      Rekan yang menyeberang duluan bisa menginjak tombol ini untuk mengunci jembatan
//      secara instan agar pelari di roda bisa menyusul.
//    - DISCHARGE SANTAI: Jika pemain keluar sebelum 100%, daya berkurang sangat perlahan
//      (~16.6 detik) sehingga tidak ada kepanikan atau rasa terburu-buru.

module.exports = {
  id      : 16,
  name    : 'Level 16 – Hamster Power',
  worldW  : 2600,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
    // 65 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5         6
    // 01234567890123456789012345678901234567890123456789012345678901234
    '00000000000000000000000000000000000000000000000000000000000000000', // 0
    '00000000000000000000000000000000000000000000000000000000000000000', // 1
    '00000000000000000000000000000000000000000000000000000000000000000', // 2
    '00000000000000000000000000000000000000000000000000000000000000000', // 3
    '00000000000000000000000000000000000000000000000000000000000000000', // 4
    '00000000000000000000000000000000000000000000000000000000000000000', // 5
    '00000000000000000000000000000000000000000000000000000000000000000', // 6
    '00000000000000000000000000000000000000000000000000000000000000000', // 7
    '00000000000000000000000000000000000000000000000000000000000000000', // 8
    '00000000000000000000000000000000000000000000000000000000000000000', // 9
    '00000000000000000000000000000000000000000000000000000000000000000', // 10
    '00000000000000000000000000000000000000000000000000000000000000000', // 11
    '00000000000000000000000000000000000000000000000000000000000000000', // 12
    '00000000000000000000000000000000111100000000000000000000000000000', // 13 - Puncak Pulau Kunci (cols 32-35, y: 520)
    '11111111111111111111111100000000111100000000000011111111111111111', // 14 - Tebing Awal (0-23), Pulau Kunci (32-35), Tebing Akhir (48-64)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  // Roda Generator Listrik
  generatorWheels: [
    {
      id               : 'gen_wheel_hamster',
      x                : 640,
      y                : 500,
      radius           : 48,
      power            : 0,
      group            : 1,
      targetType       : 'bridge',
      targetId         : 'bridge_wheel_1',
      targetBridgeIds  : ['bridge_wheel_1', 'bridge_wheel_2'],
      reqRunnersFormula: (pCount) => Math.max(1, Math.min(2, Math.floor(pCount / 2))),
    },
  ],
  // 2 Bentangan Jembatan Listrik Menyeberangi Jurang
  bridges: [
    {
      id                : 'bridge_wheel_1',
      x                 : 960,
      y                 : 546,
      w                 : 320,
      h                 : 14,
      group             : 1,
      isGeneratorPowered: true,
      label             : 'JEMBATAN LISTRIK 1',
    },
    {
      id                : 'bridge_wheel_2',
      x                 : 1440,
      y                 : 546,
      w                 : 480,
      h                 : 14,
      group             : 1,
      isGeneratorPowered: true,
      label             : 'JEMBATAN LISTRIK 2',
    },
  ],
  // Tombol Kunci Jembatan di Tebing Akhir (memudahkan pelari roda menyusul kawan)
  buttons: [
    {
      id     : 'btn_wheel_latch',
      x      : 2000,
      y      : 546,
      w      : 44,
      h      : 14,
      isLatch: true,
      group  : 1,
      label  : 'KUNCI JEMBATAN',
    },
  ],
  key : { x: 1360, y: 460 },
  door: { x: 2440, y: 488 },
  doorW: 48,
  doorH: 72,
  movingPlatforms: [],
  boxes          : [],
  gates          : [],
  lasers         : [],
  springboards   : [],
};
